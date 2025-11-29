import { Injectable, InternalServerErrorException, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateLabelDto } from './dto/create-label.dto';
import { UpdateLabelDto } from './dto/update-label.dto';
import { MAX_LABELS_PER_PROJECT, MAX_LABELS_PER_ISSUE } from '../common/constants/limits';

@Injectable()
export class LabelService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async findAll(userId: string, projectId: string) {
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

    // Get all labels for this project
    const { data, error } = await supabaseAdmin
      .from('labels')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });

    if (error) throw new InternalServerErrorException(error.message);

    return data || [];
  }

  async create(userId: string, projectId: string, dto: CreateLabelDto) {
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

    // Check max labels per project
    const { count, error: countError } = await supabaseAdmin
      .from('labels')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId);

    if (countError) throw new InternalServerErrorException(countError.message);

    if (count !== null && count >= MAX_LABELS_PER_PROJECT) {
      throw new BadRequestException(`Maximum ${MAX_LABELS_PER_PROJECT} labels per project`);
    }

    // Check if label name already exists in this project
    const { data: existing } = await supabaseAdmin
      .from('labels')
      .select('id')
      .eq('project_id', projectId)
      .eq('name', dto.name)
      .single();

    if (existing) {
      throw new BadRequestException('Label with this name already exists in this project');
    }

    // Create label
    const { data, error } = await supabaseAdmin
      .from('labels')
      .insert({
        project_id: projectId,
        name: dto.name,
        color: dto.color,
      })
      .select()
      .single();

    if (error) throw new InternalServerErrorException(error.message);

    return data;
  }

  async update(userId: string, projectId: string, labelId: string, dto: UpdateLabelDto) {
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

    // Check label exists and belongs to project
    const { data: label } = await supabaseAdmin
      .from('labels')
      .select('*')
      .eq('id', labelId)
      .eq('project_id', projectId)
      .single();

    if (!label) throw new NotFoundException('Label not found');

    // Check if new name conflicts with existing label
    if (dto.name && dto.name !== label.name) {
      const { data: existing } = await supabaseAdmin
        .from('labels')
        .select('id')
        .eq('project_id', projectId)
        .eq('name', dto.name)
        .neq('id', labelId)
        .single();

      if (existing) {
        throw new BadRequestException('Label with this name already exists in this project');
      }
    }

    // Update label
    const { data, error } = await supabaseAdmin
      .from('labels')
      .update({
        ...dto,
      })
      .eq('id', labelId)
      .select()
      .single();

    if (error) throw new InternalServerErrorException(error.message);

    return data;
  }

  async remove(userId: string, projectId: string, labelId: string) {
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

    // Check label exists and belongs to project
    const { data: label } = await supabaseAdmin
      .from('labels')
      .select('id')
      .eq('id', labelId)
      .eq('project_id', projectId)
      .single();

    if (!label) throw new NotFoundException('Label not found');

    // Delete label (cascade will remove from issue_labels)
    const { error } = await supabaseAdmin
      .from('labels')
      .delete()
      .eq('id', labelId);

    if (error) throw new InternalServerErrorException(error.message);

    return { message: 'Label deleted successfully' };
  }

  async assignToIssue(userId: string, issueId: string, labelId: string) {
    const supabaseAdmin = this.supabaseService.getAdmin();

    // Check access to issue
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

    // Check label exists and belongs to project
    const { data: label } = await supabaseAdmin
      .from('labels')
      .select('id')
      .eq('id', labelId)
      .eq('project_id', issue.project.id)
      .single();

    if (!label) throw new NotFoundException('Label not found or does not belong to this project');

    // Check if label is already assigned
    const { data: existing } = await supabaseAdmin
      .from('issue_labels')
      .select('label_id')
      .eq('issue_id', issueId)
      .eq('label_id', labelId)
      .single();

    if (existing) {
      throw new BadRequestException('Label is already assigned to this issue');
    }

    // Check max labels per issue
    const { count, error: countError } = await supabaseAdmin
      .from('issue_labels')
      .select('*', { count: 'exact', head: true })
      .eq('issue_id', issueId);

    if (countError) throw new InternalServerErrorException(countError.message);

    if (count !== null && count >= MAX_LABELS_PER_ISSUE) {
      throw new BadRequestException(`Maximum ${MAX_LABELS_PER_ISSUE} labels per issue`);
    }

    // Assign label
    const { data, error } = await supabaseAdmin
      .from('issue_labels')
      .insert({
        issue_id: issueId,
        label_id: labelId,
      })
      .select()
      .single();

    if (error) throw new InternalServerErrorException(error.message);

    return { message: 'Label assigned successfully', data };
  }

  async removeFromIssue(userId: string, issueId: string, labelId: string) {
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

    // Check if label is assigned
    const { data: existing } = await supabaseAdmin
      .from('issue_labels')
      .select('label_id')
      .eq('issue_id', issueId)
      .eq('label_id', labelId)
      .single();

    if (!existing) {
      throw new NotFoundException('Label is not assigned to this issue');
    }

    // Remove label
    const { error } = await supabaseAdmin
      .from('issue_labels')
      .delete()
      .eq('issue_id', issueId)
      .eq('label_id', labelId);

    if (error) throw new InternalServerErrorException(error.message);

    return { message: 'Label removed successfully' };
  }
}

