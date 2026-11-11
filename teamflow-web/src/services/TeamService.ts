import { apiFetch } from '../api/api';

export interface TeamMember {
  teamId: number;
  userId: number;
  username: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  joinedAt: string | null;
}

export interface Team {
  id: number;
  name: string;
  description?: string | null;
  ownerId: number;
  ownerUsername: string;
  createdAt?: string;
  updatedAt?: string;
  memberCount: number;
  myRole: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER' | null;
  members: TeamMember[];
}

export interface UserSummary {
  id: number;
  username: string;
  firstName: string | null;
  lastName: string | null;
}

export type AssignableTeamRole = 'ADMIN' | 'MEMBER' | 'VIEWER';

export interface CreateTeamRequest {
  name: string;
  description?: string;
}

export interface UpdateTeamRequest {
  name?: string;
  description?: string;
}

export const teamService = {
  // GET /api/teams/my-teams
  getUserTeams: (signal?: AbortSignal): Promise<Team[]> =>
    apiFetch<Team[]>('/teams/my-teams', { signal }),

  // GET /api/teams/{teamId}
  getTeamById: (teamId: number, signal?: AbortSignal): Promise<Team> =>
    apiFetch<Team>(`/teams/${teamId}`, { signal }),

  // POST /api/teams
  createTeam: (request: CreateTeamRequest, signal?: AbortSignal): Promise<Team> =>
    apiFetch<Team>('/teams', {
      method: 'POST',
      body: JSON.stringify(request),
      signal,
    }),

  // PUT /api/teams/{teamId}
  updateTeam: (teamId: number, request: UpdateTeamRequest, signal?: AbortSignal): Promise<Team> =>
    apiFetch<Team>(`/teams/${teamId}`, {
      method: 'PUT',
      body: JSON.stringify(request),
      signal,
    }),

  // DELETE /api/teams/{teamId}
  deleteTeam: (teamId: number, signal?: AbortSignal): Promise<void> =>
    apiFetch<void>(`/teams/${teamId}`, { method: 'DELETE', signal }),

  // GET /api/teams/{teamId}/candidates?q=...  (users not yet in the team)
  getAddableUsers: (teamId: number, q: string, signal?: AbortSignal): Promise<UserSummary[]> =>
    apiFetch<UserSummary[]>(`/teams/${teamId}/candidates?q=${encodeURIComponent(q)}`, { signal }),

  // POST /api/teams/{teamId}/members
  addMember: (teamId: number, userId: number, role: AssignableTeamRole, signal?: AbortSignal): Promise<TeamMember> =>
    apiFetch<TeamMember>(`/teams/${teamId}/members`, {
      method: 'POST',
      body: JSON.stringify({ userId, role }),
      signal,
    }),

  // PUT /api/teams/{teamId}/members/{userId}
  changeMemberRole: (teamId: number, userId: number, role: string, signal?: AbortSignal): Promise<TeamMember> =>
    apiFetch<TeamMember>(`/teams/${teamId}/members/${userId}`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
      signal,
    }),

  // DELETE /api/teams/{teamId}/members/{userId}
  removeMember: (teamId: number, userId: number, signal?: AbortSignal): Promise<void> =>
    apiFetch<void>(`/teams/${teamId}/members/${userId}`, { method: 'DELETE', signal }),
};

export default teamService;