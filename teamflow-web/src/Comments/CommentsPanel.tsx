import { useEffect, useMemo, useState } from "react";
import { isAbortError } from "../api/api";
import { projectService, type Project } from "../services/ProjectService";
import { taskService, type Task } from "../services/TaskService";
import { teamService, type Team } from "../services/TeamService";
import CommentThread from "./CommentThread";
import "./CommentThread.css";

type Section = "global" | "project";

export default function CommentsPanel() {
  const [section, setSection] = useState<Section>("global");
  const [teams, setTeams] = useState<Team[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [teamId, setTeamId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [loadError, setLoadError] = useState("");

  // Teams and projects load only when the project view is opened.
  useEffect(() => {
    if (section !== "project") return;
    const controller = new AbortController();
    Promise.all([teamService.getUserTeams(controller.signal), projectService.getProjects(controller.signal)])
      .then(([teamList, projectList]) => {
        setTeams(teamList);
        setProjects(projectList);
      })
      .catch((err: unknown) => {
        if (!isAbortError(err)) setLoadError("Could not load teams and projects");
      });
    return () => controller.abort();
  }, [section]);

  // Tasks load for the chosen project. Changing the project clears the task choice.
  useEffect(() => {
    setTaskId("");
    setTasks([]);
    if (!projectId) return;
    const controller = new AbortController();
    taskService
      .getProjectTasks(Number(projectId), controller.signal)
      .then(setTasks)
      .catch((err: unknown) => {
        if (!isAbortError(err)) setLoadError("Could not load tasks");
      });
    return () => controller.abort();
  }, [projectId]);

  const teamProjects = useMemo(() => projects.filter((p) => String(p.teamId) === teamId), [projects, teamId]);
  const selectedProject = projects.find((p) => String(p.id) === projectId) ?? null;
  const selectedTask = tasks.find((t) => String(t.id) === taskId) ?? null;

  let target: { scope: "TASK" | "PROJECT"; id: number; title: string; subtitle: string } | null = null;
  if (selectedTask) {
    target = { scope: "TASK", id: selectedTask.id, title: selectedTask.title, subtitle: `Task in ${selectedProject?.name ?? "this project"}` };
  } else if (selectedProject) {
    target = { scope: "PROJECT", id: selectedProject.id, title: selectedProject.name, subtitle: "Project discussion" };
  }

  return (
    <div className="cp-wrap">
      <div className="cp-switch" role="tablist" aria-label="Comment sections">
        <button type="button" role="tab" aria-selected={section === "global"} className={section === "global" ? "active" : ""} onClick={() => setSection("global")}>
          Global comments
        </button>
        <button type="button" role="tab" aria-selected={section === "project"} className={section === "project" ? "active" : ""} onClick={() => setSection("project")}>
          Project comments
        </button>
      </div>

      {loadError && <div className="ct-alert" role="alert">{loadError}</div>}

      {section === "global" && (
        <CommentThread
          key="global"
          scope="GLOBAL"
          targetId={null}
          title="Global comments"
          subtitle="Visible to everyone in the workspace"
        />
      )}

      {section === "project" && (
        <>
          <div className="cp-pickers">
            <label className="cp-picker">
              <span>Team</span>
              <select value={teamId} onChange={(e) => { setTeamId(e.target.value); setProjectId(""); }}>
                <option value="">Select a team</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </label>

            <label className="cp-picker">
              <span>Project</span>
              <select value={projectId} disabled={!teamId} onChange={(e) => setProjectId(e.target.value)}>
                <option value="">{teamId ? "Select a project" : "Choose a team first"}</option>
                {teamProjects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>

            <label className="cp-picker">
              <span>Task (optional)</span>
              <select value={taskId} disabled={!projectId} onChange={(e) => setTaskId(e.target.value)}>
                <option value="">Whole project</option>
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            </label>
          </div>

          {target ? (
            <CommentThread
              key={`${target.scope}-${target.id}`}
              scope={target.scope}
              targetId={target.id}
              title={target.title}
              subtitle={target.subtitle}
            />
          ) : (
            <p className="cp-empty">Choose a team and project to see its comments.</p>
          )}
        </>
      )}
    </div>
  );
}