import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { isAbortError } from "../api/api";
import UserLink from "../Components/UserLink";
import { projectService, type Project } from "../services/ProjectService";
import { TASK_PRIORITIES, taskService, type Task } from "../services/TaskService";
import CreateTaskModal from "./CreateTaskModal";
import "./TaskPage.css";

type Scope = "all" | "mine";
type SortKey = "due-asc" | "due-desc" | "project-asc" | "project-desc" | "title-asc";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "due-asc", label: "Due date: earliest first" },
  { value: "due-desc", label: "Due date: latest first" },
  { value: "project-asc", label: "Project: A–Z" },
  { value: "project-desc", label: "Project: Z–A" },
  { value: "title-asc", label: "Title: A–Z" },
];

function formatDate(value: string | null) {
  if (!value) return "No date";
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isOverdue(task: Task) {
  if (!task.dueDate || task.statusFinal) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(`${task.dueDate}T00:00:00`) < today;
}

/** Missing due dates always sort last, whichever direction is chosen. */
function compareDue(a: string | null, b: string | null, direction: 1 | -1) {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return direction * a.localeCompare(b);
}

function sortTasks(list: Task[], key: SortKey): Task[] {
  const byTitle = (a: Task, b: Task) => a.title.localeCompare(b.title);
  const byProject = (a: Task, b: Task) => (a.projectName ?? "").localeCompare(b.projectName ?? "");

  const comparators: Record<SortKey, (a: Task, b: Task) => number> = {
    "due-asc": (a, b) => compareDue(a.dueDate, b.dueDate, 1) || byTitle(a, b),
    "due-desc": (a, b) => compareDue(a.dueDate, b.dueDate, -1) || byTitle(a, b),
    "project-asc": (a, b) => byProject(a, b) || compareDue(a.dueDate, b.dueDate, 1) || byTitle(a, b),
    "project-desc": (a, b) => -byProject(a, b) || compareDue(a.dueDate, b.dueDate, 1) || byTitle(a, b),
    "title-asc": byTitle,
  };

  return [...list].sort(comparators[key]);
}

function TaskRow({ task, showProject }: Readonly<{ task: Task; showProject: boolean }>) {
  const overdue = isOverdue(task);
  const flat = showProject ? "" : "is-flat";

  return (
    <li className={`tp-row ${flat}`}>
      <div className="tp-title">
        <Link to={`/tasks/${task.id}`}>{task.title}</Link>
      </div>

      {showProject && <div className="tp-project">{task.projectName ?? "—"}</div>}

      <div className="tp-status-cell">
        <span className={`tp-status ${task.statusFinal ? "is-final" : ""}`}>
          {task.statusName ?? "No status"}
        </span>
      </div>

      <div className="tp-priority-cell">
        <span className={`tp-priority tp-priority-${task.priority.toLowerCase()}`}>{task.priority}</span>
      </div>

      <div className="tp-assignees" title={task.assignees.map((a) => a.username).join(", ")}>
        {task.assignees.length === 0
          ? <span className="tp-muted">Unassigned</span>
          : task.assignees.map((a, i) => (
              <span key={a.userId}>
                {i > 0 && ", "}
                <UserLink id={a.userId} name={a.username} />
              </span>
            ))}
      </div>

      <div className={`tp-due ${overdue ? "is-overdue" : ""}`}>{formatDate(task.dueDate)}</div>
    </li>
  );
}

export default function TaskPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const projectScope = projectId ? Number(projectId) : null;
  const isProjectView = projectScope !== null;

  const [scope, setScope] = useState<Scope>("all");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [assigneeFilter, setAssigneeFilter] = useState("All");
  const [sortKey, setSortKey] = useState<SortKey>("due-asc");
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError("");
      try {
        let data: Task[];
        if (projectScope !== null) {
          data = await taskService.getProjectTasks(projectScope, signal);
        } else if (scope === "mine") {
          data = await taskService.getMyTasks(signal);
        } else {
          data = await taskService.getAllTasks(signal);
        }
        if (signal?.aborted) return;
        setTasks(data);
      } catch (err) {
        if (isAbortError(err)) return;
        setError(err instanceof Error ? err.message : "Unable to load tasks.");
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [projectScope, scope]
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  useEffect(() => {
    if (projectScope === null) {
      setProject(null);
      return;
    }
    const controller = new AbortController();
    projectService
      .getProject(projectScope, controller.signal)
      .then(setProject)
      .catch((err: unknown) => {
        if (!isAbortError(err)) setProject(null);
      });
    return () => controller.abort();
  }, [projectScope]);

  const statusNames = useMemo(
    () => [...new Set(tasks.map((t) => t.statusName).filter((s): s is string => !!s))].sort((a, b) => a.localeCompare(b)),
    [tasks]
  );

  const assigneeNames = useMemo(
    () => [...new Set(tasks.flatMap((t) => t.assignees.map((a) => a.username)))].sort((a, b) => a.localeCompare(b)),
    [tasks]
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();

    const filtered = tasks.filter((t) => {
      const matchesSearch =
        !q || t.title.toLowerCase().includes(q) || (t.projectName ?? "").toLowerCase().includes(q);
      const matchesStatus = statusFilter === "All" || t.statusName === statusFilter;
      const matchesPriority = priorityFilter === "All" || t.priority === priorityFilter;
      const matchesAssignee =
        assigneeFilter === "All" ||
        (assigneeFilter === "Unassigned"
          ? t.assignees.length === 0
          : t.assignees.some((a) => a.username === assigneeFilter));
      return matchesSearch && matchesStatus && matchesPriority && matchesAssignee;
    });

    return sortTasks(filtered, sortKey);
  }, [tasks, search, statusFilter, priorityFilter, assigneeFilter, sortKey]);

  let title = "All tasks";
  if (project) {
    title = `${project.name}: Tasks`;
  } else if (scope === "mine" && !isProjectView) {
    title = "Assigned to me";
  }

  const showProjectColumn = !isProjectView;
  const headClass = `tp-head ${showProjectColumn ? "" : "is-flat"}`;

  const taskContent = (() => {
    if (loading) {
      return <p className="tp-state">Loading tasks…</p>;
    }

    if (rows.length === 0) {
      const noTasks = tasks.length === 0;
      const emptyTitle = noTasks ? "No tasks yet" : "No tasks match your filters";
      const emptyMessage = noTasks
        ? "Create a task to start tracking work."
        : "Try changing the search or filters.";

      return (
        <div className="tp-state">
          <strong>{emptyTitle}</strong>
          <p>{emptyMessage}</p>
        </div>
      );
    }

    return (
      <div className="tp-table">
        <div className={headClass} aria-hidden="true">
          <span>Title</span>
          {showProjectColumn && <span>Project</span>}
          <span>Status</span>
          <span>Priority</span>
          <span>Assignees</span>
          <span>Due</span>
        </div>

        <ul className="tp-list">
          {rows.map((task) => (
            <TaskRow key={task.id} task={task} showProject={showProjectColumn} />
          ))}
        </ul>
      </div>
    );
  })();

  return (
    <main className="task-page">
      <header className="tp-header">
        <div>
          <p className="tp-eyebrow">{project ? "Project" : "Workspace"}</p>
          <h1>{title}</h1>
          <p className="tp-subtle">
            {rows.length} of {tasks.length} tasks
          </p>
        </div>

        <div className="tp-header-actions">
          {project && (
            <button type="button" className="tp-btn tp-btn-secondary" onClick={() => navigate(`/projects/${project.id}`)}>
              Back to project
            </button>
          )}
          <button type="button" className="tp-btn tp-btn-primary" onClick={() => setShowCreate(true)}>
            + New task
          </button>
        </div>
      </header>

      {!isProjectView && (
        <fieldset className="tp-scope">
          <legend>Task scope</legend>
          <button
            type="button"
            className={scope === "all" ? "is-active" : ""}
            aria-pressed={scope === "all"}
            onClick={() => setScope("all")}
          >
            All tasks
          </button>
          <button
            type="button"
            className={scope === "mine" ? "is-active" : ""}
            aria-pressed={scope === "mine"}
            onClick={() => setScope("mine")}
          >
            Assigned to me
          </button>
        </fieldset>
      )}

      <div className="tp-toolbar">
        <input
          type="search"
          className="tp-search"
          aria-label="Search tasks"
          placeholder="Search by title or project…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select aria-label="Filter by status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="All">All statuses</option>
          {statusNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>

        <select aria-label="Filter by priority" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
          <option value="All">All priorities</option>
          {TASK_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>

        <select aria-label="Filter by assignee" value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)}>
          <option value="All">All assignees</option>
          <option value="Unassigned">Unassigned</option>
          {assigneeNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>

        <select aria-label="Sort tasks" value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}>
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="tp-alert" role="alert">
          <span>{error}</span>
          <button type="button" className="tp-btn tp-btn-secondary" onClick={() => void load()}>
            Try again
          </button>
        </div>
      )}

      {taskContent}

      {showCreate && (
        <CreateTaskModal
          defaultProjectId={projectScope}
          lockProject={isProjectView}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            setScope("all");
            void load();
          }}
        />
      )}
    </main>
  );
}