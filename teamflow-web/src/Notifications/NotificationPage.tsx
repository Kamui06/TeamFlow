import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { isAbortError } from "../api/api";
import {
  notificationService,
  TYPE_LABELS,
  type NotificationItem,
  type NotificationPage as Page,
} from "../services/NotificationService";
import "./Notifications.css";

function timeText(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function NotificationPage() {
  const navigate = useNavigate();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [data, setData] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");

    notificationService
      .list(unreadOnly, page, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch((err: unknown) => {
        if (!isAbortError(err)) setError(err instanceof Error ? err.message : "Could not load notifications");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [unreadOnly, page, reloadKey]);

  const refresh = () => setReloadKey((k) => k + 1);

  const run = async (action: () => Promise<unknown>, success: string) => {
    setError("");
    setNotice("");
    try {
      await action();
      if (success) setNotice(success);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    }
  };

  const open = async (n: NotificationItem) => {
    if (!n.read) {
      try {
        await notificationService.markRead(n.id);
      } catch {
        // Opening the item still works if marking it read fails.
      }
    }
    void navigate(n.link);
  };

  const remove = (n: NotificationItem) => {
    void run(() => notificationService.remove(n.id), "Notification deleted");
  };

  const clearRead = () => {
    if (!window.confirm("Delete every notification you've already read?")) return;
    void run(async () => {
      const count = await notificationService.clearRead();
      setNotice(`${count} read notification${count === 1 ? "" : "s"} deleted`);
    }, "");
  };

  const items = data?.items ?? [];

  return (
    <section className="np-wrap">
      <div className="np-toolbar">
        <div className="np-segment" role="tablist" aria-label="Filter notifications">
          <button
            type="button"
            role="tab"
            aria-selected={!unreadOnly}
            className={!unreadOnly ? "active" : ""}
            onClick={() => {
              setUnreadOnly(false);
              setPage(0);
            }}
          >
            All
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={unreadOnly}
            className={unreadOnly ? "active" : ""}
            onClick={() => {
              setUnreadOnly(true);
              setPage(0);
            }}
          >
            Unread
          </button>
        </div>

        <div className="np-actions">
          <button type="button" className="np-btn np-btn-secondary" onClick={() => void run(() => notificationService.markAllRead(), "All marked as read")}>
            Mark all as read
          </button>
          <button type="button" className="np-btn np-btn-secondary" onClick={clearRead}>
            Clear read
          </button>
        </div>
      </div>

      {notice && <output className="np-notice">{notice}</output>}
      {error && (
        <div className="np-alert" role="alert">
          {error}
        </div>
      )}

      <div className="np-card">
        {loading && !data && <p className="np-state">Loading notifications…</p>}

        {!loading && items.length === 0 && (
          <p className="np-state">{unreadOnly ? "You're all caught up." : "No notifications yet."}</p>
        )}

        {items.length > 0 && (
          <ul className="np-list" aria-busy={loading}>
            {items.map((n) => (
              <li key={n.id} className={`np-item ${n.read ? "" : "is-unread"}`}>

                <div className="np-main">
                  <div className="np-meta">
                    <span className="np-type">{TYPE_LABELS[n.type]}</span>
                    <span>{timeText(n.createdAt)}</span>
                    {!n.read && <span className="np-dot" aria-label="Unread" />}
                  </div>
                  <p className="np-message">{n.message}</p>
                </div>

                <div className="np-row-actions">
                  <button type="button" className="np-btn np-btn-primary np-btn-small" onClick={() => void open(n)}>
                    Open
                  </button>
                  {!n.read && (
                    <button
                      type="button"
                      className="np-btn np-btn-secondary np-btn-small"
                      onClick={() => void run(() => notificationService.markRead(n.id), "")}
                    >
                      Mark read
                    </button>
                  )}
                  <button type="button" className="np-link-danger" onClick={() => remove(n)}>
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {data && (
        <div className="np-pager">
          <span>
            {data.totalItems} notification{data.totalItems === 1 ? "" : "s"} · page {data.page + 1} of{" "}
            {Math.max(data.totalPages, 1)}
          </span>
          <button type="button" disabled={page === 0 || loading} onClick={() => setPage((p) => p - 1)}>
            Previous
          </button>
          <button
            type="button"
            disabled={page + 1 >= data.totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}
    </section>
  );
}