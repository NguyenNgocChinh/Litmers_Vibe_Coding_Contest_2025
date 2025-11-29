import { Controller, Get, Patch, Post, Param, Query, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('notifications')
@UseGuards(AuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  getNotifications(
    @CurrentUser() user: any,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.notificationsService.getNotifications(
      user.id,
      limit ? parseInt(limit, 10) : 50,
      offset ? parseInt(offset, 10) : 0,
    );
  }

  @Patch(':id/read')
  markAsRead(@CurrentUser() user: any, @Param('id') id: string) {
    return this.notificationsService.markAsRead(user.id, id);
  }

  @Post('mark-all-read')
  markAllAsRead(@CurrentUser() user: any) {
    return this.notificationsService.markAllAsRead(user.id);
  }

  @Post('check-due-dates')
  checkDueDates(@CurrentUser() user: any) {
    // This can be called by a scheduled job or manually
    return this.notificationsService.checkDueDates();
  }
}

