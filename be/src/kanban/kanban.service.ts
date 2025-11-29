import { Injectable, InternalServerErrorException, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { UpdateIssueStatusDto } from './dto/update-issue-status.dto';

@Injectable()
export class KanbanService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async getBoard(userId: string, projectId: string) {
    const supabaseAdmin = this.supabaseService.getAdmin();

    // Check access
    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('team_id')
      .eq('id', projectId)
      .single();

    if (!project) throw new NotFoundException('Project not found');

    const { data: member } = await supabaseAdmin
      .from('team_members')
      .select('role')
      .eq('team_id', project.team_id)
      .eq('user_id', userId)
      .single();

    if (!member) throw new ForbiddenException('Access denied');

    // Fetch all active issues for the project
    const { data: issues, error } = await supabaseAdmin
      .from('issues')
      .select('*, assignee:users!assignee_id(id, name, avatar_url)')
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .order('position', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false }); // Default order

    if (error) throw new InternalServerErrorException(error.message);

    // Fetch labels and subtasks for all issues
    const issueIds = issues.map((i: any) => i.id);
    
    // Get labels
    const { data: issueLabels } = await supabaseAdmin
      .from('issue_labels')
      .select('issue_id, labels(id, name, color)')
      .in('issue_id', issueIds);

    // Get subtasks
    const { data: subtasks } = await supabaseAdmin
      .from('subtasks')
      .select('issue_id, id, title, completed')
      .in('issue_id', issueIds);

    // Attach labels and subtasks to issues
    issues.forEach((issue: any) => {
      // Attach labels
      const labels = issueLabels
        ?.filter((il: any) => il.issue_id === issue.id)
        .map((il: any) => il.labels)
        .filter(Boolean) || [];
      issue.labels = labels;

      // Attach subtasks
      const issueSubtasks = subtasks
        ?.filter((s: any) => s.issue_id === issue.id)
        .map((s: any) => ({ id: s.id, title: s.title, completed: s.completed })) || [];
      issue.subtasks = issueSubtasks;
    });

    // Group by status - start with default statuses
    const board: Record<string, any[]> = {
      'Backlog': [],
      'In Progress': [],
      'Done': [],
    };

    issues.forEach((issue) => {
      // Handle custom statuses - add to board dynamically if not exists
      if (!board[issue.status]) {
        board[issue.status] = [];
      }
      board[issue.status].push(issue);
    });

    return board;
  }

  async updateIssueStatus(userId: string, issueId: string, dto: UpdateIssueStatusDto) {
    const supabaseAdmin = this.supabaseService.getAdmin();

    // Check access and get issue
    const { data: issue } = await supabaseAdmin
      .from('issues')
      .select('*, project:projects(team_id, id)')
      .eq('id', issueId)
      .is('deleted_at', null)
      .single();

    if (!issue) throw new NotFoundException('Issue not found');

    const { data: member } = await supabaseAdmin
      .from('team_members')
      .select('role')
      .eq('team_id', issue.project.team_id)
      .eq('user_id', userId)
      .single();

    if (!member) throw new ForbiddenException('Access denied');

    // Validate status value (must be default or custom status for this project)
    const defaultStatuses = ['Backlog', 'In Progress', 'Done'];
    const isValidDefaultStatus = defaultStatuses.includes(dto.status);

    if (!isValidDefaultStatus) {
      // Check if it's a custom status for this project
      const { data: customStatus } = await supabaseAdmin
        .from('project_statuses')
        .select('id')
        .eq('project_id', issue.project.id)
        .eq('name', dto.status)
        .single();

      if (!customStatus) {
        throw new BadRequestException(`Invalid status: ${dto.status}. Status must be a default status (Backlog, In Progress, Done) or a custom status for this project.`);
      }
    }

    // Don't update if status hasn't changed
    if (issue.status === dto.status) {
      return issue;
    }

    // Track change history
    const { error: activityError } = await supabaseAdmin
      .from('issue_activities')
      .insert({
        issue_id: issueId,
        actor_id: userId,
        action_type: 'STATUS_CHANGE',
        old_value: issue.status || null,
        new_value: dto.status,
      });

    if (activityError) {
      // Log error but don't fail the update
      console.error('Failed to record status change activity:', activityError);
    }

    // Update status
    const { data, error } = await supabaseAdmin
      .from('issues')
      .update({
        status: dto.status,
        updated_at: new Date(),
      })
      .eq('id', issueId)
      .select()
      .single();

    if (error) throw new InternalServerErrorException(error.message);

    return data;
  }

  async updateIssuePosition(userId: string, issueId: string, position: number) {
    const supabaseAdmin = this.supabaseService.getAdmin();

    // Check access and get issue
    const { data: issue } = await supabaseAdmin
      .from('issues')
      .select('*, project:projects(team_id)')
      .eq('id', issueId)
      .is('deleted_at', null)
      .single();

    if (!issue) throw new NotFoundException('Issue not found');

    const { data: member } = await supabaseAdmin
      .from('team_members')
      .select('role')
      .eq('team_id', issue.project.team_id)
      .eq('user_id', userId)
      .single();

    if (!member) throw new ForbiddenException('Access denied');

    // Update position
    const { data, error } = await supabaseAdmin
      .from('issues')
      .update({
        position: position,
        updated_at: new Date(),
      })
      .eq('id', issueId)
      .select()
      .single();

    if (error) throw new InternalServerErrorException(error.message);

    return data;
  }

  async updateMultipleIssuePositions(userId: string, updates: Array<{ issueId: string; position: number; status: string }>) {
    const supabaseAdmin = this.supabaseService.getAdmin();

    if (!updates || updates.length === 0) {
      return { message: 'No updates provided' };
    }

    // Check access for first issue to verify team membership
    const { data: firstIssue } = await supabaseAdmin
      .from('issues')
      .select('*, project:projects(team_id)')
      .eq('id', updates[0].issueId)
      .is('deleted_at', null)
      .single();

    if (!firstIssue) throw new NotFoundException('Issue not found');

    const { data: member } = await supabaseAdmin
      .from('team_members')
      .select('role')
      .eq('team_id', firstIssue.project.team_id)
      .eq('user_id', userId)
      .single();

    if (!member) throw new ForbiddenException('Access denied');

    // Update all positions in a transaction-like manner
    const updatePromises = updates.map((update) =>
      supabaseAdmin
        .from('issues')
        .update({
          position: update.position,
          status: update.status,
          updated_at: new Date(),
        })
        .eq('id', update.issueId)
    );

    await Promise.all(updatePromises);

    return { message: 'Positions updated successfully' };
  }
}
