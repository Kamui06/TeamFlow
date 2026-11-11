import { useEffect, useState, type SubmitEvent } from "react";
import { isAbortError } from "../api/api";
import {
  commentService,
  type CommentItem,
  type CommentScope,
  type CommentThreadData,
} from "../services/CommentService";
import "./CommentThread.css";

const MAX_LENGTH = 2000;

interface CommentThreadProps {
  readonly scope: CommentScope;
  readonly targetId: number | null;
  readonly title?: string;
  readonly subtitle?: string;
}

const initials = (name: string) => name.trim().charAt(0).toUpperCase() || "?";

function timeText(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CommentThread({ scope, targetId, title = "Comments", subtitle }: CommentThreadProps) {
  const [thread, setThread] = useState<CommentThreadData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");

    commentService
      .thread(scope, targetId, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setThread(data);
      })
      .catch((err: unknown) => {
        if (!isAbortError(err)) setError(err instanceof Error ? err.message : "Could not load comments");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [scope, targetId, reloadKey]);

  const refresh = () => setReloadKey((k) => k + 1);

  const post = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || saving) return;
    setSaving(true);
    setError("");
    try {
      await commentService.create(scope, targetId, text);
      setDraft("");
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not post comment");
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async (c: CommentItem) => {
    const text = editText.trim();
    if (!text) return;
    setError("");
    try {
      await commentService.update(c.id, text);
      setEditingId(null);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save comment");
    }
  };

  const remove = async (c: CommentItem) => {
    if (!window.confirm("Delete this comment? This cannot be undone.")) return;
    setError("");
    try {
      await commentService.remove(c.id);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete comment");
    }
  };

  const comments = thread?.comments ?? [];
  const canPost = thread?.canPost ?? false;

  return (
    <section className="ct-card" aria-label={title}>
      <header className="ct-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <span className="ct-count">{comments.length}</span>
      </header>

      {!loading && canPost && (
        <form className="ct-form" onSubmit={post}>
          <textarea
            rows={3}
            maxLength={MAX_LENGTH}
            placeholder="Write a comment…"
            value={draft}
            disabled={saving}
            onChange={(e) => setDraft(e.target.value)}
          />
          <div className="ct-form-foot">
            <span className="ct-hint">
              {draft.length}/{MAX_LENGTH}
            </span>
            <button type="submit" className="ct-btn ct-btn-primary" disabled={saving || !draft.trim()}>
              {saving ? "Posting…" : "Post comment"}
            </button>
          </div>
        </form>
      )}

      {!loading && !canPost && (
        <p className="ct-notice">
          You can read this discussion. Viewers and archived projects can't post.
        </p>
      )}

      {error && (
        <div className="ct-alert" role="alert">
          {error}
        </div>
      )}

      {loading && <p className="ct-state">Loading comments…</p>}

      {!loading && comments.length === 0 && <p className="ct-state">No comments yet.</p>}

      {!loading && comments.length > 0 && (
        <ul className="ct-list">
          {comments.map((c) => (
            <li key={c.id} className="ct-item">
              <span className="ct-avatar" aria-hidden="true">
                {initials(c.authorUsername)}
              </span>

              <div className="ct-main">
                <div className="ct-meta">
                  <strong>{c.authorUsername}</strong>
                  <span>{timeText(c.createdAt)}</span>
                </div>

                {editingId === c.id ? (
                  <div className="ct-edit">
                    <textarea
                      rows={3}
                      maxLength={MAX_LENGTH}
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                    />
                    <div className="ct-actions">
                      <button type="button" className="ct-btn ct-btn-secondary ct-btn-small" onClick={() => setEditingId(null)}>
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="ct-btn ct-btn-primary ct-btn-small"
                        disabled={!editText.trim()}
                        onClick={() => void saveEdit(c)}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="ct-body">{c.content}</p>
                    {(c.canEdit || c.canDelete) && (
                      <div className="ct-actions">
                        {c.canEdit && (
                          <button
                            type="button"
                            className="ct-link"
                            onClick={() => {
                              setEditingId(c.id);
                              setEditText(c.content);
                            }}
                          >
                            Edit
                          </button>
                        )}
                        {c.canDelete && (
                          <button type="button" className="ct-link ct-link-danger" onClick={() => void remove(c)}>
                            Delete
                          </button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}