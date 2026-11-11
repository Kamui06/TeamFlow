import { apiFetch } from "../api/api";

export interface TeamRef {
  id: number;
  name: string;
  role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
}

export interface Profile {
  id: number;
  username: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  bio: string | null;
  role: "USER" | "ADMIN";
  joinedAt: string | null;
  teams: TeamRef[];
}

export interface PublicProfile {
  id: number;
  username: string;
  firstName: string | null;
  lastName: string | null;
  bio: string | null;
  role: string;
  joinedAt: string | null;
  teams: TeamRef[];
  tasks: Counts;
  assignedProjects: number;
  overdue: number;
  recentlyCompleted: TaskItem[];
  upcoming: TaskItem[];
  recentActivity: ActivityItem[];
  projects: ProjectItem[];
  assignedTasks: TaskItem[];
}

export interface ProfileUpdate {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  bio: string;
}

export interface Counts {
  completed: number;
  total: number;
  incomplete: number;
}

export interface TaskItem {
  id: number;
  title: string;
  projectId: number;
  projectName: string;
  status: string | null;
  completed: boolean;
  priority: string;
  dueDate: string | null;
  updatedAt: string | null;
}

export interface ProjectItem {
  id: number;
  name: string;
  teamName: string;
  status: string;
  myRole: string;
  myTasks: number;
  myCompleted: number;
}

export interface ActivityItem {
  text: string;
  link: string;
  at: string | null;
}

export interface Overview {
  assignedProjects: number;
  tasks: Counts;
  overdue: number;
  recentlyCompleted: TaskItem[];
  upcoming: TaskItem[];
  recentActivity: ActivityItem[];
}

export interface Assignments {
  projects: ProjectItem[];
  tasks: TaskItem[];
}

export const profileService = {
    getProfile: (signal?: AbortSignal) => 
    apiFetch<Profile>("/profile/me", { signal }),

    updateProfile: (body: ProfileUpdate) => 
    apiFetch<Profile>("/profile/me", { method: "PUT", body: JSON.stringify(body) }),

    getOverview: (signal?: AbortSignal) => 
    apiFetch<Overview>("/profile/me/overview", { signal }),

    getAssignments: (signal?: AbortSignal) => 
    apiFetch<Assignments>("/profile/me/assignments", { signal }),

    getPublicProfile: (userId: number, signal?: AbortSignal) =>
    apiFetch<PublicProfile>(`/profile/users/${userId}`, { signal }),
};