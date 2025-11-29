import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SupabaseModule } from './supabase/supabase.module';
import { AuthModule } from './auth/auth.module';
import { TeamModule } from './team/team.module';
import { ProjectModule } from './project/project.module';
import { IssueModule } from './issue/issue.module';
import { KanbanModule } from './kanban/kanban.module';
import { AiModule } from './ai/ai.module';
import { EmailModule } from './email/email.module';
import { SeedModule } from './seed/seed.module';
import { LabelModule } from './label/label.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SupabaseModule,
    AuthModule,
    TeamModule,
    ProjectModule,
    IssueModule,
    KanbanModule,
    AiModule,
    EmailModule,
    SeedModule,
    LabelModule,
    DashboardModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
