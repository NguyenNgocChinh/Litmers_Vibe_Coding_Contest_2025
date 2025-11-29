import { Module } from '@nestjs/common';
import { IssueService } from './issue.service';
import { IssueController } from './issue.controller';
import { LabelModule } from '../label/label.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [LabelModule, NotificationsModule],
  controllers: [IssueController],
  providers: [IssueService],
})
export class IssueModule {}
