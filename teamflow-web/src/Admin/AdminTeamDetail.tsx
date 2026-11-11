import { useEffect, useState, type SyntheticEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { isAbortError } from "../api/api";
import { projectService, type Project } from "../services/ProjectService";
import { teamService, type AssignableTeamRole, type Team, type UserSummary } from "../services/TeamService";
import "./AdminPage.css";
import "./AdminDetails.css";

const ROLES: AssignableTeamRole[] = ["ADMIN", "MEMBER", "VIEWER"];

export default function AdminTeamDetail() {
  const { teamId } = useParams();
  const id = Number(teamId);

  const [team, setTeam] = useState<Team | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [candidates, setCandidates] = useState<UserSummary[]>([]);
  const [candidateQuery, setCandidateQuery] = useState("");
  const [newUserId, setNewUserId] = useState("");
  const [newRole, setNewRole] = useState<AssignableTeamRole>("MEMBER");
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [version, setVersion] = useState(0);

  // Team, members, and projects
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");

    Promise.all([
      teamService.getTeamById(id, controller.signal),
      projectService.getTeamProjects(id, controller.signal),
    ])
      .then(([t, list]) => {
        setTeam(t);
        setProjects(list);
        setEditName(t.name);
        setEditDescription(t.description ?? "");
      })
      .catch((err: unknown) => {
        if (!isAbortError(err)) setError(err instanceof Error ? err.message : "Could not load team");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [id, version]);

  // People who can be added, searched by name
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      teamService
        .getAddableUsers(id, candidateQuery.trim(), controller.signal)
        .then(setCandidates)
        .catch((err: unknown) => {
          if (!isAbortError(err)) setCandidates([]);
        });
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [id, candidateQuery, version]);

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
      () => teamService.updateTeam(id, { name: editName.trim(), description: editDescription }),
      "Team updated"
    );
  };

  const addMember = () => {
    if (!newUserId) return;
    const userId = Number(newUserId);
    setNewUserId("");
    void run(() => teamService.addMember(id, userId, newRole), "Member added");
  };

  const changeRole = (userId: number, username: string, role: string) => {
    void run(() => teamService.changeMemberRole(id, userId, role), `${username} is now ${role}`);
  };

  const removeMember = (userId: number, username: string) => {
    if (!window.confirm(`Remove ${username} from ${team?.name ?? "this team"}? They lose access to its projects and tasks.`)) {
      return;
    }
    void run(() => teamService.removeMember(id, userId), `${username} removed`);
  };

  if (loading) {
    return (
      <main className="ad-page">
        <p className="admin-state">Loading team…</p>
      </main>
    );
  }

  if (!team) {
    return (
      <main className="ad-page">
        <div className="ad-alert" role="alert">
          {error || "Team not found"}
        </div>
        <Link to="/admin" className="ad-back">
          ← Back to admin
        </Link>
      </main>
    );
  }

  const activeCount = projects.filter((p) => p.status === "ACTIVE").length;
  const completedCount = projects.filter((p) => p.status === "COMPLETED").length;

  return (
    <main className="ad-page">
      <Link to="/admin" className="ad-back">
        ← Back to admin
      </Link>

      <header className="ad-head">
        <div>
          <p className="ad-eyebrow">Team #{team.id}</p>
          <h1 className="ad-title">{team.name}</h1>
          <p className="ad-meta">
            <span>Owner: {team.ownerUsername}</span>
            <span>{team.memberCount} members</span>
            <span>{projects.length} projects</span>
          </p>
        </div>
        <div className="ad-head-actions">
          <Link to={`/admin/teams/${team.id}/delete`} className="ad-btn ad-btn-danger-solid">
            Delete team
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
          <span>Members</span>
          <strong>{team.memberCount}</strong>
        </div>
        <div className="ad-stat">
          <span>Projects</span>
          <strong>{projects.length}</strong>
        </div>
        <div className="ad-stat">
          <span>Active</span>
          <strong>{activeCount}</strong>
        </div>
        <div className="ad-stat">
          <span>Completed</span>
          <strong>{completedCount}</strong>
        </div>
      </div>

      <div className="ad-grid">
        <div className="ad-stack">
          <form className="ad-card" onSubmit={saveDetails}>
            <h2>Details</h2>
            <div className="ad-fields">
              <label className="ad-field">
                <span>Team name</span>
                <input required maxLength={100} value={editName} onChange={(e) => setEditName(e.target.value)} />
              </label>
              <label className="ad-field is-wide">
                <span>Description</span>
                <textarea
                  rows={3}
                  maxLength={500}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                />
              </label>
            </div>
            <div className="ad-actions">
              <button type="submit" className="ad-btn ad-btn-primary" disabled={busy}>
                Save details
              </button>
            </div>
          </form>

          <section className="ad-card">
            <h2>Members</h2>
            <ul className="ad-list">
              {team.members.map((m) => (
                <li key={m.userId}>
                  <div className="ad-list-main">
                    <span className="ad-avatar" aria-hidden="true">
                      {m.username.charAt(0).toUpperCase()}
                    </span>
                    <div className="ad-list-text">
                      <strong>{m.username}</strong>
                      <span>{[m.firstName, m.lastName].filter(Boolean).join(" ") || "—"}</span>
                    </div>
                  </div>
                  <div className="ad-list-controls">
                    {m.role === "OWNER" ? (
                      <span className="ad-badge ad-badge-owner">OWNER</span>
                    ) : (
                      <>
                        <select
                          className="ad-select"
                          aria-label={`Role for ${m.username}`}
                          value={m.role}
                          disabled={busy}
                          onChange={(e) => changeRole(m.userId, m.username, e.target.value)}
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
                          onClick={() => removeMember(m.userId, m.username)}
                        >
                          Remove
                        </button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="ad-card">
            <h2>Add member</h2>
            <div className="ad-fields">
              <label className="ad-field">
                <span>Search people</span>
                <input
                  type="search"
                  placeholder="Type a name…"
                  value={candidateQuery}
                  onChange={(e) => setCandidateQuery(e.target.value)}
                />
              </label>
              <label className="ad-field">
                <span>Role</span>
                <select value={newRole} onChange={(e) => setNewRole(e.target.value as AssignableTeamRole)}>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
              <label className="ad-field is-wide">
                <span>Person</span>
                <select value={newUserId} onChange={(e) => setNewUserId(e.target.value)}>
                  <option value="">{candidates.length > 0 ? "Choose a person" : "No one available"}</option>
                  {candidates.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.username}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="ad-actions">
              <button
                type="button"
                className="ad-btn ad-btn-primary"
                disabled={!newUserId || busy}
                onClick={addMember}
              >
                Add to team
              </button>
            </div>
          </section>
        </div>

        <aside className="ad-stack">
          <section className="ad-card">
            <h2>Projects this team works on</h2>
            {projects.length === 0 ? (
              <p className="ad-muted">No projects yet.</p>
            ) : (
              <ul className="ad-list">
                {projects.map((p) => (
                  <li key={p.id}>
                    <div className="ad-list-main">
                      <div className="ad-list-text">
                        <Link to={`/projects/${p.id}`}>{p.name}</Link>
                        <span>
                          {p.status} · {p.completedTaskCount}/{p.taskCount} done
                        </span>
                      </div>
                    </div>
                    <span className={`ad-badge ad-badge-${p.status.toLowerCase()}`}>{p.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}