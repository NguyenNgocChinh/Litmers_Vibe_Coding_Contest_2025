import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { ProjectService } from './project.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { CreateStatusDto } from './dto/create-status.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('projects')
@UseGuards(AuthGuard)
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Post()
  create(@CurrentUser() user: any, @Body() createProjectDto: CreateProjectDto) {
    return this.projectService.create(user.id, createProjectDto);
  }

  @Get()
  findAll(@CurrentUser() user: any, @Query('team_id') teamId: string) {
    return this.projectService.findAll(user.id, teamId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.projectService.findOne(user.id, id);
  }

  @Patch(':id')
  update(@CurrentUser() user: any, @Param('id') id: string, @Body() updateProjectDto: UpdateProjectDto) {
    return this.projectService.update(user.id, id, updateProjectDto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.projectService.remove(user.id, id);
  }

  @Post(':id/archive')
  archive(@CurrentUser() user: any, @Param('id') id: string) {
    return this.projectService.archive(user.id, id);
  }

  @Post(':id/unarchive')
  unarchive(@CurrentUser() user: any, @Param('id') id: string) {
    return this.projectService.unarchive(user.id, id);
  }

  @Post(':id/favorite')
  toggleFavorite(@CurrentUser() user: any, @Param('id') id: string) {
    return this.projectService.toggleFavorite(user.id, id);
  }

  @Get(':id/statuses')
  getStatuses(@CurrentUser() user: any, @Param('id') id: string) {
    return this.projectService.getStatuses(user.id, id);
  }

  @Post(':id/statuses')
  createStatus(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: CreateStatusDto) {
    return this.projectService.createStatus(user.id, id, dto);
  }

  @Patch(':id/statuses/:statusId')
  updateStatus(@CurrentUser() user: any, @Param('id') id: string, @Param('statusId') statusId: string, @Body() dto: UpdateStatusDto) {
    return this.projectService.updateStatus(user.id, id, statusId, dto);
  }

  @Delete(':id/statuses/:statusId')
  deleteStatus(@CurrentUser() user: any, @Param('id') id: string, @Param('statusId') statusId: string) {
    return this.projectService.deleteStatus(user.id, id, statusId);
  }

  @Get(':id/dashboard')
  getDashboard(@CurrentUser() user: any, @Param('id') id: string) {
    return this.projectService.getDashboard(user.id, id);
  }
}
