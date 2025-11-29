import { Injectable, InternalServerErrorException, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateIssueDto } from './dto/create-issue.dto';
import { UpdateIssueDto } from './dto/update-issue.dto';
import { CreateSubtaskDto } from './dto/create-subtask.dto';
import { UpdateSubtaskDto } from './dto/update-subtask.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { FilterIssuesDto, SortField, SortOrder } from './dto/filter-issues.dto';

@Injectable()
export class IssueService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(userId: string, dto: CreateIssueDto) {
    const supabaseAdmin = this.supabaseService.getAdmin();

    // 1. Check Project Access
    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('team_id')
      .eq('id', dto.project_id)
      .single();

    if (!project) throw new NotFoundException('Project not found');

    const { data: member } = await supabaseAdmin
      .from('team_members')
      .select('role')
      .eq('team_id', project.team_id)
      .eq('user_id', userId)
      .single();

    if (!member) throw new ForbiddenException('You do not have access to this project');

    // 2. Validate assignee if provided (must be a team member)
    if (dto.assignee_id) {
      const { data: assigneeMember } = await supabaseAdmin
        .from('team_members')
        .select('user_id')
        .eq('team_id', project.team_id)
        .eq('user_id', dto.assignee_id)
        .single();

      if (!assigneeMember) {
        throw new BadRequestException('Assignee must be a team member');
      }
    }

    // 3. Check Issue Limit (Max 200 issues per project)
    const { count, error: countError } = await supabaseAdmin
      .from('issues')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', dto.project_id)
      .is('deleted_at', null);

    if (countError) throw new InternalServerErrorException(countError.message);

    if (count !== null && count >= 200) {
      throw new BadRequestException('Issue limit reached for this project (Max 200 issues)');
    }

    // 4. Validate labels if provided
    if (dto.label_ids && dto.label_ids.length > 0) {
      // Check max 5 labels per issue
      if (dto.label_ids.length > 5) {
        throw new BadRequestException('Maximum 5 labels per issue');
      }

      // Validate all labels belong to this project
      const { data: labels, error: labelsError } = await supabaseAdmin
        .from('labels')
        .select('id')
        .eq('project_id', dto.project_id)
        .in('id', dto.label_ids);

      if (labelsError) throw new InternalServerErrorException(labelsError.message);

      if (!labels || labels.length !== dto.label_ids.length) {
        throw new BadRequestException('One or more labels do not belong to this project');
      }
    }

    // 5. Create Issue
    const { data: issue, error } = await supabaseAdmin
      .from('issues')
      .insert({
        title: dto.title,
        description: dto.description,
        project_id: dto.project_id,
        priority: dto.priority,
        status: dto.status,
        assignee_id: dto.assignee_id,
        reporter_id: userId,
        start_date: dto.start_date,
        due_date: dto.due_date,
      })
      .select()
      .single();

    if (error) throw new InternalServerErrorException(error.message);

    // 6. Assign labels if provided
    if (dto.label_ids && dto.label_ids.length > 0) {
      const issueLabels = dto.label_ids.map(labelId => ({
        issue_id: issue.id,
        label_id: labelId,
      }));

      const { error: labelsError } = await supabaseAdmin
        .from('issue_labels')
        .insert(issueLabels);

      if (labelsError) {
        // If label assignment fails, we should rollback the issue creation
        // For now, just log and continue (issue is already created)
        // In production, consider using transactions
        throw new InternalServerErrorException(`Failed to assign labels: ${labelsError.message}`);
      }
    }

    // 7. Return issue with labels
    const { data: issueWithLabels } = await supabaseAdmin
      .from('issues')
      .select(`
        *,
        issue_labels(
          label_id,
          labels(
            id,
            name,
            color
          )
        )
      `)
      .eq('id', issue.id)
      .single();

    // Transform labels to flat array
    if (issueWithLabels && issueWithLabels.issue_labels) {
      issueWithLabels.labels = issueWithLabels.issue_labels.map((il: any) => il.labels).filter(Boolean);
      delete issueWithLabels.issue_labels;
    }

    // Create notification if issue is assigned
    if (dto.assignee_id && dto.assignee_id !== userId) {
      await this.notificationsService.createNotification(
        dto.assignee_id,
        'ISSUE_ASSIGNED',
        'New Issue Assigned',
        `You have been assigned to issue: ${dto.title}`,
        'ISSUE',
        issue.id,
      );
    }

