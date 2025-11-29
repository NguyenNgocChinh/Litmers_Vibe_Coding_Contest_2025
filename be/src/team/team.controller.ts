import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  HttpException,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { TeamService } from './team.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TeamRole } from './dto/update-member-role.dto';
import { DomainError } from '../common/errors/domain-error';
import type { User } from '@supabase/auth-js';

@Controller('teams')
@UseGuards(AuthGuard)
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @Post()
  async create(
    @CurrentUser() user: User,
    @Body() createTeamDto: CreateTeamDto,
  ) {
    try {
      return await this.teamService.create(user.id, createTeamDto);
    } catch (error) {
      this.handleError(error);
    }
  }

  @Get()
  async findAll(@CurrentUser() user: User) {
    try {
      return await this.teamService.findAll(user.id);
    } catch (error) {
      this.handleError(error);
    }
  }

  @Get(':id')
  async findOne(@CurrentUser() user: User, @Param('id') id: string) {
    try {
      return await this.teamService.findOne(user.id, id);
    } catch (error) {
      this.handleError(error);
    }
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() updateTeamDto: UpdateTeamDto,
  ) {
    try {
      return await this.teamService.update(user.id, id, updateTeamDto);
    } catch (error) {
      this.handleError(error);
    }
  }

  @Delete(':id')
  async remove(@CurrentUser() user: User, @Param('id') id: string) {
    try {
      return await this.teamService.remove(user.id, id);
    } catch (error) {
      this.handleError(error);
    }
  }

  @Get(':id/members')
  async getMembers(@CurrentUser() user: User, @Param('id') teamId: string) {
    try {
      return await this.teamService.getMembers(user.id, teamId);
    } catch (error) {
      this.handleError(error);
    }
  }

  @Post(':id/members')
  async inviteMember(
    @CurrentUser() user: User,
    @Param('id') teamId: string,
    @Body('email') email: string,
  ) {
    try {
      return await this.teamService.inviteMember(user.id, teamId, email);
    } catch (error) {
      this.handleError(error);
    }
  }

  @Delete(':id/members/:memberId')
  async removeMember(
    @CurrentUser() user: User,
    @Param('id') teamId: string,
    @Param('memberId') memberId: string,
  ) {
    try {
      return await this.teamService.removeMember(user.id, teamId, memberId);
    } catch (error) {
      this.handleError(error);
    }
  }

  @Post(':id/leave')
  async leaveTeam(@CurrentUser() user: User, @Param('id') teamId: string) {
    try {
      return await this.teamService.leaveTeam(user.id, teamId);
    } catch (error) {
      this.handleError(error);
    }
  }

  @Patch(':id/members/:memberId')
  async updateMemberRole(
    @CurrentUser() user: User,
    @Param('id') teamId: string,
    @Param('memberId') memberId: string,
    @Body('role') role: string,
  ) {
    // Validate role is a valid TeamRole
    if (!Object.values(TeamRole).includes(role as TeamRole)) {
      throw new HttpException(
        'Invalid role. Must be OWNER, ADMIN, or MEMBER',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      return await this.teamService.updateMemberRole(
        user.id,
        teamId,
        memberId,
        role as TeamRole,
      );
    } catch (error) {
      this.handleError(error);
    }
  }

  @Get(':id/activities')
  async getActivities(
    @CurrentUser() user: User,
    @Param('id') teamId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    try {
      return await this.teamService.getActivities(
        user.id,
        teamId,
        limit ? parseInt(limit, 10) : 50,
        offset ? parseInt(offset, 10) : 0,
      );
    } catch (error) {
      this.handleError(error);
    }
  }

  @Get(':id/statistics')
  async getStatistics(
    @CurrentUser() user: User,
    @Param('id') teamId: string,
    @Query('period') period?: string,
  ) {
    try {
      return await this.teamService.getStatistics(
        user.id,
        teamId,
        period || '30d',
      );
    } catch (error) {
      this.handleError(error);
    }
  }

  private handleError(error: unknown): never {
    if (error instanceof DomainError) {
      throw new HttpException(
        {
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
          },
        },
        error.status,
      );
    }
    // Re-throw if not a DomainError
    throw error;
  }
}
