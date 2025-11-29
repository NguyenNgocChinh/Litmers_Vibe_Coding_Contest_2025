import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { LabelService } from './label.service';
import { CreateLabelDto } from './dto/create-label.dto';
import { UpdateLabelDto } from './dto/update-label.dto';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('projects/:projectId/labels')
@UseGuards(AuthGuard)
export class LabelController {
  constructor(private readonly labelService: LabelService) {}

  @Get()
  findAll(@CurrentUser() user: any, @Param('projectId') projectId: string) {
    return this.labelService.findAll(user.id, projectId);
  }

  @Post()
  create(@CurrentUser() user: any, @Param('projectId') projectId: string, @Body() createLabelDto: CreateLabelDto) {
    return this.labelService.create(user.id, projectId, createLabelDto);
  }

  @Patch(':labelId')
  update(@CurrentUser() user: any, @Param('projectId') projectId: string, @Param('labelId') labelId: string, @Body() updateLabelDto: UpdateLabelDto) {
    return this.labelService.update(user.id, projectId, labelId, updateLabelDto);
  }

  @Delete(':labelId')
  remove(@CurrentUser() user: any, @Param('projectId') projectId: string, @Param('labelId') labelId: string) {
    return this.labelService.remove(user.id, projectId, labelId);
  }
}

