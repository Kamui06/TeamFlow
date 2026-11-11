import { useEffect, useState, type MouseEvent, type SyntheticEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiFetch, isAbortError } from "../api/api";
import "./AdminPage.css";
import "./AdminDetails.css";

interface AdminUserRow {
  id: number;
  username: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: "USER" | "ADMIN";
  isActive: boolean;
  createdAt: string | null;
}

interface Membership {
  id: number;
  name: string;
  role: string;
}

interface UserDetail {
  user: AdminUserRow;
  teams: Membership[];
  projects: Membership[];
}

interface EditForm {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  confirm: string;
}

const dateText = (value: string | null) =>
  value
    ? new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";

const blankForm: EditForm = { username: "", email: "", firstName: "", lastName: "", password: "", confirm: "" };

export default function AdminUserDetail() {
  const { userId } = useParams();
  const id = Number(userId);
  const navigate = useNavigate();

  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [form, setForm] = useState<EditForm>(blankForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");

    apiFetch<UserDetail>(`/admin/users/${id}`, { signal: controller.signal })
      .then((d) => {
        setDetail(d);
        setForm({
          username: d.user.username,
          email: d.user.email,
          firstName: d.user.firstName ?? "",
          lastName: d.user.lastName ?? "",
          password: "",
          confirm: "",
        });
      })
      .catch((err: unknown) => {
        if (!isAbortError(err)) setError(err instanceof Error ? err.message : "Could not load user");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [id, version]);

  const act = async (action: () => Promise<unknown>, success: string) => {
    setError("");
    setNotice("");
    try {
      await action();
      setNotice(success);
      setVersion((v) => v + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    }
  };

  const save = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setNotice("");

    if (form.password && form.password !== form.confirm) {
      setError("The two passwords do not match");
      return;
    }

    setSaving(true);
    try {
      await apiFetch(`/admin/users/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          username: form.username,
          email: form.email,
          firstName: form.firstName,
          lastName: form.lastName,
          password: form.password,
        }),
      });
      setNotice(
        form.password
          ? "Saved. The user's sessions were ended, so they must log in again."
          : "Saved"
      );
      setVersion((v) => v + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!detail) return;
    if (!window.confirm(`Delete ${detail.user.username}? Their memberships are removed. Work they created is reassigned to you.`)) {
      return;
    }
    setError("");
    try {
      await apiFetch(`/admin/users/${id}`, { method: "DELETE" });
      void navigate("/admin", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete user");
    }
  };

  if (loading) {
    return (
      <main className="admin-page">
        <p className="admin-state">Loading user…</p>
      </main>
    );
  }

  if (!detail) {
    return (
      <main className="admin-page">
        <div className="admin-alert" role="alert">
          {error || "User not found"}
        </div>
        <Link to="/admin">Back to admin</Link>
      </main>
    );
  }

  const u = detail.user;

  function toggleActive(_event: MouseEvent<HTMLButtonElement>): void {
    void act(
      () => apiFetch(`/admin/users/${id}/active`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !u.isActive }),
      }),
      u.isActive ? "User deactivated" : "User activated"
    );
  }

  function toggleRole(_event: MouseEvent<HTMLButtonElement>): void {
    const role = u.role === "ADMIN" ? "USER" : "ADMIN";
    void act(
      () => apiFetch(`/admin/users/${id}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      }),
      role === "ADMIN" ? "User promoted to admin" : "Admin role removed"
    );
  }

  return (
    <main className="ad-page">
      <Link to="/admin" className="ad-back">← Back to admin</Link>

      <header className="ad-head">
        <div>
          <p className="ad-eyebrow">User</p>
          <h1 className="ad-title">{u.username}</h1>
          <p className="ad-meta">
            <span>Joined {dateText(u.createdAt)}</span>
          </p>
        </div>
        <div className="ad-head-actions">
          <span className={`ad-badge ${u.role === "ADMIN" ? "ad-badge-admin" : "ad-badge-member"}`}>{u.role}</span>
          <span className={`ad-badge ${u.isActive ? "ad-badge-ok" : "ad-badge-off"}`}>
            {u.isActive ? "Active" : "Inactive"}
          </span>
          <button type="button" className="ad-btn" onClick={toggleRole}>
            {u.role === "ADMIN" ? "Remove admin" : "Make admin"}
          </button>
          <button
            type="button"
            className={`ad-btn ${u.isActive ? "ad-btn-danger" : "ad-btn-primary"}`}
            onClick={toggleActive}
          >
            {u.isActive ? "Deactivate" : "Activate"}
          </button>
        </div>
      </header>

      {notice && <output className="ad-notice">{notice}</output>}
      {error && <div className="ad-alert" role="alert">{error}</div>}

      <div className="ad-grid">
        <div className="ad-stack">
          <form className="ad-card" onSubmit={save}>
            <h2>Account details</h2>
            <div className="ad-fields">
              <label className="ad-field">
                <span>Username</span>
                <input required minLength={3} maxLength={50} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
              </label>
              <label className="ad-field">
                <span>Email</span>
                <input required type="email" maxLength={100} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </label>
              <label className="ad-field">
                <span>First name</span>
                <input maxLength={100} value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
              </label>
              <label className="ad-field">
                <span>Last name</span>
                <input maxLength={100} value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
              </label>
            </div>

            <h2>Change password</h2>
            <p className="ad-muted">Leave blank to keep the current password. Setting a new one ends the user's active sessions.</p>
            <div className="ad-fields">
              <label className="ad-field">
                <span>New password</span>
                <input type="password" minLength={8} autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </label>
              <label className="ad-field">
                <span>Confirm password</span>
                <input type="password" autoComplete="new-password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
              </label>
            </div>

            <div className="ad-actions">
              <button type="submit" className="ad-btn ad-btn-primary" disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        </div>

        <aside className="ad-stack">
          <section className="ad-card">
            <h2>Teams</h2>
            {detail.teams.length === 0 ? (
              <p className="ad-muted">Not in any team.</p>
            ) : (
              <ul className="ad-list">
                {detail.teams.map((t) => (
                  <li key={t.id}>
                    <div className="ad-list-main">
                      <div className="ad-list-text">
                        <Link to={`/admin/teams/${t.id}`}>{t.name}</Link>
                      </div>
                    </div>
                    <span className={`ad-badge ad-badge-${t.role.toLowerCase()}`}>{t.role}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="ad-card">
            <h2>Projects</h2>
            {detail.projects.length === 0 ? (
              <p className="ad-muted">Not on any project.</p>
            ) : (
              <ul className="ad-list">
                {detail.projects.map((p) => (
                  <li key={p.id}>
                    <div className="ad-list-main">
                      <div className="ad-list-text">
                        <Link to={`/projects/${p.id}`}>{p.name}</Link>
                      </div>
                    </div>
                    <span className={`ad-badge ad-badge-${p.role.toLowerCase()}`}>{p.role}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="ad-card ad-danger">
            <h2>Delete user</h2>
            <p className="ad-muted">Removes the account and its memberships. Tasks and projects they created are reassigned to you.</p>
            <div className="ad-actions">
              <button type="button" className="ad-btn ad-btn-danger-solid" onClick={remove}>Delete user</button>
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}