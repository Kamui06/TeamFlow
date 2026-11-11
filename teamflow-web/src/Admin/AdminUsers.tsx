import { memo, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch, isAbortError } from "../api/api";
import "./AdminUsers.css";

type Role = "USER" | "ADMIN";

interface AdminUserRow {
  id: number;
  username: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: Role;
  isActive: boolean;
  createdAt: string | null;
}

interface PagedResponse<T> {
  items: T[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
}

const PAGE_SIZE = 20;

const joinedText = (value: string | null) =>
  value
    ? new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";

interface UserItemProps {
  readonly user: AdminUserRow;
  readonly busy: boolean;
  readonly onToggleRole: (u: AdminUserRow) => void;
  readonly onToggleActive: (u: AdminUserRow) => void;
}

const UserItem = memo(function UserItem({ user: u, busy, onToggleRole, onToggleActive }: UserItemProps) {
  const name = [u.firstName, u.lastName].filter(Boolean).join(" ") || "—";

  return (
    <li className="au-row">
      <div className="au-cell au-user">
        <Link className="au-username" to={`/admin/users/${u.id}`}>
          {u.username}
        </Link>
      </div>

      <div className="au-cell au-email" data-label="Email" title={u.email}>
        {u.email}
      </div>

      <div className="au-cell au-name" data-label="Name" title={name}>
        {name}
      </div>

      <div className="au-cell au-badges">
        <span className={`au-badge ${u.role === "ADMIN" ? "is-admin" : ""}`}>{u.role}</span>
        <span className={`au-badge ${u.isActive ? "is-ok" : "is-off"}`}>{u.isActive ? "Active" : "Inactive"}</span>
      </div>

      <div className="au-cell au-joined" data-label="Joined">
        {joinedText(u.createdAt)}
      </div>

      <div className="au-cell au-actions">
        <Link className="au-btn" to={`/admin/users/${u.id}`}>
          Edit
        </Link>
        <button type="button" className="au-btn" disabled={busy} onClick={() => onToggleRole(u)}>
          {u.role === "ADMIN" ? "Remove admin" : "Make admin"}
        </button>
        <button
          type="button"
          className={`au-btn ${u.isActive ? "au-btn-danger" : "au-btn-primary"}`}
          disabled={busy}
          onClick={() => onToggleActive(u)}
        >
          {u.isActive ? "Deactivate" : "Activate"}
        </button>
      </div>
    </li>
  );
});

export default function AdminUsers() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<"ALL" | Role>("ALL");
  const [status, setStatus] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [page, setPage] = useState(0);
  const [data, setData] = useState<PagedResponse<AdminUserRow> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Wait for typing to pause before searching the server.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(search.trim());
      setPage(0);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page), size: String(PAGE_SIZE), role, status });
    if (query) params.set("q", query);

    setLoading(true);
    setError("");
    apiFetch<PagedResponse<AdminUserRow>>(`/admin/users?${params.toString()}`, { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch((err: unknown) => {
        if (!isAbortError(err)) setError(err instanceof Error ? err.message : "Could not load users");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [query, role, status, page, reloadKey]);

  const run = useCallback(async (userId: number, success: string, action: () => Promise<unknown>) => {
    setBusyId(userId);
    setError("");
    setNotice("");
    try {
      await action();
      setNotice(success);
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  }, []);

  const toggleRole = useCallback(
    (u: AdminUserRow) => {
      const next: Role = u.role === "ADMIN" ? "USER" : "ADMIN";
      if (!window.confirm(`Change ${u.username} to ${next}?`)) return;
      void run(u.id, `${u.username} is now ${next}`, () =>
        apiFetch(`/users/${u.id}/role`, { method: "PUT", body: JSON.stringify({ role: next }) })
      );
    },
    [run]
  );

  const toggleActive = useCallback(
    (u: AdminUserRow) => {
      const next = !u.isActive;
      if (!window.confirm(`${next ? "Activate" : "Deactivate"} ${u.username}?`)) return;
      void run(u.id, `${u.username} ${next ? "activated" : "deactivated"}`, () =>
        apiFetch(`/admin/users/${u.id}/active`, { method: "PUT", body: JSON.stringify({ active: next }) })
      );
    },
    [run]
  );

  const items = data?.items ?? [];
  const totalPages = data?.totalPages ?? 0;

  return (
    <section className="au-wrap">
      <div className="au-toolbar">
        <input
          type="search"
          aria-label="Search users"
          placeholder="Search name, username, or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="Filter by role"
          value={role}
          onChange={(e) => {
            setRole(e.target.value as "ALL" | Role);
            setPage(0);
          }}
        >
          <option value="ALL">All roles</option>
          <option value="USER">User</option>
          <option value="ADMIN">Admin</option>
        </select>
        <select
          aria-label="Filter by status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as "ALL" | "ACTIVE" | "INACTIVE");
            setPage(0);
          }}
        >
          <option value="ALL">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
      </div>

      {notice && <output className="au-notice">{notice}</output>}
      {error && (
        <div className="au-alert" role="alert">
          {error}
        </div>
      )}

      {loading && !data ? (
        <p className="au-state">Loading users…</p>
      ) : (
        <div className="au-card">
          <div className="au-head" aria-hidden="true">
            <span>Username</span>
            <span>Email</span>
            <span>Name</span>
            <span className="au-col-hidden">Status</span>
            <span className="au-col-hidden">Joined</span>
            <span>Actions</span>
          </div>

          <ul className={`au-list ${loading ? "is-dim" : ""}`} aria-busy={loading}>
            {items.map((u) => (
              <UserItem
                key={u.id}
                user={u}
                busy={busyId === u.id}
                onToggleRole={toggleRole}
                onToggleActive={toggleActive}
              />
            ))}

            {items.length === 0 && !loading && <li className="au-empty">No users match these filters.</li>}
          </ul>
        </div>
      )}

      {data && (
        <nav className="au-pager" aria-label="Users pages">
          <span>
            {data.totalItems} users · page {data.page + 1} of {Math.max(totalPages, 1)}
          </span>
          <button type="button" disabled={page === 0 || loading} onClick={() => setPage((p) => p - 1)}>
            Previous
          </button>
          <button
            type="button"
            disabled={page + 1 >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </nav>
      )}
    </section>
  );
}