import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { TeamRole } from './dto/update-member-role.dto';
import { DomainError } from '../common/errors/domain-error';
import { TEAM_NAME_MIN, TEAM_NAME_MAX } from '../common/constants/limits';
import type {
  Team,
  TeamMemberWithUser,
  TeamWithRole,
} from './types/team.types';

@Injectable()
export class TeamService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly emailService: EmailService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(userId: string, dto: CreateTeamDto): Promise<Team> {
    const supabaseAdmin = this.supabaseService.getAdmin();

    // Validate team name length (should be validated in DTO, but enforce in service)
    if (dto.name.length < TEAM_NAME_MIN || dto.name.length > TEAM_NAME_MAX) {
      throw new DomainError(
        'INVALID_INPUT',
        `Team name must be between ${TEAM_NAME_MIN} and ${TEAM_NAME_MAX} characters`,
        400,
      );
    }

    // 1. Create Team
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { data: team, error: teamError } = await supabaseAdmin
      .from('teams')
      .insert({
        name: dto.name,
        owner_id: userId,
      })
      .select()
      .single();

    if (teamError || !team) {
      throw new DomainError(
        'DB_ERROR',
        'Failed to create team',
        500,
        teamError,
      );
    }

    // Type guard: ensure team has id property
    const teamId = (team as { id?: string }).id;
    if (!teamId || typeof teamId !== 'string') {
      throw new DomainError(
        'DB_ERROR',
        'Team creation returned invalid data',
        500,
      );
    }

    // 2. Add Owner as Member
    const { error: memberError } = await supabaseAdmin
      .from('team_members')
      .insert({
        team_id: teamId,
        user_id: userId,
        role: TeamRole.OWNER,
      });

    if (memberError) {
      // Rollback team creation
      await supabaseAdmin.from('teams').delete().eq('id', teamId);
      throw new DomainError(
        'DB_ERROR',
        'Failed to add owner to team members',
        500,
        memberError,
      );
    }

    // Log activity
    await this.logTeamActivity(
      teamId,
      userId,
      'TEAM_CREATE',
      'TEAM',
      teamId,
      null,
      null,
      `Team "${dto.name}" created`,
    );

