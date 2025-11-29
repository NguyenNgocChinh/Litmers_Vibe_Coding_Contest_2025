import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { EmailService } from '../email/email.service';
import { PASSWORD_RESET_EXPIRATION_HOURS } from '../common/constants/limits';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  async signup(dto: SignupDto) {
    const { email, password, name } = dto;
    const supabase = this.supabaseService.getAdmin();

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
      },
    });

    if (authError) {
      throw new BadRequestException(authError.message);
    }

    if (!authData.user) {
      throw new InternalServerErrorException('Failed to create user');
    }

    // Auto-confirm email for development (bypass email confirmation requirement)
    const { error: confirmError } = await supabase.auth.admin.updateUserById(
      authData.user.id,
      {
        email_confirm: true,
      },
    );

    if (confirmError) {
      console.error('Failed to auto-confirm email:', confirmError);
      // Don't throw error, user can still confirm via email link
    }

    const { error: dbError } = await supabase.from('users').insert({
      id: authData.user.id,
      email: email,
      name: name,
    });

    if (dbError) {
      if (dbError.code !== '23505') {
        console.error('Failed to sync user to public.users:', dbError);
      }
    }

    return { message: 'User registered successfully', user: authData.user };
  }

  async login(dto: LoginDto) {
    const { email, password } = dto;
    const supabase = this.supabaseService.getClient();
    const supabaseAdmin = this.supabaseService.getAdmin();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // If error is "Email not confirmed", auto-confirm for development
      if (
        error.message.includes('Email not confirmed') ||
        error.message.includes('email_not_confirmed')
      ) {
        // Try to get user by email and auto-confirm
        const {
          data: { users },
        } = await supabaseAdmin.auth.admin.listUsers();
        const user = users.find((u) => u.email === email);

        if (user) {
          // Auto-confirm email
          const { error: confirmError } =
            await supabaseAdmin.auth.admin.updateUserById(user.id, {
              email_confirm: true,
            });

          if (!confirmError) {
            // Retry login after confirmation
            const { data: retryData, error: retryError } =
              await supabase.auth.signInWithPassword({
                email,
                password,
              });

            if (retryError) {
              throw new UnauthorizedException(retryError.message);
            }

            return {
              access_token: retryData.session.access_token,
              refresh_token: retryData.session.refresh_token,
              user: retryData.user,
            };
          }
        }
      }

      throw new UnauthorizedException(error.message);
    }

    return {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      user: data.user,
    };
  }

  async syncUser(user: any) {
    const supabaseAdmin = this.supabaseService.getAdmin();
    const email = user.email;
    const name =
      user.user_metadata?.name || user.user_metadata?.full_name || email;
    const avatarUrl =
      user.user_metadata?.avatar_url || user.user_metadata?.picture;

    const { error: dbError } = await supabaseAdmin.from('users').upsert(
      {
        id: user.id,
        email: email,
        name: name,
        avatar_url: avatarUrl,
      },
      { onConflict: 'id' },
    );

    if (dbError) {
      console.error('Failed to sync user to public.users:', dbError);
      throw new InternalServerErrorException('Failed to sync user');
    }

    return { message: 'User synced successfully' };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const supabaseAdmin = this.supabaseService.getAdmin();

    // Find user by email
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, email, name')
      .eq('email', dto.email)
      .is('deleted_at', null)
      .single();

    // Don't reveal if email exists or not (security best practice)
    if (!user) {
      // Return success even if user doesn't exist to prevent email enumeration
      return { message: 'If the email exists, a password reset link has been sent.' };
    }

    // Generate reset token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + PASSWORD_RESET_EXPIRATION_HOURS);

    // Save token to database
    const { error: tokenError } = await supabaseAdmin
      .from('password_reset_tokens')
      .insert({
        user_id: user.id,
        token: token,
        expires_at: expiresAt,
        used: false,
      });

    if (tokenError) {
      throw new InternalServerErrorException('Failed to create reset token');
    }

    // Send email
    try {
      await this.emailService.sendPasswordResetEmail(
        user.email,
        token,
        user.name || 'User',
      );
    } catch (error) {
      console.error('Failed to send password reset email:', error);
      throw new InternalServerErrorException('Failed to send reset email');
    }

    return { message: 'If the email exists, a password reset link has been sent.' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const supabaseAdmin = this.supabaseService.getAdmin();

    // Find token
    const { data: resetToken } = await supabaseAdmin
      .from('password_reset_tokens')
      .select('*, user:users(id, email)')
      .eq('token', dto.token)
      .eq('used', false)
      .single();

    if (!resetToken) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Check expiration
    if (new Date(resetToken.expires_at) < new Date()) {
      throw new BadRequestException('Reset token has expired');
    }

    // Update password in Supabase Auth
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      resetToken.user_id,
      {
        password: dto.newPassword,
      },
    );

    if (updateError) {
      throw new InternalServerErrorException('Failed to reset password');
    }

    // Mark token as used
    await supabaseAdmin
      .from('password_reset_tokens')
      .update({ used: true })
      .eq('id', resetToken.id);

    return { message: 'Password has been reset successfully' };
  }

  async getProfile(userId: string) {
    const supabaseAdmin = this.supabaseService.getAdmin();

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id, email, name, avatar_url, created_at, updated_at')
      .eq('id', userId)
      .is('deleted_at', null)
      .single();

    if (error || !user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateProfile(userId: string, dto: any) {
    const supabaseAdmin = this.supabaseService.getAdmin();

    // Check if user exists
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('id', userId)
      .is('deleted_at', null)
      .single();

    if (!existingUser) {
      throw new NotFoundException('User not found');
    }

    // Prepare update data
    const updateData: any = {
      updated_at: new Date(),
    };

    if (dto.name !== undefined) {
      updateData.name = dto.name;
    }

    if (dto.profileImage !== undefined) {
      updateData.avatar_url = dto.profileImage;
    }

    // Update user
    const { data: updatedUser, error } = await supabaseAdmin
      .from('users')
      .update(updateData)
      .eq('id', userId)
      .select('id, email, name, avatar_url, created_at, updated_at')
      .single();

    if (error) {
      throw new InternalServerErrorException('Failed to update profile');
    }

    // Also update in Supabase Auth metadata if needed
    try {
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        user_metadata: {
          name: updateData.name || existingUser.name,
          avatar_url: updateData.avatar_url,
        },
      });
    } catch (error) {
      // Log but don't fail if auth update fails
      console.error('Failed to update auth metadata:', error);
    }

    return updatedUser;
  }

  async changePassword(userId: string, dto: any) {
    const supabaseAdmin = this.supabaseService.getAdmin();
    const supabase = this.supabaseService.getClient();

    // Check if user exists and get email
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .eq('id', userId)
      .is('deleted_at', null)
      .single();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if user has password (not OAuth-only user)
    // Try to sign in with current password to verify
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: dto.currentPassword,
    });

    if (verifyError) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Verify new password matches confirmation
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('New password and confirmation do not match');
    }

    // Update password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      {
        password: dto.newPassword,
      },
    );

    if (updateError) {
      throw new InternalServerErrorException('Failed to change password');
    }

    return { message: 'Password changed successfully' };
  }

  async deleteAccount(userId: string, dto: any) {
    const supabaseAdmin = this.supabaseService.getAdmin();
    const supabase = this.supabaseService.getClient();

    // Check if user exists and get email
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .eq('id', userId)
      .is('deleted_at', null)
      .single();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // For non-OAuth users, verify password
    // Check if user has password by trying to sign in
    if (dto.password) {
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: dto.password,
      });

      if (verifyError) {
        throw new UnauthorizedException('Password is incorrect');
      }
    }

    // Check for owned teams
    const { data: ownedTeams, error: teamsError } = await supabaseAdmin
      .from('teams')
      .select('id, name')
      .eq('owner_id', userId)
      .is('deleted_at', null);

    if (teamsError) {
      throw new InternalServerErrorException('Failed to check owned teams');
    }

    if (ownedTeams && ownedTeams.length > 0) {
      throw new BadRequestException(
        'Cannot delete account. Please delete owned teams or transfer ownership first.',
      );
    }

    // Soft delete user
    const { error: deleteError } = await supabaseAdmin
      .from('users')
      .update({ deleted_at: new Date() })
      .eq('id', userId);

    if (deleteError) {
      throw new InternalServerErrorException('Failed to delete account');
    }

    // Also delete from Supabase Auth (optional - depends on requirements)
    // For now, we'll just soft delete in our database

    return { message: 'Account deleted successfully' };
  }
}
