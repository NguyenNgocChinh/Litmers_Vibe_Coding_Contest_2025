import { Controller, Get, Patch, Body, Param, UseGuards, Query, Post } from '@nestjs/common';
import { KanbanService } from './kanban.service';
import { UpdateIssueStatusDto } from './dto/update-issue-status.dto';
import { UpdateIssuePositionDto } from './dto/update-issue-position.dto';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('kanban')
@UseGuards(AuthGuard)
export class KanbanController {
  constructor(private readonly kanbanService: KanbanService) {}

  @Get()
  getBoard(@CurrentUser() user: any, @Query('project_id') projectId: string) {
    return this.kanbanService.getBoard(user.id, projectId);
  }

  @Patch('issues/:id/status')
  updateIssueStatus(@CurrentUser() user: any, @Param('id') issueId: string, @Body() dto: UpdateIssueStatusDto) {
    return this.kanbanService.updateIssueStatus(user.id, issueId, dto);
  }

  @Patch('issues/:id/position')
  updateIssuePosition(@CurrentUser() user: any, @Param('id') issueId: string, @Body() dto: UpdateIssuePositionDto) {
    return this.kanbanService.updateIssuePosition(user.id, issueId, dto.position);
  }

  @Post('issues/reorder')
  updateMultipleIssuePositions(@CurrentUser() user: any, @Body() body: { updates: Array<{ issueId: string; position: number; status: string }> }) {
    return this.kanbanService.updateMultipleIssuePositions(user.id, body.updates);
  }
}
