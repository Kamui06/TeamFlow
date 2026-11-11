import { apiFetch } from "../api/api";

export type NotificationType =
  | "TEAM_CREATED"
  | "TEAM_UPDATED"
  | "TEAM_DELETED"
  | "TEAM_MEMBER_ADDED"
  | "TEAM_MEMBER_REMOVED"
  | "TEAM_MEMBER_ROLE_CHANGED"
  | "TEAM_COMMENT"
  | "PROJECT_CREATED"
  | "PROJECT_MEMBER_ADDED"
  | "PROJECT_MEMBER_REMOVED"
  | "PROJECT_MEMBER_ROLE_CHANGED"
  | "PROJECT_COMPLETED"
  | "PROJECT_ARCHIVED"
  | "PROJECT_COMMENT"
  | "TASK_CREATED"
  | "TASK_ASSIGNED"
  | "TASK_STATUS_CHANGED"
  | "TASK_PRIORITY_CHANGED"
  | "TASK_DELETED"
  | "TASK_DUE_SOON"
  | "TASK_OVERDUE"
  | "TASK_COMMENT";

export interface NotificationItem {
  id: number;
  type: NotificationType;
  message: string;
  actorUsername: string | null;
  link: string;
  read: boolean;
  createdAt: string | null;
}

export interface NotificationPage {
  items: NotificationItem[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
}

/** Fired after any change, so the sidebar badge refreshes at once. */
export const NOTIFICATIONS_CHANGED = "teamflow:notifications-changed";

const announce = () => window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));

export const TYPE_LABELS: Record<NotificationType, string> = {
  TEAM_CREATED: "Team created",
  TEAM_UPDATED: "Team updated",
  TEAM_DELETED: "Team deleted",
  TEAM_MEMBER_ADDED: "Member added to team",
  TEAM_MEMBER_REMOVED: "Member removed from team",
  TEAM_MEMBER_ROLE_CHANGED: "Team role changed",
  TEAM_COMMENT: "Team comment",
  PROJECT_CREATED: "Project created",
  PROJECT_MEMBER_ADDED: "Added to project",
  PROJECT_MEMBER_REMOVED: "Removed from project",
  PROJECT_MEMBER_ROLE_CHANGED: "Project role changed",
  PROJECT_COMPLETED: "Project done",
  PROJECT_ARCHIVED: "Project archived",
  PROJECT_COMMENT: "Project comment",
  TASK_CREATED: "Task created",
  TASK_ASSIGNED: "Task assigned",
  TASK_STATUS_CHANGED: "Status changed",
  TASK_PRIORITY_CHANGED: "Priority changed",
  TASK_DELETED: "Task deleted",
  TASK_DUE_SOON: "Due soon",
  TASK_OVERDUE: "Overdue",
  TASK_COMMENT: "Task comment",
};

export const notificationService = {
  list: (unreadOnly: boolean, page: number, signal?: AbortSignal) =>
    apiFetch<NotificationPage>(`/notifications?unreadOnly=${unreadOnly}&page=${page}&size=20`, { signal }),

  unreadCount: (signal?: AbortSignal) =>
    apiFetch<{ count: number }>("/notifications/unread-count", { signal }),

  markRead: async (id: number) => {
    await apiFetch<void>(`/notifications/${id}/read`, { method: "POST" });
    announce();
  },

  markAllRead: async () => {
    await apiFetch<void>("/notifications/read-all", { method: "POST" });
    announce();
  },

  remove: async (id: number) => {
    await apiFetch<void>(`/notifications/${id}`, { method: "DELETE" });
    announce();
  },

  clearRead: async () => {
    const result = await apiFetch<{ deleted: number }>("/notifications/read", { method: "DELETE" });
    announce();
    return result.deleted;
  },
};