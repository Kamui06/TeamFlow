import { useEffect, useState, type SyntheticEvent } from "react";
import Dialog from "../Components/Dialog";
import { projectService, type Project } from "../services/ProjectService";
import { teamService, type Team } from "../services/TeamService";
import { TASK_PRIORITIES, taskService, type ProjectStatusOption, type TaskPriority } from "../services/TaskService";

interface AssigneeCandidate {
  userId: number;
  username: string;
}

const ASSIGNING_LEVELS = new Set(["MANAGER"]);
const WRITING_LEVELS = new Set(["MANAGER", "MEMBER"]);

export interface CreateTaskModalProps {
  readonly defaultProjectId: number | null;
  /** When true, team and project are fixed to defaultProjectId. */
  readonly lockProject?: boolean;
  readonly onClose: () => void;
  readonly onCreated: () => void;
}

export default function CreateTaskModal({
  defaultProjectId,
  lockProject = false,
  onClose,
  onCreated,
}: CreateTaskModalProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<AssigneeCandidate[]>([]);
  const [statuses, setStatuses] = useState<ProjectStatusOption[]>([]);
  const [level, setLevel] = useState<string>("NONE");
  const [loadingRefs, setLoadingRefs] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({
    teamId: "",
    projectId: "",
    title: "",
    description: "",
    priority: "MEDIUM" as TaskPriority,
    statusId: "",
    dueDate: "",
    assigneeIds: [] as number[],
  });

  useEffect(() => {
    let cancelled = false;
    Promise.all([teamService.getUserTeams(), projectService.getProjects()])
      .then(([teamList, projectList]) => {
        if (cancelled) return;
        setTeams(teamList.filter((t) => t.myRole !== null && t.myRole !== "VIEWER"));
        setProjects(projectList);
        if (defaultProjectId) {
          const preset = projectList.find((p) => p.id === defaultProjectId);
          if (preset) {
            setForm((f) => ({ ...f, teamId: String(preset.teamId), projectId: String(preset.id) }));
          }
        }
      })
      .catch(() => {
        if (!cancelled) setFormError("Could not load teams and projects");
      })
      .finally(() => {
        if (!cancelled) setLoadingRefs(false);
      });
    return () => {
      cancelled = true;
    };
  }, [defaultProjectId]);

  useEffect(() => {
    if (!form.teamId) {
      setMembers([]);
      return;
    }
    let cancelled = false;
    teamService
      .getTeamById(Number(form.teamId))
      .then((team) => {
        if (!cancelled) setMembers(team.members.map((m) => ({ userId: m.userId, username: m.username })));
      })
      .catch(() => {
        if (!cancelled) setFormError("Could not load team members");
      });
    return () => {
      cancelled = true;
    };
  }, [form.teamId]);

  useEffect(() => {
    if (!form.projectId) {
      setStatuses([]);
      setLevel("NONE");
      return;
    }
    let cancelled = false;
    const id = Number(form.projectId);
    Promise.all([taskService.getProjectStatuses(id), projectService.getProject(id)])
      .then(([statusList, detail]) => {
        if (cancelled) return;
        setStatuses(statusList);
        setLevel(detail.myProjectLevel ?? "NONE");
        const fallback = statusList.find((s) => s.isDefault) ?? statusList[0];
        setForm((f) => ({ ...f, statusId: fallback ? String(fallback.id) : "", assigneeIds: [] }));
      })
      .catch(() => {
        if (!cancelled) setFormError("Could not load project details");
      });
    return () => {
      cancelled = true;
    };
  }, [form.projectId]);

  const canWrite = WRITING_LEVELS.has(level);
  const canAssign = ASSIGNING_LEVELS.has(level);
  const teamProjects = projects.filter((p) => String(p.teamId) === form.teamId);

  const toggleAssignee = (userId: number) => {
    setForm((f) => ({
      ...f,
      assigneeIds: f.assigneeIds.includes(userId)
        ? f.assigneeIds.filter((id) => id !== userId)
        : [...f.assigneeIds, userId],
    }));
  };

  const submit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.teamId) return setFormError("Choose a team first");
    if (!form.projectId) return setFormError("Choose a project");
    if (!canWrite) return setFormError("You need member access to create tasks in this project");

    setSaving(true);
    setFormError("");
    try {
      await taskService.createTask({
        projectId: Number(form.projectId),
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        priority: form.priority,
        statusId: form.statusId ? Number(form.statusId) : undefined,
        dueDate: form.dueDate || undefined,
        assigneeIds: canAssign && form.assigneeIds.length > 0 ? form.assigneeIds : undefined,
      });
      onCreated();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not create task");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      eyebrow="New task"
      title="Add a task"
      size="lg"
      onClose={onClose}
      locked={saving}
      footer={
        <>
          <button type="button" className="dlg-btn" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            type="submit"
            form="new-task-form"
            className="dlg-btn dlg-btn-primary"
            disabled={saving || loadingRefs || !canWrite}
          >
            {saving ? "Creating…" : "Create task"}
          </button>
        </>
      }
    >
      <form id="new-task-form" className="dlg-form" onSubmit={submit}>
        <div className="dlg-row">
          <label className="dlg-field">
            <span>Team</span>
            <select
              required
              value={form.teamId}
              disabled={loadingRefs || lockProject}
              onChange={(e) => setForm((f) => ({ ...f, teamId: e.target.value, projectId: "", assigneeIds: [] }))}
            >
              <option value="">Select a team</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>

          <label className="dlg-field">
            <span>Project</span>
            <select
              required
              value={form.projectId}
              disabled={!form.teamId || lockProject}
              onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value, assigneeIds: [] }))}
            >
              <option value="">{form.teamId ? "Select a project" : "Choose a team first"}</option>
              {teamProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {form.projectId && !canWrite && (
          <p className="dlg-error" role="alert">
            Your access in this project is {level.toLowerCase()}. You can't create tasks here.
          </p>
        )}

        <label className="dlg-field">
          <span>Title</span>
          <input
            required
            maxLength={200}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="What needs to be done?"
          />
        </label>

        <label className="dlg-field">
          <span>Description</span>
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Add details (optional)"
          />
        </label>

        <div className="dlg-row dlg-row-3">
          <label className="dlg-field">
            <span>Priority</span>
            <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as TaskPriority })}>
              {TASK_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>

          <label className="dlg-field">
            <span>Status</span>
            <select
              value={form.statusId}
              disabled={statuses.length === 0}
              onChange={(e) => setForm({ ...form, statusId: e.target.value })}
            >
              {statuses.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>

          <label className="dlg-field">
            <span>Due date</span>
            <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
          </label>
        </div>

        <fieldset className="dlg-assignees" disabled={!canAssign}>
          <legend>Assignees</legend>

          {!form.teamId && <p className="dlg-hint">Choose a team to see its members.</p>}
          {form.teamId && members.length === 0 && <p className="dlg-hint">No members on this team yet.</p>}

          {members.length > 0 && (
            <div className="dlg-chips">
              {members.map((m) => {
                const selected = form.assigneeIds.includes(m.userId);
                return (
                  <label key={m.userId} className={`dlg-chip ${selected ? "is-selected" : ""}`}>
                    <input type="checkbox" checked={selected} onChange={() => toggleAssignee(m.userId)} />
                    <span>{m.username}</span>
                  </label>
                );
              })}
            </div>
          )}

          {form.projectId && !canAssign && (
            <p className="dlg-hint">Only project managers can assign people. The task will be created unassigned.</p>
          )}
        </fieldset>

        {formError && (
          <p className="dlg-error" role="alert">
            {formError}
          </p>
        )}
      </form>
    </Dialog>
  );
}