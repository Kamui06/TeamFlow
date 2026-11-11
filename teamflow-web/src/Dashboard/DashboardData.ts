import { apiFetch } from "../api/api";
import type { NotificationItem, NotificationPage } from "../services/NotificationService";
import { projectService, type Project } from "../services/ProjectService";
import { taskService, type Task } from "../services/TaskService";
import { teamService, type Team } from "../services/TeamService";

// ---------- Loading ----------

export interface Sourced<T> {
  data: T;
  error: string | null;
}

export interface Snapshot {
  projects: Sourced<Project[]>;
  tasks: Sourced<Task[]>;
  teams: Sourced<Team[]>;
  notifications: Sourced<NotificationItem[]>;
}

function settle<T>(result: PromiseSettledResult<T>, fallback: T): Sourced<T> {
  if (result.status === "fulfilled") {
    return { data: result.value, error: null };
  }
  return {
    data: fallback,
    error: result.reason instanceof Error ? result.reason.message : "Could not load this section.",
  };
}

/** Loads every source in parallel. One failing source leaves the others on screen. */
export async function loadSnapshot(signal: AbortSignal): Promise<Snapshot> {
  const notificationsRequest = apiFetch<NotificationPage>("/notifications?unreadOnly=false&page=0&size=100", {
    signal,
  }).then((page) => page.items);

  const [projects, tasks, teams, notifications] = await Promise.allSettled([
    projectService.getProjects(signal),
    taskService.getAllTasks(signal),
    teamService.getUserTeams(signal),
    notificationsRequest,
  ]);

  return {
    projects: settle(projects, []),
    tasks: settle(tasks, []),
    teams: settle(teams, []),
    notifications: settle(notifications, []),
  };
}

// ---------- Shared helpers ----------

const DAY_MS = 86_400_000;

/** Chart colors, shared by every panel. */
export const CHART = {
  blue: "#1976d2",
  green: "#12b76a",
  purple: "#7a5af8",
  orange: "#f79009",
  red: "#d92d20",
  gray: "#98a2b3",
};

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Local calendar date as yyyy-mm-dd. */
export function localDateKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Whole calendar days from today to a yyyy-mm-dd date. Negative means the date has passed. */
function daysFromToday(date: string, today: string): number {
  return Math.round((Date.parse(`${date}T00:00:00`) - Date.parse(`${today}T00:00:00`)) / DAY_MS);
}

// ---------- Tasks ----------

export const PRIORITY_ORDER = ["URGENT", "HIGH", "MEDIUM", "LOW"] as const;

export interface TaskStats {
  total: number;
  completed: number;
  open: number;
  overdue: number;
  dueToday: number;
  dueSoon: number;
  unassignedOpen: number;
  openByPriority: { label: string; count: number }[];
  dueBuckets: { label: string; count: number }[];
  byProject: { name: string; completed: number; open: number }[];
}

export function computeTaskStats(tasks: Task[], today: string): TaskStats {
  const open = tasks.filter((t) => !t.statusFinal);

  let overdue = 0;
  let dueToday = 0;
  let dueSoon = 0;
  let later = 0;
  let noDate = 0;
  let unassignedOpen = 0;

  for (const task of open) {
    if (task.assignees.length === 0) unassignedOpen++;
    if (!task.dueDate) {
      noDate++;
      continue;
    }
    const days = daysFromToday(task.dueDate, today);
    if (days < 0) overdue++;
    else if (days === 0) dueToday++;
    else if (days <= 7) dueSoon++;
    else later++;
  }

  const grouped = new Map<string, { name: string; completed: number; open: number }>();
  for (const task of tasks) {
    const name = task.projectName ?? "No project";
    const row = grouped.get(name) ?? { name, completed: 0, open: 0 };
    if (task.statusFinal) row.completed++;
    else row.open++;
    grouped.set(name, row);
  }

  return {
    total: tasks.length,
    completed: tasks.length - open.length,
    open: open.length,
    overdue,
    dueToday,
    dueSoon,
    unassignedOpen,
    openByPriority: PRIORITY_ORDER.map((label) => ({
      label,
      count: open.filter((t) => t.priority === label).length,
    })),
    dueBuckets: [
      { label: "Overdue", count: overdue },
      { label: "Today", count: dueToday },
      { label: "1–7 days", count: dueSoon },
      { label: "Later", count: later },
      { label: "No date", count: noDate },
    ],
    byProject: [...grouped.values()]
      .sort((a, b) => b.completed + b.open - (a.completed + a.open))
      .slice(0, 8),
  };
}

