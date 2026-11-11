import { useCallback, useEffect, useMemo, useState } from "react";
import type { SyntheticEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiFetch, isAbortError } from "../api/api";
import { projectService } from "../services/ProjectService";
import type { Project } from "../services/ProjectService";
import { teamService } from "../services/TeamService";
import type { Team } from "../services/TeamService";
import { taskService } from "../services/TaskService";
import type { ProjectMemberOption, Task } from "../services/TaskService";
import CreateTaskModal from "../Tasks/CreateTaskModal";
import CommentThread from "../Comments/CommentThread";
import ProjectDateFields from "./ProjectDateFields";
import { dueDateError, todayKey } from "./ProjectDates";
import "./ProjectDetails.css";

type TaskSort = "incomplete-first" | "completed-first" | "due-asc" | "due-desc" | "title";
type ProjectRole = "MANAGER" | "MEMBER" | "VIEWER";

interface Candidate {
  id: number;
  username: string;
  firstName: string | null;
  lastName: string | null;
}

const SORT_OPTIONS: { value: TaskSort; label: string }[] = [
  { value: "incomplete-first", label: "Incomplete first" },
  { value: "completed-first", label: "Completed first" },
  { value: "due-asc", label: "Due date: earliest first" },
  { value: "due-desc", label: "Due date: latest first" },
  { value: "title", label: "Title A–Z" },
];

const PROJECT_ROLES: ProjectRole[] = ["MANAGER", "MEMBER", "VIEWER"];

function dateOnly(value: string | null | undefined) {
  return value ? value.slice(0, 10) : null;
}

