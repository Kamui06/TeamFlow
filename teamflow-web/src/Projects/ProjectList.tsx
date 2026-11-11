import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { isAbortError } from "../api/api";
import { projectService, type Project } from "../services/ProjectService";
import { teamService, type Team } from "../services/TeamService";
import NewProjectModal from "./NewProjectModal";
import "./ProjectList.css";

type StatusFilter = "ALL" | "ACTIVE" | "COMPLETED" | "ARCHIVED";
type SortKey = "updated" | "name" | "due" | "progress";

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "ACTIVE", label: "Active" },
  { key: "COMPLETED", label: "Completed" },
  { key: "ARCHIVED", label: "Archived" },
];

const SORTS: { key: SortKey; label: string }[] = [
  { key: "updated", label: "Recently updated" },
  { key: "name", label: "Name A–Z" },
  { key: "due", label: "Due date" },
  { key: "progress", label: "Progress" },
];

// Team roles that may create projects. Team VIEWERs are excluded. 
const CAN_CREATE = new Set(["OWNER", "ADMIN", "MEMBER"]);

const dateText = (value: string | null | undefined) =>
  value
    ? new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Not set";

const percentOf = (p: Project) => (p.taskCount ? Math.round((p.completedTaskCount * 100) / p.taskCount) : 0);

function sortProjects(list: Project[], key: SortKey): Project[] {
  const byName = (a: Project, b: Project) => a.name.localeCompare(b.name);
  const comparators: Record<SortKey, (a: Project, b: Project) => number> = {
    updated: (a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "") || byName(a, b),
    name: byName,
    due: (a, b) => {
      if (!a.endDate && !b.endDate) return byName(a, b);
      if (!a.endDate) return 1;
      if (!b.endDate) return -1;
      return a.endDate.localeCompare(b.endDate) || byName(a, b);
    },
    progress: (a, b) => percentOf(b) - percentOf(a) || byName(a, b),
  };
  return [...list].sort(comparators[key]);
}

