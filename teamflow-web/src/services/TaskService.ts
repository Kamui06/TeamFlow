import { apiFetch } from '../api/api';

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export const TASK_PRIORITIES: TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

export interface TaskAssignee {
  userId: number;
  username: string;
}

export interface Task {
  id: number;
  teamId: number;
  projectId: number;
  projectName: string | null;
  title: string;
  description: string | null;
  priority: TaskPriority;
  statusId: number | null;
  statusName: string | null;
  statusFinal: boolean;
  assignees: TaskAssignee[];
  createdById: number;
  createdByUsername: string;
  dueDate: string | null;
  position: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface ProjectMemberOption {
  projectId: number;
  userId: number;
  username: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  joinedAt: string | null;
}

export interface ProjectStatusOption {
  id: number;
  name: string;
  position: number | null;
  isDefault: boolean;
  isFinal: boolean;
}

export interface TaskRequest {
  projectId?: number;
  title?: string;
  description?: string;
  priority?: TaskPriority;
  statusId?: number;
  dueDate?: string;
  clearDueDate?: boolean;
  assigneeIds?: number[];
}

export const taskService = {
  getMyTasks: (signal?: AbortSignal) => apiFetch<Task[]>('/tasks/my', { signal }),

  getAllTasks: (signal?: AbortSignal) => apiFetch<Task[]>('/tasks', { signal }),

  getProjectTasks: (projectId: number, signal?: AbortSignal) =>
    apiFetch<Task[]>(`/tasks/project/${projectId}`, { signal }),

  getProjectStatuses: (projectId: number, signal?: AbortSignal) =>
    apiFetch<ProjectStatusOption[]>(`/tasks/project/${projectId}/statuses`, { signal }),

  getProjectMembers: (projectId: number, signal?: AbortSignal) =>
    apiFetch<ProjectMemberOption[]>(`/projects/${projectId}/members`, { signal }),

  getTask: (taskId: number, signal?: AbortSignal) => apiFetch<Task>(`/tasks/${taskId}`, { signal }),

  createTask: (request: TaskRequest, signal?: AbortSignal) =>
    apiFetch<Task>('/tasks', {
      method: 'POST',
      body: JSON.stringify(request),
      signal,
    }),

  updateTask: (taskId: number, request: TaskRequest, signal?: AbortSignal) =>
    apiFetch<Task>(`/tasks/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify(request),
      signal,
    }),

  // Replaces the full assignee list. Pass [] to unassign everyone. 
  setAssignees: (taskId: number, userIds: number[], signal?: AbortSignal) =>
    apiFetch<Task>(`/tasks/${taskId}/assignees`, {
      method: 'PUT',
      body: JSON.stringify({ userIds }),
      signal,
    }),

  deleteTask: (taskId: number, signal?: AbortSignal) =>
    apiFetch<void>(`/tasks/${taskId}`, { method: 'DELETE', signal }),
}