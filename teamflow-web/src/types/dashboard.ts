export interface DashboardSummary {
  totalProjects: number;
  totalTeams?: number;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
}

export interface DashboardProject {
  id: number;
  name: string;
  description?: string | null;
  status: string;
  progress?: number | null;
  teamId?: number;
}

export interface DashboardTask {
  id: number;
  title: string;
  status: string;
  priority?: string | null;
  dueDate?: string;
  projectId?: number;
  projectName?: string;
}

export interface DashboardData {
  summary: DashboardSummary;
  projects: DashboardProject[];
  tasks: DashboardTask[];
}
