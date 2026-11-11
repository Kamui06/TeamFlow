import { useCallback, useEffect, useState } from "react";
import type { SyntheticEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { projectService } from "../services/ProjectService";
import type { Project } from "../services/ProjectService";
import { teamService } from "../services/TeamService";
import { TASK_PRIORITIES, taskService } from "../services/TaskService";
import type { ProjectStatusOption, Task, TaskPriority } from "../services/TaskService";
import { isAbortError } from "../api/api";
import CommentThread from "../Comments/CommentThread";
import "./Tasks.css";

interface Option {
  userId: number;
  username: string;
}

interface EditForm {
  title: string;
  description: string;
  priority: TaskPriority;
  statusId: string;
  dueDate: string;
}

function toForm(task: Task): EditForm {
  return {
    title: task.title,
    description: task.description ?? "",
    priority: task.priority,
    statusId: task.statusId ? String(task.statusId) : "",
    dueDate: task.dueDate ?? "",
  };
}

/*
function sameIds(a: number[], b: number[]) {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort((x, y) => x - y);
  const sortedB = [...b].sort((x, y) => x - y);
  return sortedA.every((value, i) => value === sortedB[i]);
}
*/

async function teamOptions(teamId: number, signal?: AbortSignal): Promise<Option[]> {
  const team = await teamService.getTeamById(teamId, signal);
  return team.members.map((m) => ({ userId: m.userId, username: m.username }));
}

export default function TaskDetail() {
  const { taskId } = useParams();
  const id = Number(taskId);
  const navigate = useNavigate();

  const [task, setTask] = useState<Task | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [statuses, setStatuses] = useState<ProjectStatusOption[]>([]);
  const [members, setMembers] = useState<Option[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [level, setLevel] = useState<string>("NONE");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const applyTask = (t: Task) => {
    setTask(t);
    setForm(toForm(t));
    setProjectId(t.projectId);
    setSelected(t.assignees.map((a) => a.userId));
  };

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const t = await taskService.getTask(id, signal);
      if (signal?.aborted) return;
      applyTask(t);

      const [projectList, project, projectStatuses, memberList] = await Promise.all([
        projectService.getProjects(signal),
        projectService.getProject(t.projectId, signal),
        taskService.getProjectStatuses(t.projectId, signal),
        teamOptions(t.teamId, signal),
      ]);
      if (signal?.aborted) return;

      setProjects(projectList);
      setLevel(project.myProjectLevel ?? "NONE");
      setStatuses(projectStatuses);
      setMembers(memberList);
    } catch (err) {
      if (isAbortError(err)) return;
      setError(err instanceof Error ? err.message : "Unable to load");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const me = localStorage.getItem("username") ?? "";
  const canManage = level === "MANAGER";
  const isMine =
    task !== null &&
    (task.createdByUsername === me || task.assignees.some((a) => a.username === me));
  const canEdit = canManage || (level === "MEMBER" && isMine);
  const canDelete = canManage || (level === "MEMBER" && task?.createdByUsername === me);
  const backTarget = task ? `/projects/${task.projectId}/tasks` : "/tasks";

  /** Switches the task to another project: reloads its statuses and team members. */
  const changeProject = async (newProjectId: number) => {
    const target = projects.find((p) => p.id === newProjectId);
    if (!target) return;

    setError("");
    setNotice("");
    try {
      const [statusList, memberList] = await Promise.all([
        taskService.getProjectStatuses(newProjectId),
        teamOptions(target.teamId),
      ]);

      setProjectId(newProjectId);
      setStatuses(statusList);
      setMembers(memberList);
      setSelected((current) => current.filter((uid) => memberList.some((m) => m.userId === uid)));

      const fallback = statusList.find((s) => s.isDefault) ?? statusList[0];
      setForm((f) => (f ? { ...f, statusId: fallback ? String(fallback.id) : "" } : f));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load that project");
    }
  };

  const reset = async () => {
    if (!task) return;
    if (projectId !== task.projectId) {
      await changeProject(task.projectId);
    }
    setForm(toForm(task));
    setSelected(task.assignees.map((a) => a.userId));
    setProjectId(task.projectId);
  };

  const save = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!task || !form || projectId === null) return;

    setSaving(true);
    setError("");
    setNotice("");
    try {
      const clearingDate = task.dueDate !== null && form.dueDate === "";
      const movingProject = canManage && projectId !== task.projectId;

      const updated = await taskService.updateTask(task.id, {
        ...(movingProject ? { projectId } : {}),
        title: form.title.trim(),
        description: form.description,
        priority: form.priority,
        statusId: form.statusId ? Number(form.statusId) : undefined,
        dueDate: form.dueDate || undefined,
        clearDueDate: clearingDate || undefined,
        ...(canManage ? { assigneeIds: selected } : {}),
      });

      applyTask(updated);
      setNotice("Changes saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save task");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!task || !window.confirm(`Delete "${task.title}"? This cannot be undone.`)) return;
    try {
      await taskService.deleteTask(task.id);
      void navigate(backTarget);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete task");
    }
  };

  const toggleAssignee = (userId: number) => {
    setSelected((current) =>
      current.includes(userId) ? current.filter((x) => x !== userId) : [...current, userId]
    );
  };

  if (loading) {
    return (
      <main className="task-page">
        <p className="task-state">Loading task…</p>
      </main>
    );
  }

  if (!task || !form) {
    return (
      <main className="task-page">
        <div className="task-alert" role="alert">
          {error || "Task not found"}
        </div>
        <Link to="/tasks">Back to tasks</Link>
      </main>
    );
  }

  return (
    <main className="task-page">
      <Link className="task-back" to={backTarget}>
        ← Back to tasks
      </Link>

      <header className="task-page-header">
        <div>
          <p className="task-eyebrow">{task.projectName ?? "TASK"}</p>
          <h1>{task.title}</h1>
          <p className="task-subtle">
            Created by {task.createdByUsername}
            {task.createdAt && ` on ${new Date(task.createdAt).toLocaleDateString()}`}
          </p>
        </div>
        {canDelete && (
          <div className="task-header-actions">
            <button type="button" className="task-btn task-btn-danger" onClick={() => void remove()}>
              Delete
            </button>
          </div>
        )}
      </header>

      {level === "VIEWER" && <output className="task-notice">You have view-only access to this task.</output>}
      {level === "NONE" && <output className="task-notice">You are not a member of this project.</output>}
      {level === "MEMBER" && !isMine && (
        <output className="task-notice">Members can edit only the tasks they created or are assigned to.</output>
      )}
      {error && (
        <div className="task-alert" role="alert">
          {error}
        </div>
      )}
      {notice && <output className="task-notice">{notice}</output>}

      <div className="task-detail-grid">
        <form className="task-card" onSubmit={save}>
          <h2>Details</h2>

          <label>
            Project{" "}
            <select
              value={projectId ?? ""}
              disabled={!canManage}
              onChange={(e) => void changeProject(Number(e.target.value))}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          {canManage && projectId !== task.projectId && (
            <p className="task-hint">
              Moving resets the status to this project's default and keeps only assignees from its team.
            </p>
          )}

          <label>
            Title{" "}
            <input
              required
              maxLength={200}
              value={form.title}
              disabled={!canEdit}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </label>

          <label>
            Description{" "}
            <textarea
              rows={5}
              value={form.description}
              disabled={!canEdit}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </label>

          <div className="task-form-row">
            <label>
              Status{" "}
              <select
                value={form.statusId}
                disabled={!canEdit}
                onChange={(e) => setForm({ ...form, statusId: e.target.value })}
              >
                {statuses.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Priority{" "}
              <select
                value={form.priority}
                disabled={!canEdit}
                onChange={(e) => setForm({ ...form, priority: e.target.value as TaskPriority })}
              >
                {TASK_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Due date{" "}
              <input
                type="date"
                value={form.dueDate}
                disabled={!canEdit}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              />
            </label>
          </div>

          {canEdit && (
            <div className="task-modal-actions">
              <button
                type="button"
                className="task-btn task-btn-secondary"
                onClick={() => void reset()}
                disabled={saving}
              >
                Reset
              </button>
              <button type="submit" className="task-btn task-btn-primary" disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          )}
        </form>

        <aside className="task-card">
          <h2>Assignees</h2>
          <p className="task-hint">Members of this project's team.</p>

          {members.length === 0 ? (
            <p className="task-hint">No members on this team yet.</p>
          ) : (
            <div className="task-assignee-list">
              {members.map((m) => (
                <label key={m.userId} className="task-check-row">
                  <input
                    type="checkbox"
                    checked={selected.includes(m.userId)}
                    disabled={!canManage}
                    onChange={() => toggleAssignee(m.userId)}
                  />
                  <span>{m.username}</span>
                </label>
              ))}
            </div>
          )}

          {!canManage && <p className="task-hint">Only project managers can change assignees.</p>}

          <h2>Summary</h2>
          <dl className="task-meta">
            <dt>Status</dt>
            <dd>{task.statusName ?? "No status"}</dd>
            <dt>Priority</dt>
            <dd>{task.priority}</dd>
            <dt>Due</dt>
            <dd>
              {task.dueDate ? new Date(`${task.dueDate}T00:00:00`).toLocaleDateString() : "Not set"}
            </dd>
          </dl>
        </aside>
      </div>
      <section className="ct-section">
        <CommentThread scope="TASK" targetId={task.id} title="Discussion" subtitle="Comments on this task" />
      </section>
    </main>
  );
}