import { TeamRole } from '../dto/update-member-role.dto';

export interface Team {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: TeamRole;
  joined_at: string;
}

export interface TeamMemberWithUser extends TeamMember {
  users: {
    id: string;
    name: string;
    email: string;
    avatar_url?: string | null;
  };
}

export interface TeamWithRole extends Team {
  myRole: TeamRole;
}

export type CreateTeamInput = {
  name: string;
  ownerId: string;
};

export type UpdateTeamInput = {
  name: string;
};

export type InviteMemberInput = {
  teamId: string;
  email: string;
  inviterId: string;
};

export type RemoveMemberInput = {
  teamId: string;
  memberId: string;
  requesterId: string;
};

export type UpdateMemberRoleInput = {
  teamId: string;
  memberId: string;
  newRole: TeamRole;
  requesterId: string;
};