function formatDate(value: string | null | undefined) {
  const d = dateOnly(value);
  if (!d) return "Not set";
  return new Date(`${d}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function personName(first: string | null, last: string | null, username: string) {
  return [first, last].filter(Boolean).join(" ") || username;
}

/** Missing due dates always sort last. */
function compareDue(a: string | null, b: string | null, direction: 1 | -1) {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return direction * a.localeCompare(b);
}

function sortTasks(list: Task[], sort: TaskSort): Task[] {
  const byTitle = (a: Task, b: Task) => a.title.localeCompare(b.title);

  const comparators: Record<TaskSort, (a: Task, b: Task) => number> = {
    "incomplete-first": (a, b) =>
      Number(a.statusFinal) - Number(b.statusFinal) ||
      compareDue(a.dueDate, b.dueDate, 1) ||
      byTitle(a, b),
    "completed-first": (a, b) =>
      Number(b.statusFinal) - Number(a.statusFinal) ||
      compareDue(a.dueDate, b.dueDate, 1) ||
      byTitle(a, b),
    "due-asc": (a, b) => compareDue(a.dueDate, b.dueDate, 1) || byTitle(a, b),
    "due-desc": (a, b) => compareDue(a.dueDate, b.dueDate, -1) || byTitle(a, b),
    title: byTitle,
  };

  return [...list].sort(comparators[sort]);
}

function Stat({ label, value, tone = "" }: Readonly<{ label: string; value: number | string; tone?: string }>) {
  return (
    <div className={`pv-stat ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function ProjectDetails() {
  const { projectId } = useParams();
  const id = Number(projectId);
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [projectMembers, setProjectMembers] = useState<ProjectMemberOption[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [taskSort, setTaskSort] = useState<TaskSort>("incomplete-first");
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo, setDueTo] = useState("");
  const [creatingTask, setCreatingTask] = useState(false);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDue, setEditDue] = useState("");

  const [newMemberId, setNewMemberId] = useState("");
  const [newMemberRole, setNewMemberRole] = useState<ProjectRole>("MEMBER");

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError("");

      try {
        const p = await projectService.getProject(id, signal);
        const canManageNow = p.myProjectLevel === "MANAGER";

        const [taskList, members, teamDetail, candidateList] = await Promise.all([
          taskService.getProjectTasks(id, signal),
          taskService.getProjectMembers(id, signal),
          teamService.getTeamById(p.teamId, signal),
          canManageNow
            ? apiFetch<Candidate[]>(`/projects/${id}/candidates`, { signal })
            : Promise.resolve<Candidate[]>([]),
        ]);
        if (signal?.aborted) return;

        setProject(p);
        setEditDue(dateOnly(p.endDate) ?? "");
        setTasks(taskList);
        setProjectMembers(members);
        setTeam(teamDetail);
        setCandidates(candidateList);
      } catch (err) {
        if (isAbortError(err)) return;
        setError(err instanceof Error ? err.message : "Unable to load");
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [id]
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const level = project?.myProjectLevel ?? "NONE";
  const canManage = level === "MANAGER";
  const archived = project?.status === "ARCHIVED";
  const canCreateTask = (level === "MANAGER" || level === "MEMBER") && !archived;
  const canArchive = canManage && project?.status === "COMPLETED";
  const canDeleteProject = team?.myRole === "OWNER";

  const completed = tasks.filter((t) => t.statusFinal).length;
  const incomplete = tasks.length - completed;
  const progress = tasks.length ? Math.round((completed * 100) / tasks.length) : 0;
  const rangeInvalid = Boolean(dueFrom && dueTo && dueFrom > dueTo);

  const visibleTasks = useMemo(() => {
    if (rangeInvalid) return [];
    const inRange = tasks.filter((t) => {
      if (dueFrom && (!t.dueDate || t.dueDate < dueFrom)) return false;
      if (dueTo && (!t.dueDate || t.dueDate > dueTo)) return false;
      return true;
    });
    return sortTasks(inRange, taskSort);
  }, [tasks, taskSort, dueFrom, dueTo, rangeInvalid]);

  const run = async (action: () => Promise<unknown>, success: string) => {
    setError("");
    setNotice("");
    try {
      await action();
      setNotice(success);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    }
  };

  const startEdit = () => {
    if (!project) return;
    setEditName(project.name);
    setEditDescription(project.description ?? "");
    setEditDue(dateOnly(project.endDate) ?? "");
    setEditing(true);
  };

  const saveEdit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!project) return;

    // The start date is fixed, so the due date must be on or after it.
    const startKey = dateOnly(project.startDate) ?? todayKey();
    const dateProblem = dueDateError(editDue, startKey);
    if (dateProblem) {
      setError(dateProblem);
      return;
    }

    setSaving(true);
    try {
      await projectService.updateProject(id, {
        name: editName.trim(),
        description: editDescription,
        endDate: editDue || null,
        clearEndDate: !editDue,
      });
      setEditing(false);
      setNotice("Project updated");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the project");
    } finally {
      setSaving(false);
    }
  };

  const addMember = () => {
    if (!newMemberId) return;
    const userId = Number(newMemberId);
    setNewMemberId("");
    void run(
      () =>
        apiFetch(`/projects/${id}/members`, {
          method: "POST",
          body: JSON.stringify({ userId, role: newMemberRole }),
        }),
      "Member added"
    );
  };

  const removeMember = (m: ProjectMemberOption) => {
    if (!window.confirm(`Remove ${m.username} from this project? Their tasks here will be unassigned.`)) {
      return;
    }
    void run(
      () => apiFetch(`/projects/${id}/members/${m.userId}`, { method: "DELETE" }),
      `${m.username} removed`
    );
  };

  const deleteProject = async () => {
    if (!project || !window.confirm(`Delete "${project.name}" and all its tasks? This cannot be undone.`)) {
      return;
    }
    try {
      await projectService.deleteProject(id);
      void navigate("/projects");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete project");
    }
  };

  const archive = () => {
    if (!window.confirm("Archive this project? It will become read-only for everyone.")) return;
    void run(() => projectService.archiveProject(id), "Project archived");
  };

  if (loading) {
    return (
      <main className="pv-page">
        <p className="pv-state">Loading project…</p>
      </main>
    );
  }

  if (!project || !team) {
    return (
      <main className="pv-page">
        <div className="pv-alert" role="alert">
          {error || "Project not found"}
        </div>
        <Link to="/projects">Back to projects</Link>
      </main>
    );
  }

  return (
    <main className="pv-page">
      <Link className="pv-back" to="/projects">
        ← Back to projects
      </Link>

      <header className="pv-header">
        <div>
          <p className="pv-eyebrow">
            <Link to="/teams">{team.name}</Link> · TEAM #{team.id}
          </p>
          <h1>{project.name}</h1>
          <p className="pv-subtle">
            Created by {project.createdByUsername} · Starts {formatDate(project.startDate)} · Due{" "}
            {formatDate(project.endDate)}
          </p>
        </div>

        <div className="pv-header-actions">
          <span className={`pv-status pv-status-${project.status.toLowerCase()}`}>{project.status}</span>
          <button type="button" className="pv-btn pv-btn-secondary" onClick={() => navigate(`/projects/${id}/tasks`)}>
            Open task board
          </button>

          {canManage && !archived && !editing && (
            <button type="button" className="pv-btn pv-btn-secondary" onClick={startEdit}>
              Edit
            </button>
          )}
          {canArchive && (
            <button type="button" className="pv-btn pv-btn-primary" onClick={archive}>
              Archive project
            </button>
          )}
          {canDeleteProject && (
            <button type="button" className="pv-btn pv-btn-danger" onClick={() => void deleteProject()}>
              Delete
            </button>
          )}
        </div>
      </header>

      {notice && <output className="pv-notice">{notice}</output>}
      {error && (
        <div className="pv-alert" role="alert">
          {error}
        </div>
      )}

      {editing && (
        <form className="pv-card pv-edit" onSubmit={saveEdit}>
          <label>
            Name{" "}
            <input
              required
              maxLength={150}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              disabled={saving}
            />
          </label>
          <label>
            Description{" "}
            <textarea
              rows={3}
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              disabled={saving}
            />
          </label>

          <ProjectDateFields
            startDate={project.startDate}
            dueDate={editDue}
            onDueChange={setEditDue}
            disabled={saving}
          />

          <p className="pv-hint">The status updates itself: it becomes COMPLETED when every task is finished.</p>
          <div className="pv-actions">
            <button
              type="button"
              className="pv-btn pv-btn-secondary"
              onClick={() => setEditing(false)}
              disabled={saving}
            >
              Cancel
            </button>
            <button type="submit" className="pv-btn pv-btn-primary" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      )}

      <section className="pv-stats">
        <Stat label="Total tasks" value={tasks.length} />
        <Stat label="Completed" value={completed} tone="green" />
        <Stat label="Incomplete" value={incomplete} tone="orange" />
        <Stat label="Progress" value={`${progress}%`} />
        <Stat label="Team members" value={team.memberCount} />
      </section>
      <div className="pv-progress" aria-label={`${progress}% complete`}>
        <div style={{ width: `${progress}%` }} />
      </div>

      <div className="pv-columns">
        <section className="pv-card">
          <h2>Team</h2>
          <p className="pv-subtle">
            {team.name} · you are {team.myRole ?? "not a member"}
          </p>
          <ul className="pv-people">
            {team.members.map((m) => (
              <li key={m.userId}>
                <span className="pv-avatar">{m.username[0]?.toUpperCase()}</span>
                <span className="pv-person-name">{personName(m.firstName, m.lastName, m.username)}</span>
                <span className="pv-role">{m.role}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="pv-card">
          <h2>Project members</h2>

          {canManage && (
            <div className="pv-add">
              <select
                aria-label="Choose a team member"
                value={newMemberId}
                onChange={(e) => setNewMemberId(e.target.value)}
              >
                <option value="">
                  {candidates.length > 0 ? "Choose a team member" : "Everyone is already on the project"}
                </option>
                {candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.username}
                  </option>
                ))}
              </select>
              <select
                aria-label="Project role"
                value={newMemberRole}
                onChange={(e) => setNewMemberRole(e.target.value as ProjectRole)}
              >
                {PROJECT_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <button type="button" className="pv-btn pv-btn-primary" disabled={!newMemberId} onClick={addMember}>
                Add
              </button>
            </div>
          )}

          <ul className="pv-people">
            {projectMembers.map((m) => (
              <li key={m.userId}>
                <span className="pv-avatar">{m.username[0]?.toUpperCase()}</span>
                <span className="pv-person-name">{personName(m.firstName, m.lastName, m.username)}</span>
                <span className="pv-role">{m.role}</span>
                {canManage && (
                  <button type="button" className="pv-link-danger" onClick={() => removeMember(m)}>
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="pv-card">
        <div className="pv-tasks-head">
          <div>
            <h2>Tasks</h2>
            <p className="pv-subtle">
              Showing {visibleTasks.length} of {tasks.length} · {completed} completed, {incomplete} incomplete
            </p>
          </div>
          {canCreateTask && (
            <button type="button" className="pv-btn pv-btn-primary" onClick={() => setCreatingTask(true)}>
              + New task
            </button>
          )}
        </div>

        <div className="pv-toolbar">
          <label>
            Sort by{" "}
            <select value={taskSort} onChange={(e) => setTaskSort(e.target.value as TaskSort)}>
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Due from{" "}
            <input type="date" value={dueFrom} onChange={(e) => setDueFrom(e.target.value)} />
          </label>
          <label>
            Due to{" "}
            <input type="date" value={dueTo} onChange={(e) => setDueTo(e.target.value)} />
          </label>
          <button
            type="button"
            className="pv-btn pv-btn-secondary"
            disabled={!dueFrom && !dueTo}
            onClick={() => {
              setDueFrom("");
              setDueTo("");
            }}
          >
            Clear dates
          </button>
        </div>

        {rangeInvalid && <p className="pv-alert">The start date is after the end date.</p>}
        {!rangeInvalid && (dueFrom || dueTo) && (
          <p className="pv-hint">Tasks without a due date are hidden while a date range is set.</p>
        )}

        {tasks.length === 0 ? (
          <p className="pv-state">No tasks in this project yet.</p>
        ) : (
          <div className="pv-table" role="table">
            <div className="pv-row pv-row-head" role="row">
              <span role="columnheader">Task</span>
              <span role="columnheader">State</span>
              <span role="columnheader">Status</span>
              <span role="columnheader">Priority</span>
              <span role="columnheader">Assignees</span>
              <span role="columnheader">Due</span>
            </div>

            {visibleTasks.map((t) => (
              <div key={t.id} className="pv-row" role="row">
                <span role="cell">
                  <Link to={`/tasks/${t.id}`}>{t.title}</Link>
                </span>
                <span role="cell">
                  <span className={`pv-chip ${t.statusFinal ? "done" : "open"}`}>
                    {t.statusFinal ? "Completed" : "Incomplete"}
                  </span>
                </span>
                <span role="cell">{t.statusName ?? "No status"}</span>
                <span role="cell">{t.priority}</span>
                <span role="cell">
                  {t.assignees.length > 0 ? t.assignees.map((a) => a.username).join(", ") : "Unassigned"}
                </span>
                <span role="cell">{formatDate(t.dueDate)}</span>
              </div>
            ))}

            {visibleTasks.length === 0 && <p className="pv-state">No tasks match these dates.</p>}
          </div>
        )}
      </section>

      {creatingTask && (
        <CreateTaskModal
          defaultProjectId={id}
          lockProject
          onClose={() => setCreatingTask(false)}
          onCreated={() => {
            setCreatingTask(false);
            setNotice("Task created");
            void load();
          }}
        />
      )}

      <section className="ct-section">
        <CommentThread
          scope="PROJECT"
          targetId={id}
          title="Project comments"
          subtitle="Discuss this project with its members"
        />
      </section>
    </main>
  );
}