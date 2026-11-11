/*
    Project Service
    Handles all project-related API calls
*/

import { apiFetch, isAbortError } from '../api/api';

function logFailure(message: string, error: unknown) {
  if (!isAbortError(error)) {
    console.error(message, error);
  }
}

/*
    Project interface matching backend ProjectDTO
*/
export interface Project {
    id: number;
    name: string;
    description: string;
    teamId: number;
    status: string;
    startDate: string | null;
    endDate: string | null;
    createdAt: string;
    updatedAt: string;
    createdById: number;
    createdByUsername: string;
    taskCount: number;
    completedTaskCount: number;
    myProjectLevel?: 'MANAGER' | 'MEMBER' | 'VIEWER' | 'NONE';
}

/*
    Create Project Request DTO
*/
export interface CreateProjectRequest {
    name: string;
    description?: string;
    teamId: number;
    startDate?: string;
    endDate?: string;
    status?: string;
}

/*
    Update Project Request DTO
*/
export interface UpdateProjectRequest {
    name?: string;
    description?: string;
    startDate?: string;
    endDate?: string | null;
    status?: string;
    clearEndDate?: boolean;
}

/*
    Project Service with all CRUD operations
*/
export const projectService = {
    /*
        Get all projects for authenticated user
        GET /api/projects
    */
    getProjects: async (signal?: AbortSignal): Promise<Project[]> => {
        try {
            return await apiFetch<Project[]>('/projects', { signal });
        } catch (error) {
            logFailure('Failed to fetch projects:', error);
            throw error;
        }
    },

    /*
        Get projects for a specific team
        GET /api/projects/team/:teamId
    */
    getTeamProjects: async (teamId: number, signal?: AbortSignal): Promise<Project[]> => {
        try {
            return await apiFetch<Project[]>(`/projects/team/${teamId}`, { signal });
        } catch (error) {
            logFailure(`Failed to fetch team projects for team ${teamId}:`, error);
            throw error;
        }
    },

    /*
        Get single project by ID
        GET /api/projects/:projectId
    */
    getProject: async (projectId: number, signal?: AbortSignal): Promise<Project> => {
        try {
            return await apiFetch<Project>(`/projects/${projectId}`, { signal });
        } catch (error) {
            logFailure(`Failed to fetch project ${projectId}:`, error);
            throw error;
        }
    },

    /*
        Create new project
        POST /api/projects
    */
    createProject: async (request: CreateProjectRequest, signal?: AbortSignal): Promise<Project> => {
        try {
            return await apiFetch<Project>('/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(request),
                signal,
            });
        } catch (error) {
            logFailure('Failed to create project:', error);
            throw error;
        }
    },

    /*
        Update project
        PUT /api/projects/:projectId
    */
    updateProject: async (
        projectId: number,
        request: UpdateProjectRequest,
        signal?: AbortSignal
    ): Promise<Project> => {
        try {
            return await apiFetch<Project>(`/projects/${projectId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(request),
                signal,
            });
        } catch (error) {
            logFailure(`Failed to update project ${projectId}:`, error);
            throw error;
        }
    },

    archiveProject: (projectId: number) =>
    apiFetch<Project>(`/projects/${projectId}/archive`, { method: 'POST' }),

    /*
        Delete project
        DELETE /api/projects/:projectId
    */
    deleteProject: async (projectId: number, signal?: AbortSignal): Promise<void> => {
        try {
            await apiFetch<void>(`/projects/${projectId}`, { 
                method: 'DELETE',
                signal
            });
        } catch (error) {
            logFailure(`Failed to delete project ${projectId}:`, error);
            throw error;
        }
    },

    /*
        Add member to project
        POST /api/projects/:projectId/members
    */
    addMember: async (
        projectId: number,
        userId: number,
        role: string,
        signal?: AbortSignal
    ): Promise<any> => {
        try {
            return await apiFetch<any>(`/projects/${projectId}/members`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, role }),
                signal,
            });
        } catch (error) {
            logFailure(`Failed to add member to project ${projectId}:`, error);
            throw error;
        }
    },

    /*
        Get all members of a project
        GET /api/projects/:projectId/members
    */
    getMembers: async (projectId: number, signal?: AbortSignal): Promise<any[]> => {
        try {
            return await apiFetch<any[]>(`/projects/${projectId}/members`, { signal });
        } catch (error) {
            logFailure(`Failed to fetch members for project ${projectId}:`, error);
            throw error;
        }
    },

    /*
        Remove member from project
        DELETE /api/projects/:projectId/members/:userId
    */
    removeMember: async (
        projectId: number,
        userId: number,
        signal?: AbortSignal
    ): Promise<void> => {
        try {
            await apiFetch<void>(
                `/projects/${projectId}/members/${userId}`,
                { method: 'DELETE', signal }
            );
        } catch (error) {
            logFailure(
                `Failed to remove member ${userId} from project ${projectId}:`,
                error
            );
            throw error;
        }
    },
};

export default projectService;