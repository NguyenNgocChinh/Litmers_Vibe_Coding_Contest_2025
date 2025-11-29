import { Injectable, InternalServerErrorException, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { CreateStatusDto } from './dto/create-status.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { MAX_CUSTOM_STATUSES_PER_PROJECT } from '../common/constants/limits';

@Injectable()
export class ProjectService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async create(userId: string, dto: CreateProjectDto) {
    const supabaseAdmin = this.supabaseService.getAdmin();

    // 1. Check Team Membership & Permissions (MEMBER can create projects? Usually yes, or ADMIN/OWNER)
    // Let's assume any MEMBER can create a project for now, or restrict to ADMIN/OWNER based on requirements.
    // FR-020: "Create Project (Name, Description, Visibility)"
    // Validation.md: "Max 10 projects per team (Free Plan)"
    
    const { data: member } = await supabaseAdmin
      .from('team_members')
      .select('role')
      .eq('team_id', dto.team_id)
      .eq('user_id', userId)
      .single();

    if (!member) {
      throw new ForbiddenException('You are not a member of this team');
    }

    // 2. Check Project Limit (Validation Rule)
    const { count, error: countError } = await supabaseAdmin
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', dto.team_id)
      .is('deleted_at', null);

    if (countError) {
      throw new InternalServerErrorException(countError.message);
    }

    if (count !== null && count >= 15) {
      throw new BadRequestException('Project limit reached for this team (Max 15)');
    }

    // 3. Create Project
    const { data, error } = await supabaseAdmin
      .from('projects')
      .insert({
        name: dto.name,
        description: dto.description,
        team_id: dto.team_id,
        owner_id: userId, // Creator is owner
      })
      .select()
      .single();

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return data;
  }

  async findAll(userId: string, teamId: string) {
    const supabaseAdmin = this.supabaseService.getAdmin();

    // Check membership
    const { data: member } = await supabaseAdmin
      .from('team_members')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', userId)
      .single();

    if (!member) {
      throw new ForbiddenException('You are not a member of this team');
    }

    // Get projects with favorite status
    const { data: projects, error } = await supabaseAdmin
      .from('projects')
      .select('*')
      .eq('team_id', teamId)
      .is('deleted_at', null)
      .eq('is_archived', false) // Filter out archived projects by default
      .order('created_at', { ascending: false });

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    // Get user's favorites
    const { data: favorites } = await supabaseAdmin
      .from('project_favorites')
      .select('project_id')
      .eq('user_id', userId);

    const favoriteIds = new Set((favorites || []).map((f: any) => f.project_id));

    // Get issue counts for each project
    const projectIds = (projects || []).map((p: any) => p.id);
    const { data: issueCounts } = await supabaseAdmin
      .from('issues')
      .select('project_id')
      .in('project_id', projectIds)
      .is('deleted_at', null);

    const countsByProject = new Map<string, number>();
    (issueCounts || []).forEach((issue: any) => {
      countsByProject.set(issue.project_id, (countsByProject.get(issue.project_id) || 0) + 1);
    });

    // Sort: favorites first, then by creation date
    const sortedProjects = (projects || []).sort((a: any, b: any) => {
      const aIsFavorite = favoriteIds.has(a.id);
      const bIsFavorite = favoriteIds.has(b.id);

      if (aIsFavorite && !bIsFavorite) return -1;
      if (!aIsFavorite && bIsFavorite) return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    // Add is_favorite flag and issue count
    return sortedProjects.map((p: any) => ({
      ...p,
      is_favorite: favoriteIds.has(p.id),
      issue_count: countsByProject.get(p.id) || 0,
    }));
  }

  async findOne(userId: string, id: string) {
    const supabaseAdmin = this.supabaseService.getAdmin();

    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Check membership in the project's team
    const { data: member } = await supabaseAdmin
      .from('team_members')
      .select('role')
      .eq('team_id', project.team_id)
      .eq('user_id', userId)
      .single();

    if (!member) {
      throw new ForbiddenException('You do not have access to this project');
    }

    return project;
  }

  async update(userId: string, id: string, dto: UpdateProjectDto) {
    const supabaseAdmin = this.supabaseService.getAdmin();

    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('*')
      .eq('id', id)
      .single();

    if (!project) throw new NotFoundException('Project not found');

    // Check permissions
    const { data: member } = await supabaseAdmin
      .from('team_members')
      .select('role')
      .eq('team_id', project.team_id)
      .eq('user_id', userId)
      .single();

    if (!member) throw new ForbiddenException('Not a member');

    const isProjectOwner = project.owner_id === userId;
    const isTeamAdmin = member.role === 'ADMIN' || member.role === 'OWNER';

    if (!isProjectOwner && !isTeamAdmin) {
      throw new ForbiddenException('Insufficient permissions to update project');
    }

    const { data, error } = await supabaseAdmin
      .from('projects')
      .update({
        name: dto.name,
        description: dto.description,
        updated_at: new Date(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return data;
  }

  async remove(userId: string, id: string) {
    const supabaseAdmin = this.supabaseService.getAdmin();

    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('*')
      .eq('id', id)
      .single();

    if (!project) throw new NotFoundException('Project not found');

    // Check permissions (Same as update)
    const { data: member } = await supabaseAdmin
      .from('team_members')
      .select('role')
      .eq('team_id', project.team_id)
      .eq('user_id', userId)
      .single();

    if (!member) throw new ForbiddenException('Not a member');

    const isProjectOwner = project.owner_id === userId;
    const isTeamAdmin = member.role === 'ADMIN' || member.role === 'OWNER';

    if (!isProjectOwner && !isTeamAdmin) {
      throw new ForbiddenException('Insufficient permissions to delete project');
    }

    const { error } = await supabaseAdmin
      .from('projects')
      .update({ deleted_at: new Date() })
      .eq('id', id);

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return { message: 'Project deleted successfully' };
  }

  async archive(userId: string, id: string) {
    const supabaseAdmin = this.supabaseService.getAdmin();

    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (!project) throw new NotFoundException('Project not found');

    // Check permissions (Same as update/delete)
    const { data: member } = await supabaseAdmin
      .from('team_members')
      .select('role')
      .eq('team_id', project.team_id)
      .eq('user_id', userId)
      .single();

    if (!member) throw new ForbiddenException('Not a member');

    const isProjectOwner = project.owner_id === userId;
    const isTeamAdmin = member.role === 'ADMIN' || member.role === 'OWNER';

    if (!isProjectOwner && !isTeamAdmin) {
      throw new ForbiddenException('Insufficient permissions to archive project');
    }

    // Check if already archived
    if (project.is_archived) {
      throw new BadRequestException('Project is already archived');
    }

    const { data, error } = await supabaseAdmin
      .from('projects')
      .update({ is_archived: true, updated_at: new Date() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return data;
  }

  async unarchive(userId: string, id: string) {
    const supabaseAdmin = this.supabaseService.getAdmin();

    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (!project) throw new NotFoundException('Project not found');

    // Check permissions (Same as update/delete)
    const { data: member } = await supabaseAdmin
      .from('team_members')
      .select('role')
      .eq('team_id', project.team_id)
      .eq('user_id', userId)
      .single();

    if (!member) throw new ForbiddenException('Not a member');

    const isProjectOwner = project.owner_id === userId;
    const isTeamAdmin = member.role === 'ADMIN' || member.role === 'OWNER';

    if (!isProjectOwner && !isTeamAdmin) {
      throw new ForbiddenException('Insufficient permissions to unarchive project');
    }

    // Check if not archived
    if (!project.is_archived) {
      throw new BadRequestException('Project is not archived');
    }

    const { data, error } = await supabaseAdmin
      .from('projects')
      .update({ is_archived: false, updated_at: new Date() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return data;
  }

  async toggleFavorite(userId: string, projectId: string) {
    const supabaseAdmin = this.supabaseService.getAdmin();

    // Check access to project
    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('team_id')
      .eq('id', projectId)
      .is('deleted_at', null)
      .single();

    if (!project) throw new NotFoundException('Project not found');

    // Check membership
    const { data: member } = await supabaseAdmin
      .from('team_members')
      .select('role')
      .eq('team_id', project.team_id)
      .eq('user_id', userId)
      .single();

    if (!member) throw new ForbiddenException('Not a member');

    // Check if already favorited
    const { data: existing } = await supabaseAdmin
      .from('project_favorites')
      .select('user_id')
      .eq('user_id', userId)
      .eq('project_id', projectId)
      .single();

    if (existing) {
      // Remove favorite
      const { error } = await supabaseAdmin
        .from('project_favorites')
        .delete()
        .eq('user_id', userId)
        .eq('project_id', projectId);

      if (error) {
        throw new InternalServerErrorException('Failed to remove favorite');
      }

      return { message: 'Favorite removed', isFavorite: false };
    } else {
      // Add favorite
      const { error } = await supabaseAdmin
        .from('project_favorites')
        .insert({
          user_id: userId,
          project_id: projectId,
        });

      if (error) {
        throw new InternalServerErrorException('Failed to add favorite');
      }

      return { message: 'Favorite added', isFavorite: true };
    }
  }

  async getStatuses(userId: string, projectId: string) {
    const supabaseAdmin = this.supabaseService.getAdmin();

    // Check access
    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('team_id')
      .eq('id', projectId)
      .is('deleted_at', null)
      .single();

    if (!project) throw new NotFoundException('Project not found');

    const { data: member } = await supabaseAdmin
      .from('team_members')
      .select('role')
      .eq('team_id', project.team_id)
      .eq('user_id', userId)
      .single();

    if (!member) throw new ForbiddenException('Not a member');

    const { data: statuses, error } = await supabaseAdmin
      .from('project_statuses')
      .select('*')
      .eq('project_id', projectId)
      .order('position', { ascending: true });

    if (error) {
      throw new InternalServerErrorException('Failed to fetch statuses');
    }

    return statuses || [];
  }

  async createStatus(userId: string, projectId: string, dto: CreateStatusDto) {
    const supabaseAdmin = this.supabaseService.getAdmin();

    // Check access and permissions (OWNER, ADMIN, or project owner)
    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('team_id, owner_id')
      .eq('id', projectId)
      .is('deleted_at', null)
      .single();

    if (!project) throw new NotFoundException('Project not found');

    const { data: member } = await supabaseAdmin
      .from('team_members')
      .select('role')
      .eq('team_id', project.team_id)
      .eq('user_id', userId)
      .single();

    if (!member) throw new ForbiddenException('Not a member');

    const isProjectOwner = project.owner_id === userId;
    const isTeamAdmin = member.role === 'ADMIN' || member.role === 'OWNER';

    if (!isProjectOwner && !isTeamAdmin) {
      throw new ForbiddenException('Insufficient permissions to create status');
    }

    // Check limit
    const { count } = await supabaseAdmin
      .from('project_statuses')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId);

    if (count !== null && count >= MAX_CUSTOM_STATUSES_PER_PROJECT) {
      throw new BadRequestException(`Maximum ${MAX_CUSTOM_STATUSES_PER_PROJECT} custom statuses allowed per project`);
    }

    // Check if status name already exists
    const { data: existing } = await supabaseAdmin
      .from('project_statuses')
      .select('id')
      .eq('project_id', projectId)
      .eq('name', dto.name)
      .single();

    if (existing) {
      throw new BadRequestException('Status with this name already exists');
    }

    // Get max position
    const { data: statuses } = await supabaseAdmin
      .from('project_statuses')
      .select('position')
      .eq('project_id', projectId)
      .order('position', { ascending: false })
      .limit(1);

    const maxPosition = statuses && statuses.length > 0 ? statuses[0].position : -1;
    const position = dto.position !== undefined ? dto.position : maxPosition + 1;

    const { data, error } = await supabaseAdmin
      .from('project_statuses')
      .insert({
        project_id: projectId,
        name: dto.name,
        color: dto.color || '#6B7280',
        position: position,
      })
      .select()
      .single();

    if (error) {
      throw new InternalServerErrorException('Failed to create status');
    }

    return data;
  }

  async updateStatus(userId: string, projectId: string, statusId: string, dto: UpdateStatusDto) {
    const supabaseAdmin = this.supabaseService.getAdmin();

    // Check access and permissions
    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('team_id, owner_id')
      .eq('id', projectId)
      .is('deleted_at', null)
      .single();

    if (!project) throw new NotFoundException('Project not found');

    const { data: member } = await supabaseAdmin
      .from('team_members')
      .select('role')
      .eq('team_id', project.team_id)
      .eq('user_id', userId)
      .single();

    if (!member) throw new ForbiddenException('Not a member');

    const isProjectOwner = project.owner_id === userId;
    const isTeamAdmin = member.role === 'ADMIN' || member.role === 'OWNER';

    if (!isProjectOwner && !isTeamAdmin) {
      throw new ForbiddenException('Insufficient permissions to update status');
    }

    // Check if status exists and belongs to project
    const { data: status } = await supabaseAdmin
      .from('project_statuses')
      .select('*')
      .eq('id', statusId)
      .eq('project_id', projectId)
      .single();

    if (!status) throw new NotFoundException('Status not found');

    // If name is being updated, check for duplicates
    if (dto.name && dto.name !== status.name) {
      const { data: existing } = await supabaseAdmin
        .from('project_statuses')
        .select('id')
        .eq('project_id', projectId)
        .eq('name', dto.name)
        .neq('id', statusId)
        .single();

      if (existing) {
        throw new BadRequestException('Status with this name already exists');
      }
    }

    const updateData: any = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.color !== undefined) updateData.color = dto.color;
    if (dto.position !== undefined) updateData.position = dto.position;
    if (dto.wipLimit !== undefined) updateData.wip_limit = dto.wipLimit;

    const { data, error } = await supabaseAdmin
      .from('project_statuses')
      .update(updateData)
      .eq('id', statusId)
      .select()
      .single();

    if (error) {
      throw new InternalServerErrorException('Failed to update status');
    }

    return data;
  }

  async deleteStatus(userId: string, projectId: string, statusId: string) {
    const supabaseAdmin = this.supabaseService.getAdmin();

    // Check access and permissions
    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('team_id, owner_id')
      .eq('id', projectId)
      .is('deleted_at', null)
      .single();

    if (!project) throw new NotFoundException('Project not found');

    const { data: member } = await supabaseAdmin
      .from('team_members')
      .select('role')
      .eq('team_id', project.team_id)
      .eq('user_id', userId)
      .single();

    if (!member) throw new ForbiddenException('Not a member');

    const isProjectOwner = project.owner_id === userId;
    const isTeamAdmin = member.role === 'ADMIN' || member.role === 'OWNER';

    if (!isProjectOwner && !isTeamAdmin) {
      throw new ForbiddenException('Insufficient permissions to delete status');
    }

    // Check if status exists and belongs to project
    const { data: status } = await supabaseAdmin
      .from('project_statuses')
      .select('name')
      .eq('id', statusId)
      .eq('project_id', projectId)
      .single();

    if (!status) throw new NotFoundException('Status not found');

    // Move all issues with this status to Backlog
    await supabaseAdmin
      .from('issues')
      .update({ status: 'Backlog' })
      .eq('project_id', projectId)
      .eq('status', status.name);

    // Delete status
    const { error } = await supabaseAdmin
      .from('project_statuses')
      .delete()
      .eq('id', statusId);

    if (error) {
      throw new InternalServerErrorException('Failed to delete status');
    }

    return { message: 'Status deleted successfully. Issues moved to Backlog.' };
  }

  async getDashboard(userId: string, projectId: string) {
    const supabaseAdmin = this.supabaseService.getAdmin();

    // Check access
    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('team_id')
      .eq('id', projectId)
      .is('deleted_at', null)
      .single();

    if (!project) throw new NotFoundException('Project not found');

    const { data: member } = await supabaseAdmin
      .from('team_members')
      .select('role')
      .eq('team_id', project.team_id)
      .eq('user_id', userId)
      .single();

    if (!member) throw new ForbiddenException('Not a member');

    // Get all issues
    const { data: issues } = await supabaseAdmin
      .from('issues')
      .select('status, priority, due_date, created_at')
      .eq('project_id', projectId)
      .is('deleted_at', null);

    // Count by status
    const countByStatus: Record<string, number> = {};
    const countByPriority: Record<string, number> = { HIGH: 0, MEDIUM: 0, LOW: 0 };
    const total = issues?.length || 0;
    let doneCount = 0;

    (issues || []).forEach((issue: any) => {
      // Count by status
      countByStatus[issue.status] = (countByStatus[issue.status] || 0) + 1;
      if (issue.status === 'Done') doneCount++;

      // Count by priority
      if (issue.priority) {
        countByPriority[issue.priority] = (countByPriority[issue.priority] || 0) + 1;
      }
    });

    // Completion rate
    const completionRate = total > 0 ? (doneCount / total) * 100 : 0;

    // Recently created issues (max 5)
    const recentlyCreated = (issues || [])
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5)
      .map((issue: any) => issue.id);

    // Issues due soon (within 7 days, max 5)
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    const now = new Date();

    const dueSoon = (issues || [])
      .filter((issue: any) => {
        if (!issue.due_date) return false;
        const dueDate = new Date(issue.due_date);
        return dueDate >= now && dueDate <= sevenDaysFromNow;
      })
      .sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
      .slice(0, 5)
      .map((issue: any) => issue.id);

    // Get full issue details for recently created and due soon
    const { data: recentIssues } = await supabaseAdmin
      .from('issues')
      .select('id, title, status, priority, due_date, created_at')
      .in('id', [...recentlyCreated, ...dueSoon])
      .is('deleted_at', null);

    return {
      countByStatus,
      countByPriority,
      completionRate: Math.round(completionRate * 100) / 100,
      total,
      doneCount,
      recentlyCreated: recentIssues?.filter((i: any) => recentlyCreated.includes(i.id)) || [],
      dueSoon: recentIssues?.filter((i: any) => dueSoon.includes(i.id)) || [],
    };
  }
}