// ---------- Projects ----------

export interface ProjectStats {
  total: number;
  active: number;
  completed: number;
  archived: number;
  averageProgress: number;
  managed: number;
  memberOf: number;
  viewerOf: number;
  statusRows: { label: string; count: number; color: string }[];
  progressRows: { name: string; percent: number; tasks: number }[];
}

export function computeProjectStats(projects: Project[]): ProjectStats {
  const count = (status: string) => projects.filter((p) => p.status === status).length;
  const active = count("ACTIVE");
  const completed = count("COMPLETED");
  const archived = count("ARCHIVED");

  const withTasks = projects.filter((p) => p.taskCount > 0);
  const averageProgress = withTasks.length
    ? Math.round(
        withTasks.reduce((sum, p) => sum + (p.completedTaskCount * 100) / p.taskCount, 0) / withTasks.length
      )
    : 0;

  return {
    total: projects.length,
    active,
    completed,
    archived,
    averageProgress,
    managed: projects.filter((p) => p.myProjectLevel === "MANAGER").length,
    memberOf: projects.filter((p) => p.myProjectLevel === "MEMBER").length,
    viewerOf: projects.filter((p) => p.myProjectLevel === "VIEWER").length,
    statusRows: [
      { label: "Active", count: active, color: CHART.green },
      { label: "Completed", count: completed, color: CHART.purple },
      { label: "Archived", count: archived, color: CHART.gray },
    ],
    progressRows: [...projects]
      .sort((a, b) => b.taskCount - a.taskCount)
      .slice(0, 8)
      .map((p) => ({
        name: p.name,
        tasks: p.taskCount,
        percent: p.taskCount ? Math.round((p.completedTaskCount * 100) / p.taskCount) : 0,
      })),
  };
}

// ---------- Teams ----------

export interface TeamStats {
  total: number;
  memberships: number;
  owned: number;
  admin: number;
  member: number;
  viewer: number;
  averageSize: number;
  roleRows: { label: string; count: number; color: string }[];
  sizeRows: { name: string; members: number }[];
}

export function computeTeamStats(teams: Team[]): TeamStats {
  const roleCount = (role: string) => teams.filter((t) => t.myRole === role).length;
  const owned = roleCount("OWNER");
  const admin = roleCount("ADMIN");
  const member = roleCount("MEMBER");
  const viewer = roleCount("VIEWER");
  const memberships = teams.reduce((sum, t) => sum + t.memberCount, 0);

  return {
    total: teams.length,
    memberships,
    owned,
    admin,
    member,
    viewer,
    averageSize: teams.length ? Math.round(memberships / teams.length) : 0,
    roleRows: [
      { label: "Owner", count: owned, color: CHART.orange },
      { label: "Admin", count: admin, color: CHART.purple },
      { label: "Member", count: member, color: CHART.green },
      { label: "Viewer", count: viewer, color: CHART.gray },
    ],
    sizeRows: [...teams]
      .sort((a, b) => b.memberCount - a.memberCount)
      .slice(0, 8)
      .map((t) => ({ name: t.name, members: t.memberCount })),
  };
}

// ---------- Activity ----------

export type ActivityCategory = "tasks" | "projects" | "teams" | "comments";

export interface ActivityDay {
  key: string;
  label: string;
  tasks: number;
  projects: number;
  teams: number;
  comments: number;
}

export interface ActivityStats {
  days: ActivityDay[];
  last7: number;
  last7ByCategory: Record<ActivityCategory, number>;
  unread: number;
  latest: NotificationItem | null;
}

function categoryOf(type: string): ActivityCategory | null {
  if (type.endsWith("_COMMENT")) return "comments";
  if (type.startsWith("TASK_")) return "tasks";
  if (type.startsWith("PROJECT_")) return "projects";
  if (type.startsWith("TEAM_")) return "teams";
  return null;
}

