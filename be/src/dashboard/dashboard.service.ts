import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class DashboardService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async getPersonalDashboard(userId: string) {
    const supabaseAdmin = this.supabaseService.getAdmin();

    // Get assigned issues
    const { data: assignedIssues } = await supabaseAdmin
      .from('issues')
      .select('id, title, status, priority, due_date, project_id, project:projects(name, team_id)')
      .eq('assignee_id', userId)
      .is('deleted_at', null);

    // Categorize by status
    const issuesByStatus: Record<string, any[]> = {
      Backlog: [],
      'In Progress': [],
      Done: [],
    };

    (assignedIssues || []).forEach((issue: any) => {
      const status = issue.status || 'Backlog';
      if (!issuesByStatus[status]) {
        issuesByStatus[status] = [];
      }
      issuesByStatus[status].push(issue);
    });

    // Total count
    const totalAssigned = assignedIssues?.length || 0;

    // Issues due soon (within 7 days)
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    const now = new Date();

    const dueSoon = (assignedIssues || []).filter((issue: any) => {
      if (!issue.due_date) return false;
      const dueDate = new Date(issue.due_date);
      return dueDate >= now && dueDate <= sevenDaysFromNow;
    });

    // Issues due today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const dueToday = (assignedIssues || []).filter((issue: any) => {
      if (!issue.due_date) return false;
      const dueDate = new Date(issue.due_date);
      return dueDate >= today && dueDate < tomorrow;
    });

    // My recent comments (max 5)
    const { data: recentComments } = await supabaseAdmin
      .from('comments')
      .select('id, content, created_at, issue_id, issue:issues(title, project_id)')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(5);

    // My teams/projects list
    const { data: teams } = await supabaseAdmin
      .from('team_members')
      .select('team_id, teams(id, name)')
      .eq('user_id', userId);

    const teamIds = (teams || []).map((t: any) => t.team_id);

    const { data: projects } = await supabaseAdmin
      .from('projects')
      .select('id, name, team_id, teams(name)')
      .in('team_id', teamIds)
      .is('deleted_at', null)
      .eq('is_archived', false);

    return {
      assignedIssues: issuesByStatus,
      totalAssigned,
      dueSoon,
      dueToday,
      recentComments: recentComments || [],
      teams: (teams || []).map((t: any) => t.teams),
      projects: projects || [],
    };
  }
}

