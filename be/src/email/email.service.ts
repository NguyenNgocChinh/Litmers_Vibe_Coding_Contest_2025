import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('EMAIL_HOST') || 'smtp.gmail.com',
      port: this.configService.get<number>('EMAIL_PORT') || 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: this.configService.get<string>('EMAIL_USER'),
        pass: this.configService.get<string>('EMAIL_PASSWORD'),
      },
    });
  }

  async sendPasswordResetEmail(to: string, resetToken: string, userName: string): Promise<void> {
    const resetUrl = `${this.configService.get<string>('FRONTEND_URL')}/reset-password?token=${resetToken}`;
    
    const mailOptions = {
      from: `"Litmers Support" <${this.configService.get<string>('EMAIL_USER')}>`,
      to,
      subject: 'Password Reset Request',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Password Reset Request</h2>
          <p>Hi ${userName},</p>
          <p>We received a request to reset your password. Click the button below to reset it:</p>
          <div style="margin: 30px 0;">
            <a href="${resetUrl}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Reset Password
            </a>
          </div>
          <p>This link will expire in 1 hour.</p>
          <p>If you didn't request a password reset, please ignore this email.</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 12px;">
            This is an automated email. Please do not reply to this message.
          </p>
        </div>
      `,
    };

    await this.transporter.sendMail(mailOptions);
  }

  async sendTeamInviteEmail(to: string, teamName: string, inviterName: string): Promise<void> {
    const inviteUrl = `${this.configService.get<string>('FRONTEND_URL')}/teams`;
    
    const mailOptions = {
      from: `"Litmers" <${this.configService.get<string>('EMAIL_USER')}>`,
      to,
      subject: `You've been invited to join ${teamName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Team Invitation</h2>
          <p>Hi there,</p>
          <p><strong>${inviterName}</strong> has invited you to join the team <strong>${teamName}</strong> on Litmers.</p>
          <div style="margin: 30px 0;">
            <a href="${inviteUrl}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              View Team
            </a>
          </div>
          <p>Click the button above to log in and start collaborating with your team!</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 12px;">
            This is an automated email. Please do not reply to this message.
          </p>
        </div>
      `,
    };

    await this.transporter.sendMail(mailOptions);
  }

  async sendWelcomeEmail(to: string, userName: string): Promise<void> {
    const mailOptions = {
      from: `"Litmers" <${this.configService.get<string>('EMAIL_USER')}>`,
      to,
      subject: 'Welcome to Litmers!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Welcome to Litmers!</h2>
          <p>Hi ${userName},</p>
          <p>Thank you for signing up! We're excited to have you on board.</p>
          <p>Get started by creating your first team and project.</p>
          <div style="margin: 30px 0;">
            <a href="${this.configService.get<string>('FRONTEND_URL')}/dashboard" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Go to Dashboard
            </a>
          </div>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 12px;">
            This is an automated email. Please do not reply to this message.
          </p>
        </div>
      `,
    };

    await this.transporter.sendMail(mailOptions);
  }
}
