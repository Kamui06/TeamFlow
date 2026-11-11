import { useEffect, useState, type SyntheticEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiFetch, isAbortError } from "../api/api";
import "./AdminPage.css";
import "./AdminDetails.css";

type ProjectRole = "MANAGER" | "MEMBER" | "VIEWER";

interface Member {
  userId: number;
  username: string;
  role: string;
}

interface TaskRow {
  id: number;
  title: string;
  priority: string;
  statusName: string | null;
  statusFinal: boolean;
  dueDate: string | null;
  assignees: string[];
}

interface StatusOption {
  id: number;
  name: string;
  position: number | null;
  isFinal: boolean;
}

interface ProjectDetail {
  id: number;
  name: string;
  description: string | null;
  status: string;
  teamId: number;
  teamName: string;
  createdByUsername: string;
  createdAt: string | null;
  members: Member[];
  tasks: TaskRow[];
  statuses: StatusOption[];
  addableMembers: Member[];
}

const ROLES: ProjectRole[] = ["MANAGER", "MEMBER", "VIEWER"];

const dateText = (value: string | null) =>
  value
    ? new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";

export default function AdminProjectDetail() {
  const { projectId } = useParams();
  const id = Number(projectId);
  const navigate = useNavigate();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [newMemberId, setNewMemberId] = useState("");
  const [newMemberRole, setNewMemberRole] = useState<ProjectRole>("MEMBER");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");

    apiFetch<ProjectDetail>(`/admin/projects/${id}`, { signal: controller.signal })
      .then((p) => {
        setProject(p);
        setName(p.name);
        setDescription(p.description ?? "");
      })
      .catch((err: unknown) => {
        if (!isAbortError(err)) setError(err instanceof Error ? err.message : "Could not load project");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [id, version]);

  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      setNotice(success);
      setVersion((v) => v + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const saveDetails = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    void run(
      () =>
        apiFetch(`/admin/projects/${id}`, {
          method: "PUT",
          body: JSON.stringify({ name: name.trim(), description }),
        }),
      "Project updated"
    );
  };

  const addMember = () => {
    if (!newMemberId) return;
    const userId = Number(newMemberId);
    setNewMemberId("");
    void run(
      () =>
        apiFetch(`/admin/projects/${id}/members`, {
          method: "POST",
          body: JSON.stringify({ userId, role: newMemberRole }),
        }),
      "Member added"
    );
  };

  const changeRole = (m: Member, role: string) => {
    void run(
      () =>
        apiFetch(`/admin/projects/${id}/members/${m.userId}`, {
          method: "PUT",
          body: JSON.stringify({ role }),
        }),
      `${m.username} is now ${role}`
    );
  };

  const removeMember = (m: Member) => {
    if (!window.confirm(`Remove ${m.username} from this project? Their tasks here are unassigned.`)) return;
    void run(
      () => apiFetch(`/admin/projects/${id}/members/${m.userId}`, { method: "DELETE" }),
      `${m.username} removed`
    );
  };

  const changeStatus = (taskId: number, statusId: number) => {
    void run(
      () =>
        apiFetch(`/admin/projects/${id}/tasks/${taskId}/status`, {
          method: "PUT",
          body: JSON.stringify({ statusId }),
        }),
      "Status updated"
    );
  };

  const deleteTask = (t: TaskRow) => {
    if (!window.confirm(`Delete the task "${t.title}"? This cannot be undone.`)) return;
    void run(() => apiFetch(`/admin/projects/${id}/tasks/${t.id}`, { method: "DELETE" }), "Task deleted");
  };

  if (loading) {
    return (
      <main className="ad-page">
        <p className="admin-state">Loading project…</p>
      </main>
    );
  }

  if (!project) {
    return (
      <main className="ad-page">
        <div className="ad-alert" role="alert">
          {error || "Project not found"}
        </div>
        <Link to="/admin" className="ad-back">
          ← Back to admin
        </Link>
      </main>
    );
  }

  const completed = project.tasks.filter((t) => t.statusFinal).length;
  const progress = project.tasks.length ? Math.round((completed * 100) / project.tasks.length) : 0;

  return (
    <main className="ad-page">
      <Link to="/admin" className="ad-back">
        ← Back to admin
      </Link>

      <header className="ad-head">
        <div>
          <p className="ad-eyebrow">
            <Link to={`/admin/teams/${project.teamId}`}>{project.teamName}</Link> · Project #{project.id}
          </p>
          <h1 className="ad-title">{project.name}</h1>
          <p className="ad-meta">
            <span className={`ad-badge ad-badge-${project.status.toLowerCase()}`}>{project.status}</span>
            <span>
              Created by {project.createdByUsername} on {dateText(project.createdAt)}
            </span>
          </p>
        </div>
        <div className="ad-head-actions">
          <button type="button" className="ad-btn" onClick={() => navigate(`/projects/${id}`)}>
            Open project page
          </button>
          <Link to={`/admin/projects/${id}/delete`} className="ad-btn ad-btn-danger-solid">
            Delete project
          </Link>
        </div>
      </header>

      {notice && <output className="ad-notice">{notice}</output>}
      {error && (
        <div className="ad-alert" role="alert">
          {error}
        </div>
      )}

      <div className="ad-stats">
        <div className="ad-stat">
          <span>Tasks</span>
          <strong>{project.tasks.length}</strong>
        </div>
        <div className="ad-stat">
          <span>Completed</span>
          <strong>{completed}</strong>
        </div>
        <div className="ad-stat">
          <span>Members</span>
          <strong>{project.members.length}</strong>
        </div>
        <div className="ad-stat">
          <span>Progress</span>
          <strong>{progress}%</strong>
        </div>
      </div>

      <div className="ad-grid">
        <div className="ad-stack">
          <form className="ad-card" onSubmit={saveDetails}>
            <h2>Details</h2>
            <div className="ad-fields">
              <label className="ad-field">
                <span>Name</span>
                <input required maxLength={150} value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <label className="ad-field is-wide">
                <span>Description</span>
                <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
              </label>
            </div>
            <div className="ad-actions">
              <button type="submit" className="ad-btn ad-btn-primary" disabled={busy}>
                Save details
              </button>
            </div>
          </form>

          <section className="ad-card">
            <h2>Tasks</h2>
            {project.tasks.length === 0 ? (
              <p className="ad-muted">No tasks in this project.</p>
            ) : (
              <div className="ad-table">
                <table className="ad-task-table">
                  <colgroup>
                    <col style={{ width: "30%" }} />
                    <col style={{ width: "20%" }} />
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "20%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "8%" }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Task</th>
                      <th>Status</th>
                      <th>Priority</th>
                      <th>Assignees</th>
                      <th>Due</th>
                      <th className="ad-cell-actions">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {project.tasks.map((t) => (
                      <tr key={t.id}>
                        <td data-label="Task">
                          <Link to={`/tasks/${t.id}`} className="ad-task-title">
                            {t.title}
                          </Link>
                        </td>
                        <td data-label="Status">
                          <select
                            className="ad-task-select"
                            aria-label={`Status of ${t.title}`}
                            value={project.statuses.find((s) => s.name === t.statusName)?.id ?? ""}
                            disabled={busy}
                            onChange={(e) => changeStatus(t.id, Number(e.target.value))}
                          >
                            {project.statuses.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td data-label="Priority">
                          <span className={`ad-priority ad-priority-${t.priority.toLowerCase()}`}>{t.priority}</span>
                        </td>
                        <td data-label="Assignees" title={t.assignees.join(", ")}>
                          {t.assignees.length > 0 ? t.assignees.join(", ") : <span className="ad-muted">Unassigned</span>}
                        </td>
                        <td data-label="Due">{dateText(t.dueDate)}</td>
                        <td data-label="Actions" className="ad-cell-actions">
                          <button
                            type="button"
                            className="ad-btn ad-btn-sm ad-btn-danger"
                            disabled={busy}
                            onClick={() => deleteTask(t)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <aside className="ad-stack">
          <section className="ad-card">
            <h2>Members</h2>
            <ul className="ad-list">
              {project.members.map((m) => (
                <li key={m.userId}>
                  <div className="ad-list-main">
                    <span className="ad-avatar" aria-hidden="true">
                      {m.username.charAt(0).toUpperCase()}
                    </span>
                    <strong>{m.username}</strong>
                  </div>
                  <div className="ad-list-controls">
                    <select
                      className="ad-select"
                      aria-label={`Role for ${m.username}`}
                      value={m.role}
                      disabled={busy}
                      onChange={(e) => changeRole(m, e.target.value)}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="ad-btn ad-btn-sm ad-btn-danger"
                      disabled={busy}
                      onClick={() => removeMember(m)}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="ad-card">
            <h2>Add member</h2>
            <div className="ad-fields">
              <label className="ad-field is-wide">
                <span>Team member</span>
                <select value={newMemberId} onChange={(e) => setNewMemberId(e.target.value)}>
                  <option value="">
                    {project.addableMembers.length > 0 ? "Choose a person" : "Everyone is already on the project"}
                  </option>
                  {project.addableMembers.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.username}
                    </option>
                  ))}
                </select>
              </label>
              <label className="ad-field is-wide">
                <span>Role</span>
                <select value={newMemberRole} onChange={(e) => setNewMemberRole(e.target.value as ProjectRole)}>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="ad-actions">
              <button
                type="button"
                className="ad-btn ad-btn-primary"
                disabled={!newMemberId || busy}
                onClick={addMember}
              >
                Add to project
              </button>
            </div>
          </section>

          <section className="ad-card">
            <h2>Statuses</h2>
            <ul className="ad-list">
              {project.statuses.map((s) => (
                <li key={s.id}>
                  <span>{s.name}</span>
                  <span className={`ad-badge ${s.isFinal ? "ad-badge-ok" : "ad-badge-viewer"}`}>
                    {s.isFinal ? "Final" : "Open"}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </main>
  );
}