    return issueWithLabels || issue;
  }

  async findAll(userId: string, projectId: string, filters?: FilterIssuesDto) {
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

    // Build query
    let query = supabaseAdmin
      .from('issues')
      .select('*, assignee:users!assignee_id(id, name, avatar_url), reporter:users!reporter_id(id, name, avatar_url)')
      .eq('project_id', projectId)
      .is('deleted_at', null);

    // Title search
    if (filters?.search) {
      query = query.ilike('title', `%${filters.search}%`);
    }

    // Filter by status
    if (filters?.status && filters.status.length > 0) {
      query = query.in('status', filters.status);
    }

    // Filter by assignee
    if (filters?.assignee_id) {
      query = query.eq('assignee_id', filters.assignee_id);
    }

    // Filter by priority
    if (filters?.priority && filters.priority.length > 0) {
      query = query.in('priority', filters.priority);
    }

    // Filter by has due date
    if (filters?.has_due_date !== undefined) {
      if (filters.has_due_date) {
        query = query.not('due_date', 'is', null);
      } else {
        query = query.is('due_date', null);
      }
    }

    // Filter by due date range
    if (filters?.due_date_from) {
      query = query.gte('due_date', filters.due_date_from);
    }
    if (filters?.due_date_to) {
      query = query.lte('due_date', filters.due_date_to);
    }

    // Apply sorting
    const sortField = filters?.sort_by || SortField.CREATED_AT;
    const sortOrder = filters?.sort_order || SortOrder.DESC;
    const ascending = sortOrder === SortOrder.ASC;

    // Handle priority sorting (need custom logic)
    if (sortField === SortField.PRIORITY) {
      // Priority order: HIGH > MEDIUM > LOW
      // We'll need to sort in application layer or use a CASE statement
      // For now, let's use a simple approach: sort by priority enum value
      query = query.order('priority', { ascending: false }); // HIGH comes first
    } else {
      query = query.order(sortField, { ascending });
    }

    const { data, error } = await query;

    if (error) throw new InternalServerErrorException(error.message);

    let issues = data || [];

    // Filter by label (need to check after fetching because of join complexity)
    if (filters?.label_id) {
      const { data: issueLabels } = await supabaseAdmin
        .from('issue_labels')
        .select('issue_id')
        .eq('label_id', filters.label_id);

      const issueIdsWithLabel = new Set((issueLabels || []).map((il: any) => il.issue_id));
      issues = issues.filter((issue: any) => issueIdsWithLabel.has(issue.id));
    }

    // Re-sort if needed (for priority or if label filter was applied)
    if (filters?.label_id || sortField === SortField.PRIORITY) {
      if (sortField === SortField.PRIORITY) {
        const priorityOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 };
        issues.sort((a: any, b: any) => {
          const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] || 0;
          const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] || 0;
          return sortOrder === SortOrder.DESC ? bPriority - aPriority : aPriority - bPriority;
        });
      } else {
        // Re-sort by the original sort field
        issues.sort((a: any, b: any) => {
          const aVal = a[sortField];
          const bVal = b[sortField];
          if (aVal === null || aVal === undefined) return 1;
          if (bVal === null || bVal === undefined) return -1;
          if (aVal < bVal) return ascending ? -1 : 1;
          if (aVal > bVal) return ascending ? 1 : -1;
          return 0;
        });
      }
    }

    return issues;
  }

  async findOne(userId: string, id: string) {
    const supabaseAdmin = this.supabaseService.getAdmin();

    const { data: issue } = await supabaseAdmin
      .from('issues')
      .select(`
        *,
        assignee:users!assignee_id(id, name, avatar_url),
        reporter:users!reporter_id(id, name, avatar_url),
        project:projects(team_id)
      `)
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (!issue) throw new NotFoundException('Issue not found');

    // Check access
    const { data: member } = await supabaseAdmin
      .from('team_members')
      .select('role')
      .eq('team_id', issue.project.team_id)
      .eq('user_id', userId)
      .single();

    if (!member) throw new ForbiddenException('Access denied');

    // Get labels
    const { data: issueLabels } = await supabaseAdmin
      .from('issue_labels')
      .select(`
        label_id,
        labels(
          id,
          name,
          color
        )
      `)
      .eq('issue_id', id);

    // Transform labels to flat array
    if (issueLabels) {
      issue.labels = issueLabels
        .map((il: any) => il.labels)
        .filter(Boolean);
    } else {
      issue.labels = [];
    }

    // Get subtasks (ordered by position)
    const { data: subtasks } = await supabaseAdmin
      .from('subtasks')
      .select('*')
      .eq('issue_id', id)
      .order('position', { ascending: true });

    issue.subtasks = subtasks || [];

    // Get change history
    const { data: activities } = await supabaseAdmin
      .from('issue_activities')
      .select(`
        *,
        actor:users!actor_id(id, name, avatar_url)
      `)
      .eq('issue_id', id)
      .order('created_at', { ascending: false });

    issue.change_history = activities || [];

    return issue;
  }

  async getChangeHistory(userId: string, issueId: string) {
    const supabaseAdmin = this.supabaseService.getAdmin();

    // Check access to issue
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

    // Get change history
    const { data: activities, error } = await supabaseAdmin
      .from('issue_activities')
      .select(`
        *,
        actor:users!actor_id(id, name, avatar_url)
      `)
      .eq('issue_id', issueId)
      .order('created_at', { ascending: false });

    if (error) throw new InternalServerErrorException(error.message);

    // Transform activities to include field name for display
    const transformedActivities = (activities || []).map((activity: any) => {
      let fieldName = '';
      switch (activity.action_type) {
        case 'STATUS_CHANGE':
          fieldName = 'Status';
          break;
        case 'ASSIGN_CHANGE':
          fieldName = 'Assignee';
          break;
        case 'PRIORITY_CHANGE':
          fieldName = 'Priority';
          break;
        case 'TITLE_CHANGE':
          fieldName = 'Title';
          break;
        case 'DUE_DATE_CHANGE':
          fieldName = 'Due Date';
          break;
        case 'DESCRIPTION_CHANGE':
          fieldName = 'Description';
          break;
        case 'LABELS_CHANGE':
          fieldName = 'Labels';
          break;
        default:
          fieldName = activity.action_type.replace('_CHANGE', '').replace('_', ' ');
      }

      return {
        ...activity,
        field_name: fieldName,
      };
    });

    return transformedActivities;
  }

  async update(userId: string, id: string, dto: UpdateIssueDto) {
    const supabaseAdmin = this.supabaseService.getAdmin();

    // Check existence and access
    const { data: issue } = await supabaseAdmin
      .from('issues')
      .select('*, project:projects(team_id)')
      .eq('id', id)
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

    // Validate assignee if provided (can be null to unassign)
    if (dto.assignee_id !== undefined && dto.assignee_id !== null) {
      const { data: assigneeMember } = await supabaseAdmin
        .from('team_members')
        .select('user_id')
        .eq('team_id', issue.project.team_id)
        .eq('user_id', dto.assignee_id)
        .single();

      if (!assigneeMember) {
        throw new BadRequestException('Assignee must be a team member');
      }
    }

    // Validate labels if provided
    const labelIds = dto.label_ids;
    delete (dto as any).label_ids; // Remove from dto before updating issue

    if (labelIds !== undefined) {
      if (labelIds.length > 5) {
        throw new BadRequestException('Maximum 5 labels per issue');
      }

      if (labelIds.length > 0) {
        // Validate all labels belong to this project
        const { data: labels, error: labelsError } = await supabaseAdmin
          .from('labels')
          .select('id')
          .eq('project_id', issue.project_id)
          .in('id', labelIds);

        if (labelsError) throw new InternalServerErrorException(labelsError.message);

        if (!labels || labels.length !== labelIds.length) {
          throw new BadRequestException('One or more labels do not belong to this project');
        }
      }
    }

    // Invalidate AI cache if description changes
    if (dto.description !== undefined && dto.description !== issue.description) {
      const supabaseAdmin = this.supabaseService.getAdmin();
      // Delete AI cache for this issue (summary and suggestion)
      await supabaseAdmin
        .from('ai_issue_cache')
        .delete()
        .eq('issue_id', id);
    }

    // Track changes before updating
    const activities: any[] = [];

    if (dto.title !== undefined && dto.title !== issue.title) {
      activities.push({
        issue_id: id,
        actor_id: userId,
        action_type: 'TITLE_CHANGE',
        old_value: issue.title || null,
        new_value: dto.title,
      });
    }

    if (dto.description !== undefined && dto.description !== issue.description) {
      activities.push({
        issue_id: id,
        actor_id: userId,
        action_type: 'DESCRIPTION_CHANGE',
        old_value: issue.description || null,
        new_value: dto.description,
      });
    }

    if (dto.status !== undefined && dto.status !== issue.status) {
      activities.push({
        issue_id: id,
        actor_id: userId,
        action_type: 'STATUS_CHANGE',
        old_value: issue.status || null,
        new_value: dto.status,
      });
    }

    if (dto.priority !== undefined && dto.priority !== issue.priority) {
      activities.push({
        issue_id: id,
        actor_id: userId,
        action_type: 'PRIORITY_CHANGE',
        old_value: issue.priority || null,
        new_value: dto.priority,
      });
    }

    if (dto.assignee_id !== undefined && dto.assignee_id !== issue.assignee_id) {
      activities.push({
        issue_id: id,
        actor_id: userId,
        action_type: 'ASSIGN_CHANGE',
        old_value: issue.assignee_id || null,
        new_value: dto.assignee_id || null,
      });
    }

    if (dto.due_date !== undefined && dto.due_date !== issue.due_date) {
      activities.push({
        issue_id: id,
        actor_id: userId,
        action_type: 'DUE_DATE_CHANGE',
        old_value: issue.due_date || null,
        new_value: dto.due_date || null,
      });
    }

    // Update issue
    const { data: updatedIssue, error } = await supabaseAdmin
      .from('issues')
      .update({
        ...dto,
        updated_at: new Date(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new InternalServerErrorException(error.message);

    // Record activities
    if (activities.length > 0) {
      const { error: activitiesError } = await supabaseAdmin
        .from('issue_activities')
        .insert(activities);

      if (activitiesError) {
        // Log error but don't fail the update
        console.error('Failed to record activities:', activitiesError);
      }
    }

    // Update labels if provided
    if (labelIds !== undefined) {
      // Get current labels
      const { data: currentLabels } = await supabaseAdmin
        .from('issue_labels')
        .select('label_id')
        .eq('issue_id', id);

      const currentLabelIds = (currentLabels || []).map((cl: any) => cl.label_id);

      // Find labels to add and remove
      const labelsToAdd = labelIds.filter((lid) => !currentLabelIds.includes(lid));
      const labelsToRemove = currentLabelIds.filter((lid) => !labelIds.includes(lid));

      // Remove labels
      if (labelsToRemove.length > 0) {
        const { error: removeError } = await supabaseAdmin
          .from('issue_labels')
          .delete()
          .eq('issue_id', id)
          .in('label_id', labelsToRemove);

        if (removeError) {
          throw new InternalServerErrorException(`Failed to remove labels: ${removeError.message}`);
        }
      }

      // Add labels
      if (labelsToAdd.length > 0) {
        const issueLabels = labelsToAdd.map((labelId) => ({
          issue_id: id,
          label_id: labelId,
        }));

        const { error: addError } = await supabaseAdmin
          .from('issue_labels')
          .insert(issueLabels);

        if (addError) {
          throw new InternalServerErrorException(`Failed to add labels: ${addError.message}`);
        }
      }

      // Track label changes if there are any
      if (labelsToAdd.length > 0 || labelsToRemove.length > 0) {
        const { error: labelActivityError } = await supabaseAdmin
          .from('issue_activities')
          .insert({
            issue_id: id,
            actor_id: userId,
            action_type: 'LABELS_CHANGE',
            old_value: JSON.stringify(currentLabelIds),
            new_value: JSON.stringify(labelIds),
          });

        if (labelActivityError) {
          console.error('Failed to record label activity:', labelActivityError);
        }
      }
    }

    // Return updated issue with labels
    const { data: issueWithLabels } = await supabaseAdmin
      .from('issues')
      .select(`
        *,
        assignee:users!assignee_id(id, name, avatar_url),
        reporter:users!reporter_id(id, name, avatar_url),
        issue_labels(
          label_id,
          labels(
            id,
            name,
            color
          )
        )
      `)
      .eq('id', id)
      .single();

    // Transform labels
    if (issueWithLabels && issueWithLabels.issue_labels) {
      issueWithLabels.labels = issueWithLabels.issue_labels
        .map((il: any) => il.labels)
        .filter(Boolean);
      delete issueWithLabels.issue_labels;
    }

    // Create notification if assignee changed
    if (dto.assignee_id !== undefined && dto.assignee_id !== issue.assignee_id && dto.assignee_id !== null) {
      await this.notificationsService.createNotification(
        dto.assignee_id,
        'ISSUE_ASSIGNED',
        'Issue Assigned',
        `You have been assigned to issue: ${issue.title}`,
        'ISSUE',
        id,
      );
    }

    return issueWithLabels || updatedIssue;
  }

  async remove(userId: string, id: string) {
    const supabaseAdmin = this.supabaseService.getAdmin();

    const { data: issue } = await supabaseAdmin
      .from('issues')
      .select('*, project:projects(team_id, owner_id)')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (!issue) throw new NotFoundException('Issue not found');

    // Check permissions: Issue owner, project owner, team OWNER, team ADMIN
    const isIssueOwner = issue.reporter_id === userId;
    const isProjectOwner = issue.project.owner_id === userId;

    // Check team membership and role
    const { data: member } = await supabaseAdmin
      .from('team_members')
      .select('role')
      .eq('team_id', issue.project.team_id)
      .eq('user_id', userId)
      .single();

    const isTeamOwnerOrAdmin = member && (member.role === 'OWNER' || member.role === 'ADMIN');

    // Allow delete if: issue owner, project owner, team OWNER, or team ADMIN
    if (!isIssueOwner && !isProjectOwner && !isTeamOwnerOrAdmin) {
      throw new ForbiddenException('Insufficient permissions to delete issue. Only issue owner, project owner, team OWNER, or team ADMIN can delete issues.');
    }

    // Soft delete
    const { error } = await supabaseAdmin
      .from('issues')
      .update({ deleted_at: new Date() })
      .eq('id', id);

    if (error) throw new InternalServerErrorException(error.message);

    return { message: 'Issue deleted successfully' };
  }

  // --- Subtasks ---

  async createSubtask(userId: string, issueId: string, dto: CreateSubtaskDto) {
    const supabaseAdmin = this.supabaseService.getAdmin();

    // Check access to issue
    await this.findOne(userId, issueId); // Re-use findOne for access check

    const { data, error } = await supabaseAdmin
      .from('subtasks')
      .insert({
        issue_id: issueId,
        title: dto.title,
      })
      .select()
      .single();

    if (error) throw new InternalServerErrorException(error.message);

    return data;
  }

  async updateSubtask(userId: string, issueId: string, subtaskId: string, dto: UpdateSubtaskDto) {
    const supabaseAdmin = this.supabaseService.getAdmin();

    // Check access
    await this.findOne(userId, issueId);

    const { data, error } = await supabaseAdmin
      .from('subtasks')
      .update({
        ...dto,
        updated_at: new Date(),
      })
      .eq('id', subtaskId)
      .eq('issue_id', issueId) // Ensure belongs to issue
      .select()
      .single();

    if (error) throw new InternalServerErrorException(error.message);

    return data;
  }

  async removeSubtask(userId: string, issueId: string, subtaskId: string) {
    const supabaseAdmin = this.supabaseService.getAdmin();

    // Check access
    await this.findOne(userId, issueId);

    const { error } = await supabaseAdmin
      .from('subtasks')
      .delete()
      .eq('id', subtaskId)
      .eq('issue_id', issueId);

    if (error) throw new InternalServerErrorException(error.message);

    return { message: 'Subtask deleted successfully' };
  }

  // --- Comments ---

  async createComment(userId: string, issueId: string, dto: CreateCommentDto) {
    const supabaseAdmin = this.supabaseService.getAdmin();

    // Check access
    await this.findOne(userId, issueId);

    const { data, error } = await supabaseAdmin
      .from('comments')
      .insert({
        issue_id: issueId,
        user_id: userId,
        content: dto.content,
      })
      .select('*, user:users(id, name, avatar_url)')
      .single();

    if (error) throw new InternalServerErrorException(error.message);

    // Invalidate comment summary cache when new comment is added
    await supabaseAdmin
      .from('comment_summaries')
      .delete()
      .eq('issue_id', issueId);

    // Get issue details for notifications
    const { data: issue } = await supabaseAdmin
      .from('issues')
      .select('reporter_id, assignee_id, title')
      .eq('id', issueId)
      .single();

    if (issue) {
      // Notify issue owner (if not the commenter)
      if (issue.reporter_id && issue.reporter_id !== userId) {
        await this.notificationsService.createNotification(
          issue.reporter_id,
          'COMMENT_ADDED',
          'New Comment',
          `A new comment was added to issue: ${issue.title}`,
          'ISSUE',
          issueId,
        );
      }

      // Notify assignee (if not the commenter and not the owner)
      if (issue.assignee_id && issue.assignee_id !== userId && issue.assignee_id !== issue.reporter_id) {
        await this.notificationsService.createNotification(
          issue.assignee_id,
          'COMMENT_ADDED',
          'New Comment',
          `A new comment was added to issue: ${issue.title}`,
          'ISSUE',
          issueId,
        );
      }
    }

    return data;
  }

  async getComments(userId: string, issueId: string) {
    const supabaseAdmin = this.supabaseService.getAdmin();

    // Check access
    await this.findOne(userId, issueId);

    const { data, error } = await supabaseAdmin
      .from('comments')
      .select('*, user:users(id, name, avatar_url)')
      .eq('issue_id', issueId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (error) throw new InternalServerErrorException(error.message);

    return data;
  }

  async updateComment(userId: string, issueId: string, commentId: string, dto: UpdateCommentDto) {
    const supabaseAdmin = this.supabaseService.getAdmin();

    // Check access to issue
    await this.findOne(userId, issueId);

    // Get comment
    const { data: comment } = await supabaseAdmin
      .from('comments')
      .select('user_id')
      .eq('id', commentId)
      .is('deleted_at', null)
      .single();
      
    if (!comment) throw new NotFoundException('Comment not found');

    // Check permissions: Only comment author can update
    if (comment.user_id !== userId) {
      throw new ForbiddenException('You can only update your own comments');
    }

    // Update comment
    const { data, error } = await supabaseAdmin
      .from('comments')
      .update({
        content: dto.content,
        updated_at: new Date(),
      })
      .eq('id', commentId)
      .select('*, user:users(id, name, avatar_url)')
      .single();

    if (error) throw new InternalServerErrorException(error.message);

    return data;
  }

  async removeComment(userId: string, issueId: string, commentId: string) {
    const supabaseAdmin = this.supabaseService.getAdmin();

    // Check access to issue
    const { data: issue } = await supabaseAdmin
      .from('issues')
      .select('*, project:projects(team_id, owner_id)')
      .eq('id', issueId)
      .is('deleted_at', null)
      .single();

    if (!issue) throw new NotFoundException('Issue not found');

    // Get comment
    const { data: comment } = await supabaseAdmin
      .from('comments')
      .select('user_id')
      .eq('id', commentId)
      .eq('issue_id', issueId)
      .single();
      
    if (!comment) throw new NotFoundException('Comment not found');

    // Check permissions: Comment author, issue owner, project owner, team OWNER, team ADMIN
    const isCommentAuthor = comment.user_id === userId;
    const isIssueOwner = issue.reporter_id === userId;
    const isProjectOwner = issue.project.owner_id === userId;

    // Check team membership and role
    const { data: member } = await supabaseAdmin
      .from('team_members')
      .select('role')
      .eq('team_id', issue.project.team_id)
      .eq('user_id', userId)
      .single();

    const isTeamOwnerOrAdmin = member && (member.role === 'OWNER' || member.role === 'ADMIN');

    // Allow delete if: comment author, issue owner, project owner, team OWNER, or team ADMIN
    if (!isCommentAuthor && !isIssueOwner && !isProjectOwner && !isTeamOwnerOrAdmin) {
      throw new ForbiddenException('Insufficient permissions to delete comment. Only comment author, issue owner, project owner, team OWNER, or team ADMIN can delete comments.');
    }

    const { error } = await supabaseAdmin
      .from('comments')
      .delete()
      .eq('id', commentId);

    if (error) throw new InternalServerErrorException(error.message);

    return { message: 'Comment deleted successfully' };
  }
}
