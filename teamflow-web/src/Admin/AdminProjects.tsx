import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch, isAbortError } from "../api/api";
import "./AdminProjects.css";

interface ProjectRow {
  id: number;
  name: string;
  teamId: number;
  teamName: string;
  status: string;
  memberCount: number;
  taskCount: number;
  completedTaskCount?: number;
  createdByUsername: string;
}

type StatusFilter = "ALL" | "ACTIVE" | "COMPLETED" | "ARCHIVED";

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "ACTIVE", label: "Active" },
  { key: "COMPLETED", label: "Completed" },
  { key: "ARCHIVED", label: "Archived" },
];

const TONES = ["ap-tone-blue", "ap-tone-purple", "ap-tone-green", "ap-tone-orange"];

export default function AdminProjects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ALL");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");

    apiFetch<ProjectRow[]>("/admin/projects", { signal: controller.signal })
      .then(setProjects)
      .catch((err: unknown) => {
        if (!isAbortError(err)) setError(err instanceof Error ? err.message : "Unable to load projects.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, []);

  const counts = useMemo(
    () => ({
      total: projects.length,
      active: projects.filter((p) => p.status === "ACTIVE").length,
      completed: projects.filter((p) => p.status === "COMPLETED").length,
      archived: projects.filter((p) => p.status === "ARCHIVED").length,
    }),
    [projects]
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects
      .filter((p) => status === "ALL" || p.status === status)
      .filter(
        (p) =>
          !q ||
          [p.name, p.teamName, p.createdByUsername].some((value) => value.toLowerCase().includes(q))
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [projects, search, status]);

  return (
    <section className="ap-wrap">
      <div className="ap-stats">
        <div className="ap-stat">
          <span>Projects</span>
          <strong>{counts.total}</strong>
        </div>
        <div className="ap-stat is-green">
          <span>Active</span>
          <strong>{counts.active}</strong>
        </div>
        <div className="ap-stat is-purple">
          <span>Completed</span>
          <strong>{counts.completed}</strong>
        </div>
        <div className="ap-stat is-gray">
          <span>Archived</span>
          <strong>{counts.archived}</strong>
        </div>
      </div>

      <div className="ap-toolbar">
        <input
          type="search"
          className="ap-search"
          aria-label="Search projects"
          placeholder="Search by project, team or creator…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <fieldset className="ap-segment" aria-label="Filter by status">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={status === f.key}
              onClick={() => setStatus(f.key)}
            >
              {f.label}
            </button>
          ))}
        </fieldset>
      </div>

      {error && (
        <div className="ap-alert" role="alert">
          {error}
        </div>
      )}

      {loading && <p className="ap-state">Loading projects…</p>}

      {!loading && visible.length === 0 && (
        <p className="ap-state">No projects match these filters.</p>
      )}

      <div className="ap-grid">
        {visible.map((p, i) => {
          const done = p.completedTaskCount ?? 0;
          const percent = p.taskCount ? Math.round((done * 100) / p.taskCount) : 0;

          return (
            <article className="ap-card" key={p.id}>
              <header className="ap-card-head">
                <span className={`ap-avatar ${TONES[i % TONES.length]}`} aria-hidden="true">
                  {p.name.trim().charAt(0).toUpperCase() || "P"}
                </span>
                <div className="ap-card-title">
                  <h2>
                    <Link to={`/admin/projects/${p.id}`}>{p.name}</Link>
                  </h2>
                  <p>
                    <Link to={`/admin/teams/${p.teamId}`}>{p.teamName}</Link>
                  </p>
                </div>
                <span className={`ap-status ap-status-${p.status.toLowerCase()}`}>{p.status}</span>
              </header>

              <dl className="ap-metrics">
                <div>
                  <dt>Members</dt>
                  <dd>{p.memberCount}</dd>
                </div>
                <div>
                  <dt>Tasks</dt>
                  <dd>{p.taskCount}</dd>
                </div>
                <div>
                  <dt>Done</dt>
                  <dd>{percent}%</dd>
                </div>
              </dl>

              <div className="ap-progress" aria-label={`${percent}% complete`}>
                <div style={{ width: `${percent}%` }} />
              </div>

              <footer className="ap-card-foot">
                <span className="ap-muted">By {p.createdByUsername}</span>
                <div className="ap-actions">
                  <button
                    type="button"
                    className="ap-btn"
                    onClick={() => navigate(`/admin/projects/${p.id}`)}
                  >
                    Edit
                  </button>
                  <Link className="ap-btn ap-btn-danger" to={`/admin/projects/${p.id}/delete`}>
                    Delete
                  </Link>
                </div>
              </footer>
            </article>
          );
        })}
      </div>
    </section>
  );
}