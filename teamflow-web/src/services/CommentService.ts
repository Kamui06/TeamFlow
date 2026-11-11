import { apiFetch } from "../api/api";

export type CommentScope = "GLOBAL" | "TEAM" | "PROJECT" | "TASK";

export interface CommentItem {
  id: number;
  scope: CommentScope;
  targetId: number | null;
  targetName: string;
  authorId: number;
  authorUsername: string;
  content: string;
  createdAt: string | null;
  updatedAt: string | null;
  canEdit: boolean;
  canDelete: boolean;
}

export interface CommentThreadData {
  canPost: boolean;
  comments: CommentItem[];
}

export const commentService = {
  thread: (scope: CommentScope, targetId?: number | null, signal?: AbortSignal) => {
    const query = new URLSearchParams({ scope });
    if (targetId != null) query.set("targetId", String(targetId));
    return apiFetch<CommentThreadData>(`/comments?${query.toString()}`, { signal });
  },

  create: (scope: CommentScope, targetId: number | null, content: string) =>
    apiFetch<CommentItem>("/comments", {
      method: "POST",
      body: JSON.stringify({ scope, targetId, content }),
    }),

  update: (commentId: number, content: string) =>
    apiFetch<CommentItem>(`/comments/${commentId}`, {
      method: "PUT",
      body: JSON.stringify({ content }),
    }),

  remove: (commentId: number) => apiFetch<void>(`/comments/${commentId}`, { method: "DELETE" }),

  adminList: (scope: "ALL" | CommentScope, q: string, signal?: AbortSignal) => {
    const query = new URLSearchParams({ scope });
    if (q) query.set("q", q);
    return apiFetch<CommentItem[]>(`/comments/admin?${query.toString()}`, { signal });
  },
};