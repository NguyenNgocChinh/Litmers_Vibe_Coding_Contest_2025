import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { IssueService } from './issue.service';
import { CreateIssueDto } from './dto/create-issue.dto';
import { UpdateIssueDto } from './dto/update-issue.dto';
import { CreateSubtaskDto } from './dto/create-subtask.dto';
import { UpdateSubtaskDto } from './dto/update-subtask.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { FilterIssuesDto } from './dto/filter-issues.dto';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { LabelService } from '../label/label.service';

@Controller('issues')
@UseGuards(AuthGuard)
export class IssueController {
  constructor(
    private readonly issueService: IssueService,
    private readonly labelService: LabelService,
  ) {}

  @Post()
  create(@CurrentUser() user: any, @Body() createIssueDto: CreateIssueDto) {
    return this.issueService.create(user.id, createIssueDto);
  }

  @Get()
  findAll(@CurrentUser() user: any, @Query('project_id') projectId: string, @Query() filters: FilterIssuesDto) {
    return this.issueService.findAll(user.id, projectId, filters);
  }

  @Get(':id')
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.issueService.findOne(user.id, id);
  }

  @Patch(':id')
  update(@CurrentUser() user: any, @Param('id') id: string, @Body() updateIssueDto: UpdateIssueDto) {
    return this.issueService.update(user.id, id, updateIssueDto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.issueService.remove(user.id, id);
  }

  @Post(':id/subtasks')
  createSubtask(@CurrentUser() user: any, @Param('id') issueId: string, @Body() createSubtaskDto: CreateSubtaskDto) {
    return this.issueService.createSubtask(user.id, issueId, createSubtaskDto);
  }

  @Patch(':id/subtasks/:subtaskId')
  updateSubtask(@CurrentUser() user: any, @Param('id') issueId: string, @Param('subtaskId') subtaskId: string, @Body() updateSubtaskDto: UpdateSubtaskDto) {
    return this.issueService.updateSubtask(user.id, issueId, subtaskId, updateSubtaskDto);
  }

  @Delete(':id/subtasks/:subtaskId')
  removeSubtask(@CurrentUser() user: any, @Param('id') issueId: string, @Param('subtaskId') subtaskId: string) {
    return this.issueService.removeSubtask(user.id, issueId, subtaskId);
  }

  @Get(':id/comments')
  getComments(@CurrentUser() user: any, @Param('id') issueId: string) {
    return this.issueService.getComments(user.id, issueId);
  }

  @Post(':id/comments')
  createComment(@CurrentUser() user: any, @Param('id') issueId: string, @Body() createCommentDto: CreateCommentDto) {
    return this.issueService.createComment(user.id, issueId, createCommentDto);
  }

  @Patch(':id/comments/:commentId')
  updateComment(@CurrentUser() user: any, @Param('id') issueId: string, @Param('commentId') commentId: string, @Body() updateCommentDto: UpdateCommentDto) {
    return this.issueService.updateComment(user.id, issueId, commentId, updateCommentDto);
  }

  @Delete(':id/comments/:commentId')
  removeComment(@CurrentUser() user: any, @Param('id') issueId: string, @Param('commentId') commentId: string) {
    return this.issueService.removeComment(user.id, issueId, commentId);
  }

  @Post(':id/labels/:labelId')
  assignLabel(@CurrentUser() user: any, @Param('id') issueId: string, @Param('labelId') labelId: string) {
    return this.labelService.assignToIssue(user.id, issueId, labelId);
  }

  @Delete(':id/labels/:labelId')
  removeLabel(@CurrentUser() user: any, @Param('id') issueId: string, @Param('labelId') labelId: string) {
    return this.labelService.removeFromIssue(user.id, issueId, labelId);
  }

  @Get(':id/history')
  getChangeHistory(@CurrentUser() user: any, @Param('id') issueId: string) {
    return this.issueService.getChangeHistory(user.id, issueId);
  }
}