    return team as Team;
  }

  async findAll(userId: string): Promise<Team[]> {
    const supabaseAdmin = this.supabaseService.getAdmin();

    const { data, error } = await supabaseAdmin
      .from('teams')
      .select('*, team_members!inner(user_id)')
      .eq('team_members.user_id', userId)
      .is('deleted_at', null);

    if (error) {
      throw new DomainError('DB_ERROR', 'Failed to fetch teams', 500, error);
    }

    // Type assertion is safe here because data structure matches Team interface
    return (data ?? []) as unknown as Team[];
  }

  async findOne(userId: string, id: string): Promise<TeamWithRole> {
    const supabaseAdmin = this.supabaseService.getAdmin();

    // Check membership
    const { data: member, error: memberError } = await supabaseAdmin
      .from('team_members')
      .select('role')
      .eq('team_id', id)
      .eq('user_id', userId)
      .single();

    if (memberError || !member) {
      throw new DomainError(
        'NOT_FOUND',
        'Team not found or you are not a member',
        404,
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { data: team, error: teamError } = await supabaseAdmin
      .from('teams')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (teamError || !team) {
      throw new DomainError('NOT_FOUND', 'Team not found', 404);
    }

    // Type assertion is safe here because we've validated both team and member exist
    return {
      ...(team as unknown as Team),
      myRole: member.role as TeamRole,
    };
  }

  async update(userId: string, id: string, dto: UpdateTeamDto): Promise<Team> {
    const supabaseAdmin = this.supabaseService.getAdmin();

    // Validate team name length
    if (dto.name.length < TEAM_NAME_MIN || dto.name.length > TEAM_NAME_MAX) {
      throw new DomainError(
        'INVALID_INPUT',
        `Team name must be between ${TEAM_NAME_MIN} and ${TEAM_NAME_MAX} characters`,
        400,
      );
    }

    // Check permissions (OWNER or ADMIN)
    const { data: member, error: memberError } = await supabaseAdmin
      .from('team_members')
      .select('role')
      .eq('team_id', id)
      .eq('user_id', userId)
      .single();

    if (memberError || !member) {
      throw new DomainError(
        'FORBIDDEN',
        'You do not have access to this team',
        403,
      );
    }

    if (member.role !== TeamRole.OWNER && member.role !== TeamRole.ADMIN) {
      throw new DomainError(
        'FORBIDDEN',
        'Only OWNER or ADMIN can update team',
        403,
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { data: team, error: teamError } = await supabaseAdmin
      .from('teams')
      .update({ name: dto.name, updated_at: new Date() })
      .eq('id', id)
      .select()
      .single();

    if (teamError || !team) {
      throw new DomainError(
        'DB_ERROR',
        'Failed to update team',
        500,
        teamError,
      );
    }

    // Log activity
    await this.logTeamActivity(
      id,
      userId,
      'TEAM_UPDATE',
      'TEAM',
      id,
      null,
      dto.name,
      `Team name updated to "${dto.name}"`,
    );

    // Type assertion is safe here because we've validated team exists
    return team as unknown as Team;
  }

  async remove(userId: string, id: string): Promise<{ message: string }> {
    const supabaseAdmin = this.supabaseService.getAdmin();

    // Check permissions (OWNER only)
    const { data: member, error: memberError } = await supabaseAdmin
      .from('team_members')
      .select('role')
      .eq('team_id', id)
      .eq('user_id', userId)
      .single();

    if (memberError || !member) {
      throw new DomainError(
        'FORBIDDEN',
        'You do not have access to this team',
        403,
      );
    }

    if (member.role !== TeamRole.OWNER) {
      throw new DomainError('FORBIDDEN', 'Only OWNER can delete team', 403);
    }

    // Get team name before deletion for logging
    const { data: teamData } = await supabaseAdmin
      .from('teams')
      .select('name')
      .eq('id', id)
      .single();

    // Soft delete
    const { error } = await supabaseAdmin
      .from('teams')
      .update({ deleted_at: new Date() })
      .eq('id', id);

    if (error) {
      throw new DomainError('DB_ERROR', 'Failed to delete team', 500, error);
    }

    // Log activity
    await this.logTeamActivity(
      id,
      userId,
      'TEAM_DELETE',
      'TEAM',
      id,
      null,
      null,
      `Team "${teamData?.name || 'Unknown'}" deleted`,
    );

    return { message: 'Team deleted successfully' };
  }

  async getMembers(
    userId: string,
    teamId: string,
  ): Promise<TeamMemberWithUser[]> {
    const supabaseAdmin = this.supabaseService.getAdmin();

    // Check membership
    const { data: member, error: memberError } = await supabaseAdmin
      .from('team_members')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', userId)
      .single();

    if (memberError || !member) {
      throw new DomainError(
        'FORBIDDEN',
        'You are not a member of this team',
        403,
      );
    }

    const { data, error } = await supabaseAdmin
      .from('team_members')
      .select('*, users(id, name, email, avatar_url)')
      .eq('team_id', teamId);

    if (error) {
      throw new DomainError(
        'DB_ERROR',
        'Failed to fetch team members',
        500,
        error,
      );
    }

    // Type assertion is safe here because data structure matches TeamMemberWithUser interface
    return (data ?? []) as unknown as TeamMemberWithUser[];
  }

  async inviteMember(
    userId: string,
    teamId: string,
    email: string,
  ): Promise<{ message: string }> {
    const supabaseAdmin = this.supabaseService.getAdmin();

    // Check permissions (OWNER or ADMIN)
    const { data: member, error: memberError } = await supabaseAdmin
      .from('team_members')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', userId)
      .single();

    if (memberError || !member) {
      throw new DomainError(
        'FORBIDDEN',
        'You do not have access to this team',
        403,
      );
    }

    if (member.role !== TeamRole.OWNER && member.role !== TeamRole.ADMIN) {
      throw new DomainError(
        'FORBIDDEN',
        'Only OWNER or ADMIN can invite members',
        403,
      );
    }

    // Find user by email
    const { data: userToInvite, error: userError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (userError || !userToInvite) {
      // TODO: Implement actual invite system for non-existing users
      throw new DomainError(
        'NOT_FOUND',
        'User with this email not found. Invite system for non-users is pending.',
        404,
      );
    }

    // Type guard: ensure userToInvite has id property
    const userIdToInvite = (userToInvite as { id?: string }).id;
    if (!userIdToInvite || typeof userIdToInvite !== 'string') {
      throw new DomainError('DB_ERROR', 'User data is invalid', 500);
    }

    // Check if already member
    const { data: existingMember } = await supabaseAdmin
      .from('team_members')
      .select('id')
      .eq('team_id', teamId)
      .eq('user_id', userIdToInvite)
      .single();

    if (existingMember) {
      throw new DomainError(
        'CONFLICT',
        'User is already a member of this team',
        409,
      );
    }

    // Add member
    const { error: insertError } = await supabaseAdmin
      .from('team_members')
      .insert({
        team_id: teamId,
        user_id: userIdToInvite,
        role: TeamRole.MEMBER,
      });

    if (insertError) {
      throw new DomainError(
        'DB_ERROR',
        'Failed to add member to team',
        500,
        insertError,
      );
    }

    // Get team and inviter details for email
    const { data: team } = await supabaseAdmin
      .from('teams')
      .select('name')
      .eq('id', teamId)
      .single();

    const { data: inviter } = await supabaseAdmin
      .from('users')
      .select('name')
      .eq('id', userId)
      .single();

    // Send invite email (optional, don't fail if email fails)
    try {
      const teamName: string = (team?.name as string | undefined) ?? 'Team';
      const inviterName: string =
        (inviter?.name as string | undefined) ?? 'A team member';
      await this.emailService.sendTeamInviteEmail(email, teamName, inviterName);
    } catch (emailError) {
      // Log error but don't fail the request
      console.error('Failed to send invite email:', emailError);
    }

    // Log activity
    await this.logTeamActivity(
      teamId,
      userId,
      'MEMBER_JOIN',
      'MEMBER',
      userIdToInvite,
      null,
      null,
      `Member joined the team`,
    );

    // Create notification for invited member
    await this.notificationsService.createNotification(
      userIdToInvite,
      'TEAM_INVITE',
      'Team Invitation',
      `You have been invited to join team: ${team?.name || 'Team'}`,
      'TEAM',
      teamId,
    );

    return { message: 'Member added successfully' };
  }

  async removeMember(
    userId: string,
    teamId: string,
    memberId: string,
  ): Promise<{ message: string }> {
    const supabaseAdmin = this.supabaseService.getAdmin();

    // Check permissions
    const { data: currentUserRole, error: currentUserError } =
      await supabaseAdmin
        .from('team_members')
        .select('role')
        .eq('team_id', teamId)
        .eq('user_id', userId)
        .single();

    if (currentUserError || !currentUserRole) {
      throw new DomainError(
        'FORBIDDEN',
        'You are not a member of this team',
        403,
      );
    }

    // Get target member role
    const { data: targetMember, error: targetMemberError } = await supabaseAdmin
      .from('team_members')
      .select('role, user_id')
      .eq('team_id', teamId)
      .eq('user_id', memberId)
      .single();

    if (targetMemberError || !targetMember) {
      throw new DomainError('NOT_FOUND', 'Member not found', 404);
    }

    // Cannot remove self via this endpoint (use leave)
    if (userId === memberId) {
      throw new DomainError(
        'BAD_REQUEST',
        'Cannot kick yourself. Use leave endpoint.',
        400,
      );
    }

    // Permission logic:
    // OWNER can remove anyone
    // ADMIN can remove MEMBER
    // MEMBER cannot remove anyone
    if (currentUserRole.role === TeamRole.OWNER) {
      // OK - OWNER can remove anyone
    } else if (currentUserRole.role === TeamRole.ADMIN) {
      if (targetMember.role !== TeamRole.MEMBER) {
        throw new DomainError(
          'FORBIDDEN',
          'Admins can only remove Members',
          403,
        );
      }
    } else {
      throw new DomainError('FORBIDDEN', 'Insufficient permissions', 403);
    }

    const { error } = await supabaseAdmin
      .from('team_members')
      .delete()
      .eq('team_id', teamId)
      .eq('user_id', memberId);

    if (error) {
      throw new DomainError(
        'DB_ERROR',
        'Failed to remove member from team',
        500,
        error,
      );
    }

    // Log activity
    await this.logTeamActivity(
      teamId,
      userId,
      'MEMBER_KICK',
      'MEMBER',
      memberId,
      null,
      null,
      `Member was removed from the team`,
    );

    return { message: 'Member removed successfully' };
  }

  async leaveTeam(
    userId: string,
    teamId: string,
  ): Promise<{ message: string }> {
    const supabaseAdmin = this.supabaseService.getAdmin();

    const { data: member, error: memberError } = await supabaseAdmin
      .from('team_members')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', userId)
      .single();

    if (memberError || !member) {
      throw new DomainError(
        'NOT_FOUND',
        'You are not a member of this team',
        404,
      );
    }

    if (member.role === TeamRole.OWNER) {
      throw new DomainError(
        'BAD_REQUEST',
        'Owner cannot leave team. Delete team or transfer ownership.',
        400,
      );
    }

    const { error } = await supabaseAdmin
      .from('team_members')
      .delete()
      .eq('team_id', teamId)
      .eq('user_id', userId);

    if (error) {
      throw new DomainError('DB_ERROR', 'Failed to leave team', 500, error);
    }

    // Log activity
    await this.logTeamActivity(
      teamId,
      userId,
      'MEMBER_LEAVE',
      'MEMBER',
      userId,
      null,
      null,
      `Member left the team`,
    );

    return { message: 'Left team successfully' };
  }

  async updateMemberRole(
    userId: string,
    teamId: string,
    memberId: string,
    newRole: TeamRole,
  ): Promise<{ message: string }> {
    const supabaseAdmin = this.supabaseService.getAdmin();

    // Only OWNER can change roles
    const { data: currentUserRole, error: currentUserError } =
      await supabaseAdmin
        .from('team_members')
        .select('role')
        .eq('team_id', teamId)
        .eq('user_id', userId)
        .single();

    if (currentUserError || !currentUserRole) {
      throw new DomainError(
        'FORBIDDEN',
        'You do not have access to this team',
        403,
      );
    }

    if (currentUserRole.role !== TeamRole.OWNER) {
      throw new DomainError('FORBIDDEN', 'Only OWNER can change roles', 403);
    }

    // Check if changing own role
    if (userId === memberId) {
      // FR-018: Transfer OWNER (when transferring OWNER to another ADMIN, original owner becomes ADMIN)
      // If Owner becomes Admin/Member, we need to ensure there is another OWNER.
      // For now, block changing self role from OWNER to non-OWNER
      if (newRole !== TeamRole.OWNER) {
        throw new DomainError(
          'BAD_REQUEST',
          'Cannot demote yourself directly. Transfer ownership to another member.',
          400,
        );
      }
    }

    // Get old role BEFORE updating
    const { data: oldMember } = await supabaseAdmin
      .from('team_members')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', memberId)
      .single();

    if (!oldMember) {
      throw new DomainError('NOT_FOUND', 'Member not found', 404);
    }

    // Update role
    const { error } = await supabaseAdmin
      .from('team_members')
      .update({ role: newRole })
      .eq('team_id', teamId)
      .eq('user_id', memberId);

    if (error) {
      throw new DomainError(
        'DB_ERROR',
        'Failed to update member role',
        500,
        error,
      );
    }

    // Log activity
    await this.logTeamActivity(
      teamId,
      userId,
      'ROLE_CHANGE',
      'MEMBER',
      memberId,
      oldMember.role || null,
      newRole,
      `Member role changed to ${newRole}`,
    );

    // Create notification for member whose role changed
    await this.notificationsService.createNotification(
      memberId,
      'ROLE_CHANGED',
      'Role Changed',
      `Your role in the team has been changed to ${newRole}`,
      'TEAM',
      teamId,
    );

    return { message: 'Role updated successfully' };
  }

  private async logTeamActivity(
    teamId: string,
    actorId: string,
    actionType: string,
    targetType: string | null,
    targetId: string | null,
    oldValue: string | null,
    newValue: string | null,
    description: string,
  ): Promise<void> {
    const supabaseAdmin = this.supabaseService.getAdmin();

    await supabaseAdmin.from('team_activities').insert({
      team_id: teamId,
      actor_id: actorId,
      action_type: actionType,
      target_type: targetType,
      target_id: targetId,
      old_value: oldValue,
      new_value: newValue,
      description: description,
    });
  }

  async getActivities(
    userId: string,
    teamId: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<any> {
    const supabaseAdmin = this.supabaseService.getAdmin();

    // Check membership
    const { data: member } = await supabaseAdmin
      .from('team_members')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', userId)
      .single();

    if (!member) {
      throw new DomainError(
        'FORBIDDEN',
        'You are not a member of this team',
        403,
      );
    }

    // Get activities with actor
    const { data: activities, error } = await supabaseAdmin
      .from('team_activities')
      .select(
        '*, actor:users!team_activities_actor_id_fkey(id, name, email, avatar_url)',
      )
      .eq('team_id', teamId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new DomainError(
        'DB_ERROR',
        'Failed to fetch team activities',
        500,
        error,
      );
    }

    // Get target users for activities where target_type is 'MEMBER'
    const memberActivityIds = (activities || [])
      .filter((activity: any) => activity.target_type === 'MEMBER' && activity.target_id)
      .map((activity: any) => activity.target_id);

    let targetUsersMap: Record<string, any> = {};
    if (memberActivityIds.length > 0) {
      const { data: targetUsers, error: targetUsersError } = await supabaseAdmin
        .from('users')
        .select('id, name, email')
        .in('id', memberActivityIds);

      if (!targetUsersError && targetUsers) {
        targetUsersMap = targetUsers.reduce((acc: Record<string, any>, user: any) => {
          acc[user.id] = user;
          return acc;
        }, {});
      }
    }

    // Enrich activities with target_user data
    const enrichedActivities = (activities || []).map((activity: any) => {
      if (activity.target_type === 'MEMBER' && activity.target_id && targetUsersMap[activity.target_id]) {
        return {
          ...activity,
          target_user: targetUsersMap[activity.target_id],
        };
      }
      return {
        ...activity,
        target_user: null,
      };
    });

    // Get total count
    const { count, error: countError } = await supabaseAdmin
      .from('team_activities')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', teamId);

    if (countError) {
      throw new DomainError(
        'DB_ERROR',
        'Failed to count team activities',
        500,
        countError,
      );
    }

    return {
      activities: enrichedActivities,
      total: count || 0,
      limit,
      offset,
    };
  }

  async getStatistics(userId: string, teamId: string, period: string = '30d') {
    const supabaseAdmin = this.supabaseService.getAdmin();

    // Check membership
    const { data: member } = await supabaseAdmin
      .from('team_members')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', userId)
      .single();

    if (!member) {
      throw new DomainError(
        'FORBIDDEN',
        'You are not a member of this team',
        403,
      );
    }

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    if (period === '7d') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (period === '90d') {
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    } else {
      // 30d default
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Get all projects in team
    const { data: projects } = await supabaseAdmin
      .from('projects')
      .select('id, name')
      .eq('team_id', teamId)
      .is('deleted_at', null);

    const projectIds = (projects || []).map((p: any) => p.id);

    // Get issues created in period
    const { data: createdIssues } = await supabaseAdmin
      .from('issues')
      .select('id, created_at, status')
      .in('project_id', projectIds)
      .gte('created_at', startDate.toISOString())
      .is('deleted_at', null);

    // Get issues completed in period
    const { data: completedIssues } = await supabaseAdmin
      .from('issues')
      .select('id, updated_at, status')
      .in('project_id', projectIds)
      .eq('status', 'Done')
      .gte('updated_at', startDate.toISOString())
      .is('deleted_at', null);

    // Group by day for trends
    const creationTrend: Record<string, number> = {};
    const completionTrend: Record<string, number> = {};

    (createdIssues || []).forEach((issue: any) => {
      const date = new Date(issue.created_at).toISOString().split('T')[0];
      creationTrend[date] = (creationTrend[date] || 0) + 1;
    });

    (completedIssues || []).forEach((issue: any) => {
      const date = new Date(issue.updated_at).toISOString().split('T')[0];
      completionTrend[date] = (completionTrend[date] || 0) + 1;
    });

    // Get all issues for member stats
    const { data: allIssues } = await supabaseAdmin
      .from('issues')
      .select('assignee_id, status')
      .in('project_id', projectIds)
      .is('deleted_at', null);

    // Assigned issues per member
    const assignedPerMember: Record<string, number> = {};
    const completedPerMember: Record<string, number> = {};

    (allIssues || []).forEach((issue: any) => {
      if (issue.assignee_id) {
        assignedPerMember[issue.assignee_id] =
          (assignedPerMember[issue.assignee_id] || 0) + 1;
        if (issue.status === 'Done') {
          completedPerMember[issue.assignee_id] =
            (completedPerMember[issue.assignee_id] || 0) + 1;
        }
      }
    });

    // Get member details
    const memberIds = Object.keys(assignedPerMember);
    const { data: members } = await supabaseAdmin
      .from('users')
      .select('id, name, email')
      .in('id', memberIds);

    const memberStats = (members || []).map((member: any) => ({
      member: {
        id: member.id,
        name: member.name,
        email: member.email,
      },
      assigned: assignedPerMember[member.id] || 0,
      completed: completedPerMember[member.id] || 0,
    }));

    // Issue status per project
    const statusPerProject: Record<string, Record<string, number>> = {};

    (projects || []).forEach((project: any) => {
      statusPerProject[project.id] = {
        name: project.name,
        Backlog: 0,
        'In Progress': 0,
        Done: 0,
      };
    });

    (allIssues || []).forEach((issue: any) => {
      const projectId = issue.project_id;
      const status = issue.status || 'Backlog';
      if (statusPerProject[projectId]) {
        statusPerProject[projectId][status] =
          (statusPerProject[projectId][status] || 0) + 1;
      }
    });

    return {
      period,
      creationTrend,
      completionTrend,
      memberStats,
      statusPerProject: Object.values(statusPerProject),
    };
  }
}
