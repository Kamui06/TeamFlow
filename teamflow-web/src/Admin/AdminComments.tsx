import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { isAbortError } from "../api/api";
import { commentService, type CommentItem, type CommentScope } from "../services/CommentService";
import "./AdminComments.css";

type ScopeFilter = "ALL" | CommentScope;

const FILTERS: { key: ScopeFilter; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "GLOBAL", label: "Global" },
  { key: "TEAM", label: "Team" },
  { key: "PROJECT", label: "Project" },
  { key: "TASK", label: "Task" },
];

function openPath(c: CommentItem): string | null {
  switch (c.scope) {
    case "TASK":
      return `/tasks/${c.targetId}`;
    case "PROJECT":
      return `/projects/${c.targetId}`;
    case "TEAM":
      return `/admin/teams/${c.targetId}`;
    default:
      return null;
  }
}

const dateText = (value: string | null) =>
  value
    ? new Date(value).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

export default function AdminComments() {
  const [scope, setScope] = useState<ScopeFilter>("ALL");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  // Wait for typing to pause before searching.
  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");

    commentService
      .adminList(scope, query, controller.signal)
      .then((list) => {
        if (!controller.signal.aborted) setItems(list);
      })
      .catch((err: unknown) => {
        if (!isAbortError(err)) setError(err instanceof Error ? err.message : "Could not load comments.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [scope, query, reloadKey]);

  const remove = async (c: CommentItem) => {
    if (!window.confirm("Delete this comment? This cannot be undone.")) return;
    setError("");
    setNotice("");
    try {
      await commentService.remove(c.id);
      setNotice("Comment deleted.");
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete comment.");
    }
  };

  return (
    <section className="ac-wrap">
      <div className="ac-toolbar">
        <div className="ac-segment" role="radiogroup" aria-label="Filter comments by scope">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              role="radio"
              aria-checked={scope === f.key}
              className={scope === f.key ? "is-active" : ""}
              onClick={() => setScope(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <input
          type="search"
          className="ac-search"
          aria-label="Search comments"
          placeholder="Search comment text…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {notice && <output className="ac-notice">{notice}</output>}
      {error && (
        <div className="ac-alert" role="alert">
          {error}
        </div>
      )}

      {loading && <p className="ac-state">Loading comments…</p>}

      {!loading && items.length === 0 && <p className="ac-state">No comments match these filters.</p>}

      {!loading && items.length > 0 && (
        <ul className="ac-list">
          {items.map((c) => {
            const path = openPath(c);
            return (
              <li key={c.id} className="ac-item">
                <div className="ac-item-head">
                  <span className={`ac-scope ac-scope-${c.scope.toLowerCase()}`}>{c.scope}</span>
                  <span className="ac-author">{c.authorUsername}</span>
                  <span className="ac-time">{dateText(c.createdAt)}</span>
                </div>

                <p className="ac-body">{c.content}</p>

                <div className="ac-item-foot">
                  {path ? (
                    <Link className="ac-where" to={path}>
                      {c.targetName}
                    </Link>
                  ) : (
                    <span className="ac-where ac-where-plain">{c.targetName}</span>
                  )}

                  <div className="ac-actions">
                    {path && (
                      <Link className="ac-btn" to={path}>
                        Open
                      </Link>
                    )}
                    {c.canDelete && (
                      <button type="button" className="ac-btn ac-btn-danger" onClick={() => void remove(c)}>
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}