export default function ProjectList() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("updated");
  const [showCreate, setShowCreate] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");

    Promise.all([projectService.getProjects(controller.signal), teamService.getUserTeams(controller.signal)])
      .then(([projectList, teamList]) => {
        if (controller.signal.aborted) return;
        setProjects(projectList);
        setTeams(teamList);
      })
      .catch((err: unknown) => {
        if (!isAbortError(err)) setError(err instanceof Error ? err.message : "Unable to load projects.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [reloadKey]);

  const refresh = () => setReloadKey((k) => k + 1);

  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t] as const)), [teams]);
  const creatableTeams = useMemo(
    () => teams.filter((t) => t.myRole !== null && CAN_CREATE.has(t.myRole)),
    [teams]
  );

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
    const filtered = projects.filter((p) => {
      if (statusFilter !== "ALL" && p.status !== statusFilter) return false;
      if (!q) return true;
      return [p.name, p.description ?? "", teamById.get(p.teamId)?.name ?? ""].some((value) =>
        value.toLowerCase().includes(q)
      );
    });
    return sortProjects(filtered, sortKey);
  }, [projects, search, statusFilter, sortKey, teamById]);

  const remove = async (p: Project) => {
    if (!window.confirm(`Delete "${p.name}" and all its tasks? This cannot be undone.`)) return;
    setBusyId(p.id);
    setError("");
    setNotice("");
    try {
      await projectService.deleteProject(p.id);
      setNotice(`"${p.name}" deleted`);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete project");
    } finally {
      setBusyId(null);
    }
  };

  const onCreated = (name: string) => {
    setShowCreate(false);
    setNotice(`"${name}" created`);
    refresh();
  };

  return (
    <main className="pl-page">
      <header className="pl-head">
        <div>
          <p className="pl-eyebrow">Workspace</p>
          <h1>Projects</h1>
          <p className="pl-sub">Track progress, deadlines and ownership across every project you can see.</p>
        </div>
        {creatableTeams.length > 0 && (
          <div className="pl-head-actions">
            <button type="button" className="pl-btn pl-btn-primary" onClick={() => setShowCreate(true)}>
              + New project
            </button>
          </div>
        )}
      </header>

      {notice && <output className="pl-notice">{notice}</output>}
      {error && (
        <div className="pl-alert" role="alert">
          {error}
        </div>
      )}

      <section className="pl-summary" aria-label="Project totals">
        <div className="pl-stat">
          <span>Total</span>
          <strong>{counts.total}</strong>
        </div>
        <div className="pl-stat">
          <span>Active</span>
          <strong>{counts.active}</strong>
        </div>
        <div className="pl-stat is-purple">
          <span>Completed</span>
          <strong>{counts.completed}</strong>
        </div>
        <div className="pl-stat is-gray">
          <span>Archived</span>
          <strong>{counts.archived}</strong>
        </div>
      </section>

      <div className="pl-toolbar">
        <input
          type="search"
          className="pl-search"
          aria-label="Search projects"
          placeholder="Search by name, description or team…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <fieldset className="pl-segment" aria-label="Filter by status">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={statusFilter === f.key}
              onClick={() => setStatusFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </fieldset>
        <select
          className="pl-select"
          aria-label="Sort projects"
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
        >
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {loading && projects.length === 0 && <p className="pl-state">Loading projects…</p>}

      {!loading && projects.length === 0 && (
        <p className="pl-empty">No projects yet. Create one to start organizing work.</p>
      )}

      {projects.length > 0 && visible.length === 0 && <p className="pl-empty">No projects match these filters.</p>}

      <div className="pl-list">
        {visible.map((p) => {
          const team = teamById.get(p.teamId);
          const percent = percentOf(p);
          const canDelete = team?.myRole === "OWNER";

          return (
            <article className="pl-card" key={p.id}>
              <header className="pl-card-head">
                <div className="pl-title">
                  <h2>
                    <Link to={`/projects/${p.id}`}>{p.name}</Link>
                  </h2>
                  <span className="pl-team">{team?.name ?? "Unknown team"}</span>
                </div>
                <span className={`pl-status pl-status-${p.status.toLowerCase()}`}>{p.status}</span>
              </header>

              <p className="pl-desc">{p.description?.trim() || "No description."}</p>

              <div className="pl-body">
                <div>
                  <div className="pl-progress-top">
                    <span>Progress</span>
                    <strong>{percent}%</strong>
                  </div>
                  <div className="pl-bar" aria-label={`${percent}% complete`}>
                    <div style={{ width: `${percent}%` }} />
                  </div>
                  <span className="pl-muted">
                    {p.completedTaskCount} of {p.taskCount} tasks complete
                  </span>
                </div>

                <dl className="pl-meta">
                  
                  <div>
                    <dt>Created by</dt>
                    <dd>{p.createdByUsername}</dd>
                  </div>
                  <div>
                    <dt>Start</dt>
                    <dd>{dateText(p.startDate)}</dd>
                  </div>
                  <div>
                    <dt>Due</dt>
                    <dd>{dateText(p.endDate)}</dd>
                  </div>
                  <div>
                    <dt>Last updated</dt>
                    <dd>{dateText(p.updatedAt)}</dd>
                  </div>
                </dl>
              </div>

              <footer className="pl-actions">
                <Link className="pl-btn" to={`/projects/${p.id}/tasks`}>
                  Tasks
                </Link>
                <Link className="pl-btn pl-btn-primary" to={`/projects/${p.id}`}>
                  Open
                </Link>
                {canDelete && (
                  <button
                    type="button"
                    className="pl-btn pl-btn-danger"
                    disabled={busyId === p.id}
                    onClick={() => void remove(p)}
                  >
                    Delete
                  </button>
                )}
              </footer>
            </article>
          );
        })}
      </div>

      {showCreate && (
        <NewProjectModal
          teams={creatableTeams}
          onClose={() => setShowCreate(false)}
          onCreated={onCreated}
        />
      )}
    </main>
  );
}
