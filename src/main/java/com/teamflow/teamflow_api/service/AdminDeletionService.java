package com.teamflow.teamflow_api.service;

import com.teamflow.teamflow_api.dto.DeletionImpact;
import com.teamflow.teamflow_api.dto.DeletionImpact.Line;
import com.teamflow.teamflow_api.entity.Project;
import com.teamflow.teamflow_api.entity.Task;
import com.teamflow.teamflow_api.entity.Team;
import com.teamflow.teamflow_api.repository.CommentRepository;
import com.teamflow.teamflow_api.repository.NotificationRepository;
import com.teamflow.teamflow_api.repository.ProjectMemberRepository;
import com.teamflow.teamflow_api.repository.ProjectRepository;
import com.teamflow.teamflow_api.repository.ProjectStatusRepository;
import com.teamflow.teamflow_api.repository.TaskLabelRepository;
import com.teamflow.teamflow_api.repository.TaskRepository;
import com.teamflow.teamflow_api.repository.TeamMemberRepository;
import com.teamflow.teamflow_api.repository.TeamRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
@Slf4j
public class AdminDeletionService {

    private final TeamRepository teamRepository;
    private final ProjectRepository projectRepository;
    private final TeamMemberRepository teamMemberRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final ProjectStatusRepository projectStatusRepository;
    private final TaskRepository taskRepository;
    private final TaskLabelRepository taskLabelRepository;
    private final CommentRepository commentRepository;
    private final NotificationRepository notificationRepository;
    private final NotificationService notificationService;

    // ---------- What would be removed ----------

    @Transactional(readOnly = true)
    public DeletionImpact projectImpact(Integer projectId) {
        Project project = findProject(projectId);
        Counts c = countsFor(project);

        List<Line> lines = List.of(
                new Line("Tasks", c.tasks()),
                new Line("Task assignments", c.assignments()),
                new Line("Comments on tasks", c.taskComments()),
                new Line("Comments on the project", c.projectComments()),
                new Line("Attachments", c.attachments()),
                new Line("Workflow statuses", c.statuses()),
                new Line("Task labels", c.labels()),
                new Line("Project memberships", c.members()));

        List<String> kept = keptNotes(c.notifications(), "this project",
                "The team and its other projects are not affected.");

        return new DeletionImpact("PROJECT", project.getId(), project.getName(), lines, kept, List.of());
    }

    @Transactional(readOnly = true)
    public DeletionImpact teamImpact(Integer teamId) {
        Team team = findTeam(teamId);
        List<Project> projects = projectRepository.findByTeam(team);

        Counts total = Counts.ZERO;
        for (Project p : projects) {
            total = total.plus(countsFor(p));
        }

        long teamMembers = size(teamMemberRepository.findByIdTeamId(teamId));
        long teamComments = size(commentRepository.findByTeamIdOrderByCreatedAtAsc(teamId));
        long teamNotifications = notificationRepository.countByTeamId(teamId);

        List<Line> lines = List.of(
                new Line("Projects", projects.size()),
                new Line("Tasks", total.tasks()),
                new Line("Task assignments", total.assignments()),
                new Line("Comments", total.taskComments() + total.projectComments() + teamComments),
                new Line("Attachments", total.attachments()),
                new Line("Project memberships", total.members()),
                new Line("Team memberships", teamMembers),
                new Line("Workflow statuses", total.statuses()),
                new Line("Task labels", total.labels()));

        List<String> kept = keptNotes(teamNotifications + total.notifications(),
                "about this team and its projects",
                "Member accounts are kept. Only their memberships in this team are removed.");

        List<String> names = projects.stream().map(Project::getName).toList();
        return new DeletionImpact("TEAM", team.getId(), team.getName(), lines, kept, names);
    }

    // ---------- Deletion ----------

    public void deleteProject(Integer projectId) {
        Project project = findProject(projectId);
        String name = project.getName();
        removeProject(project);
        log.warn("Admin deleted project {} ({})", projectId, name);
    }

    public void deleteTeam(Integer teamId) {
        Team team = findTeam(teamId);
        List<Project> projects = projectRepository.findByTeam(team);

        // Notify while the members still exist.
        notificationService.onTeamDeleted(team);

        for (Project project : projects) {
            removeProject(project);
        }

        commentRepository.deleteAll(commentRepository.findByTeamIdOrderByCreatedAtAsc(teamId));
        teamMemberRepository.deleteAll(teamMemberRepository.findByIdTeamId(teamId));
        teamRepository.flush();
        teamRepository.delete(team);

        log.warn("Admin deleted team {} with {} projects", teamId, projects.size());
    }

    /** Removes a project and everything that belongs to it. Called inside a transaction. */
    private void removeProject(Project project) {
        Integer id = project.getId();
        List<Task> tasks = taskRepository.findByProjectId(id);

        taskLabelRepository.deleteAll(taskLabelRepository.findByProjectId(id));
        commentRepository.deleteAll(commentRepository.findByProjectIdOrderByCreatedAtAsc(id));
        // Each task removes its own assignments, comments and attachments.
        taskRepository.deleteAll(tasks);
        projectStatusRepository.deleteAll(projectStatusRepository.findByProjectId(id));
        projectMemberRepository.deleteAll(projectMemberRepository.findByIdProjectId(id));
        projectRepository.flush();
        projectRepository.delete(project);
    }

    // ---------- Counting ----------

    private Counts countsFor(Project project) {
        Integer id = project.getId();
        List<Task> tasks = taskRepository.findByProjectId(id);

        long assignments = tasks.stream().mapToLong(t -> size(t.getAssignees())).sum();
        long taskComments = tasks.stream().mapToLong(t -> size(t.getComments())).sum();
        long attachments = tasks.stream().mapToLong(t -> size(t.getAttachments())).sum();

        return new Counts(
                tasks.size(),
                assignments,
                taskComments,
                size(commentRepository.findByProjectIdOrderByCreatedAtAsc(id)),
                attachments,
                size(projectStatusRepository.findByProjectId(id)),
                size(projectMemberRepository.findByIdProjectId(id)),
                size(taskLabelRepository.findByProjectId(id)),
                notificationRepository.countByProjectId(id));
    }

    private static List<String> keptNotes(long notifications, String scope, String extra) {
        List<String> kept = new ArrayList<>();
        kept.add("User accounts are not deleted. Accounts and profiles remain.");
        if (notifications > 0) {
            kept.add(notifications + (notifications == 1 ? " notification" : " notifications")
                    + " " + scope + " stay in people's inboxes, without a link to it.");
        }
        kept.add(extra);
        return kept;
    }

    private static long size(Collection<?> items) {
        return items == null ? 0 : items.size();
    }

    private Project findProject(Integer projectId) {
        return projectRepository.findById(projectId)
                .orElseThrow(() -> new IllegalArgumentException("Project not found"));
    }

    private Team findTeam(Integer teamId) {
        return teamRepository.findById(teamId)
                .orElseThrow(() -> new IllegalArgumentException("Team not found"));
    }

    private record Counts(long tasks, long assignments, long taskComments, long projectComments,
                          long attachments, long statuses, long members, long labels, long notifications) {

        static final Counts ZERO = new Counts(0, 0, 0, 0, 0, 0, 0, 0, 0);

        Counts plus(Counts o) {
            return new Counts(
                    tasks + o.tasks,
                    assignments + o.assignments,
                    taskComments + o.taskComments,
                    projectComments + o.projectComments,
                    attachments + o.attachments,
                    statuses + o.statuses,
                    members + o.members,
                    labels + o.labels,
                    notifications + o.notifications);
        }
    }
}