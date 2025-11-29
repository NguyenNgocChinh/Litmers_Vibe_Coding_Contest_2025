import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async createNotification(
    userId: string,
    type: string,
    title: string,
    message: string,
    relatedEntityType?: string,
    relatedEntityId?: string,
  ) {
    const supabaseAdmin = this.supabaseService.getAdmin();

    const { data, error } = await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: userId,
        type,
        title,
        message,
        related_entity_type: relatedEntityType,
        related_entity_id: relatedEntityId,
        is_read: false,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create notification:', error);
      return null;
    }

    return data;
  }

  async getNotifications(userId: string, limit: number = 50, offset: number = 0) {
    const supabaseAdmin = this.supabaseService.getAdmin();

    const { data: notifications, error } = await supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error('Failed to fetch notifications');
    }

    // Get unread count
    const { count } = await supabaseAdmin
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    return {
      notifications: notifications || [],
      unreadCount: count || 0,
      total: count || 0,
    };
  }

  async markAsRead(userId: string, notificationId: string) {
    const supabaseAdmin = this.supabaseService.getAdmin();

    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
      .eq('user_id', userId);

    if (error) {
      throw new Error('Failed to mark notification as read');
    }

    return { message: 'Notification marked as read' };
  }

  async markAllAsRead(userId: string) {
    const supabaseAdmin = this.supabaseService.getAdmin();

    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) {
      throw new Error('Failed to mark all notifications as read');
    }

    return { message: 'All notifications marked as read' };
  }

  async checkDueDates() {
    const supabaseAdmin = this.supabaseService.getAdmin();

    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    // Get issues due today
    const { data: issuesDueToday } = await supabaseAdmin
      .from('issues')
      .select('id, title, assignee_id, due_date')
      .not('assignee_id', 'is', null)
      .is('deleted_at', null)
      .gte('due_date', today.toISOString())
      .lt('due_date', tomorrow.toISOString());

    // Get issues due tomorrow (approaching)
    const dayAfterTomorrow = new Date(tomorrow);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

    const { data: issuesDueSoon } = await supabaseAdmin
      .from('issues')
      .select('id, title, assignee_id, due_date')
      .not('assignee_id', 'is', null)
      .is('deleted_at', null)
      .gte('due_date', tomorrow.toISOString())
      .lt('due_date', dayAfterTomorrow.toISOString());

    // Create notifications for issues due today
    if (issuesDueToday) {
      for (const issue of issuesDueToday) {
        if (issue.assignee_id) {
          // Check if notification already exists
          const { data: existing } = await supabaseAdmin
            .from('notifications')
            .select('id')
            .eq('user_id', issue.assignee_id)
            .eq('type', 'DUE_DATE_TODAY')
            .eq('related_entity_id', issue.id)
            .eq('is_read', false)
            .single();

          if (!existing) {
            await this.createNotification(
              issue.assignee_id,
              'DUE_DATE_TODAY',
              'Due Date Today',
              `Issue "${issue.title}" is due today`,
              'ISSUE',
              issue.id,
            );
          }
        }
      }
    }

    // Create notifications for issues due tomorrow
    if (issuesDueSoon) {
      for (const issue of issuesDueSoon) {
        if (issue.assignee_id) {
          // Check if notification already exists
          const { data: existing } = await supabaseAdmin
            .from('notifications')
            .select('id')
            .eq('user_id', issue.assignee_id)
            .eq('type', 'DUE_DATE_APPROACHING')
            .eq('related_entity_id', issue.id)
            .eq('is_read', false)
            .single();

          if (!existing) {
            await this.createNotification(
              issue.assignee_id,
              'DUE_DATE_APPROACHING',
              'Due Date Approaching',
              `Issue "${issue.title}" is due tomorrow`,
              'ISSUE',
              issue.id,
            );
          }
        }
      }
    }

    return { message: 'Due date notifications checked' };
  }
}
