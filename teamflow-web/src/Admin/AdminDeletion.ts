import { apiFetch } from "../api/api";

export interface DeletionLine {
  label: string;
  count: number;
}

export interface DeletionImpact {
  type: "TEAM" | "PROJECT";
  id: number;
  name: string;
  deleted: DeletionLine[];
  kept: string[];
  projects: string[];
}

export const adminDeletion = {
  teamImpact: (teamId: number, signal?: AbortSignal) =>
    apiFetch<DeletionImpact>(`/admin/teams/${teamId}/deletion-impact`, { signal }),

  deleteTeam: (teamId: number) => apiFetch<void>(`/admin/teams/${teamId}`, { method: "DELETE" }),

  projectImpact: (projectId: number, signal?: AbortSignal) =>
    apiFetch<DeletionImpact>(`/admin/projects/${projectId}/deletion-impact`, { signal }),

  deleteProject: (projectId: number) =>
    apiFetch<void>(`/admin/projects/${projectId}`, { method: "DELETE" }),
};