import { Module } from '@nestjs/common';
import { TeamService } from './team.service';
import { TeamController } from './team.controller';
import { EmailModule } from '../email/email.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [EmailModule, NotificationsModule],
  controllers: [TeamController],
  providers: [TeamService],
})
export class TeamModule {}