export function computeActivity(items: NotificationItem[], now: Date): ActivityStats {
  const days: ActivityDay[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    days.push({
      key: localDateKey(d),
      label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      tasks: 0,
      projects: 0,
      teams: 0,
      comments: 0,
    });
  }

  const byKey = new Map(days.map((d) => [d.key, d] as const));
  const weekAgo = now.getTime() - 7 * DAY_MS;
  const last7ByCategory: Record<ActivityCategory, number> = { tasks: 0, projects: 0, teams: 0, comments: 0 };
  let last7 = 0;

  for (const item of items) {
    if (!item.createdAt) continue;
    const category = categoryOf(item.type);
    if (!category) continue;

    const created = new Date(item.createdAt);
    const day = byKey.get(localDateKey(created));
    if (day) day[category]++;

    if (created.getTime() >= weekAgo) {
      last7++;
      last7ByCategory[category]++;
    }
  }

  return {
    days,
    last7,
    last7ByCategory,
    unread: items.filter((i) => !i.read).length,
    latest: items[0] ?? null,
  };
}

// ---------- Overview sentences ----------

export interface OverviewLine {
  area: string;
  text: string;
  to: string;
}

function buildTaskOverview(t: TaskStats): OverviewLine[] {
  const lines: OverviewLine[] = [{
    area: "Tasks",
    to: "/tasks",
    text:
      t.total === 0
        ? "There are no tasks in your workspace yet. Create one to start tracking work."
        : `${plural(t.total, "task")} in your workspace: ${t.completed} completed and ${t.open} open.`,
  }];

  if (t.total === 0) return lines;

  const alerts = [
    t.overdue > 0 ? `${plural(t.overdue, "task")} overdue` : null,
    t.dueToday > 0 ? `${plural(t.dueToday, "task")} due today` : null,
    t.dueSoon > 0 ? `${plural(t.dueSoon, "task")} due in the next 7 days` : null,
  ].filter((alert): alert is string => alert !== null);

  lines.push({
    area: "Deadlines",
    to: "/tasks",
    text: alerts.length > 0 ? `Needs attention: ${alerts.join(", ")}.` : "Nothing is overdue or due this week.",
  });

  if (t.unassignedOpen > 0) {
    lines.push({
      area: "Assignments",
      to: "/tasks",
      text: `${plural(t.unassignedOpen, "open task")} ${t.unassignedOpen === 1 ? "has" : "have"} no assignee.`,
    });
  }

  return lines;
}

function buildProjectOverview(p: ProjectStats): OverviewLine[] {
  const lines: OverviewLine[] = [{
    area: "Projects",
    to: "/projects",
    text:
      p.total === 0
        ? "You are not on any project yet."
        : `${plural(p.total, "project")} visible to you: ${p.active} active, ${p.completed} completed and ${p.archived} archived. Average progress is ${p.averageProgress}%.`,
  }];

  if (p.managed > 0) {
    lines.push({
      area: "Projects",
      to: "/projects",
      text: `You manage ${p.managed} of them and are a member of ${p.memberOf}.`,
    });
  }

  return lines;
}

function buildTeamOverview(tm: TeamStats): OverviewLine {
  return {
    area: "Teams",
    to: "/teams",
    text:
      tm.total === 0
        ? "You are not in any team yet."
        : `You belong to ${plural(tm.total, "team")} with ${tm.memberships} memberships in total. You own ${tm.owned} and administer ${tm.admin}.`,
  };
}

function buildActivityOverview(a: ActivityStats): OverviewLine[] {
  const lines: OverviewLine[] = [{
    area: "Activity",
    to: "/notifications",
    text:
      a.last7 === 0
        ? "No new notifications in the last 7 days."
        : `${plural(a.last7, "notification")} in the last 7 days: ${a.last7ByCategory.tasks} about tasks, ${a.last7ByCategory.projects} about projects, ${a.last7ByCategory.teams} about teams and ${a.last7ByCategory.comments} comments.`,
  }];

  if (a.unread > 0) {
    lines.push({ area: "Unread", to: "/notifications", text: `${plural(a.unread, "notification")} still unread.` });
  }

  if (a.latest) {
    lines.push({ area: "Latest", to: "/notifications", text: a.latest.message });
  }

  return lines;
}

export function buildOverview(s: {
  tasks: TaskStats;
  projects: ProjectStats;
  teams: TeamStats;
  activity: ActivityStats;
}): OverviewLine[] {
  const { tasks, projects, teams, activity } = s;
  const lines = [
    ...buildTaskOverview(tasks),
    ...buildProjectOverview(projects),
    buildTeamOverview(teams),
    ...buildActivityOverview(activity),
  ];

  return lines;
}