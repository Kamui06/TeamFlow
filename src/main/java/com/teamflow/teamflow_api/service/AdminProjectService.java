package com.teamflow.teamflow_api.service;

import com.teamflow.teamflow_api.dto.AdminProjectDetail;
import com.teamflow.teamflow_api.dto.AdminProjectUpdateRequest;
import com.teamflow.teamflow_api.entity.Project;
import com.teamflow.teamflow_api.entity.ProjectMember;
import com.teamflow.teamflow_api.entity.ProjectMemberId;
import com.teamflow.teamflow_api.entity.ProjectStatus;
import com.teamflow.teamflow_api.entity.Task;
import com.teamflow.teamflow_api.entity.User;
import com.teamflow.teamflow_api.repository.ProjectMemberRepository;
import com.teamflow.teamflow_api.repository.ProjectRepository;
import com.teamflow.teamflow_api.repository.ProjectStatusRepository;
import com.teamflow.teamflow_api.repository.TaskRepository;
import com.teamflow.teamflow_api.repository.TeamMemberRepository;
import com.teamflow.teamflow_api.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
@Slf4j
public class AdminProjectService {

    private static final String DEFAULT_MEMBER_ROLE = "MEMBER";
    private static final Set<String> MEMBER_ROLES = Set.of("MANAGER", DEFAULT_MEMBER_ROLE, "VIEWER");

    private final ProjectRepository projectRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final ProjectStatusRepository projectStatusRepository;
    private final TaskRepository taskRepository;
    private final TeamMemberRepository teamMemberRepository;
    private final UserRepository userRepository;
    private final ProjectStatusSync projectStatusSync;
    private final ObjectProvider<AdminProjectService> self;
    private final NotificationService notificationService;

    @Transactional(readOnly = true)
    public AdminProjectDetail detail(Integer projectId) {
        Project project = find(projectId);
        Integer teamId = project.getTeam().getId();

        List<AdminProjectDetail.Member> members = projectMemberRepository.findByIdProjectId(projectId).stream()
                .map(m -> new AdminProjectDetail.Member(m.getUser().getId(), m.getUser().getUsername(), m.getRole()))
                .sorted(Comparator.comparing(AdminProjectDetail.Member::username, String.CASE_INSENSITIVE_ORDER))
                .toList();

        Set<Integer> onProject = members.stream()
                .map(AdminProjectDetail.Member::userId)
                .collect(Collectors.toSet());

        List<AdminProjectDetail.Member> addable = teamMemberRepository.findByIdTeamId(teamId).stream()
                .filter(tm -> !onProject.contains(tm.getUser().getId()))
                .map(tm -> new AdminProjectDetail.Member(tm.getUser().getId(), tm.getUser().getUsername(), DEFAULT_MEMBER_ROLE))
                .sorted(Comparator.comparing(AdminProjectDetail.Member::username, String.CASE_INSENSITIVE_ORDER))
                .toList();

        List<AdminProjectDetail.Task> tasks = taskRepository.findByProjectId(projectId).stream()
                .sorted(Comparator.comparing(Task::getId))
                .map(this::toTask)
                .toList();

        List<AdminProjectDetail.StatusOption> statuses = projectStatusRepository.findByProjectId(projectId).stream()
                .sorted(Comparator.comparing(ProjectStatus::getPosition, Comparator.nullsLast(Comparator.naturalOrder())))
                .map(s -> new AdminProjectDetail.StatusOption(
                        s.getId(), s.getName(), s.getPosition(), Boolean.TRUE.equals(s.getIsFinal())))
                .toList();

        return new AdminProjectDetail(
                project.getId(),
                project.getName(),
                project.getDescription(),
                project.getStatus(),
                teamId,
                project.getTeam().getName(),
                project.getCreatedBy().getUsername(),
                project.getCreatedAt(),
                members,
                tasks,
                statuses,
                addable);
    }

    public AdminProjectDetail update(Integer projectId, AdminProjectUpdateRequest req) {
        Project project = find(projectId);

        if (req.name() != null) {
            if (req.name().isBlank()) {
                throw new IllegalArgumentException("Project name cannot be empty");
            }
            project.setName(req.name().trim());
        }
        if (req.description() != null) {
            project.setDescription(req.description());
        }
        projectRepository.save(project);
        return self.getObject().detail(projectId);
    }

    public AdminProjectDetail addMember(Integer projectId, Integer userId, String role) {
        Project project = find(projectId);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        boolean inTeam = teamMemberRepository.existsById(new com.teamflow.teamflow_api.entity.TeamMemberId(
                project.getTeam().getId(), userId));
        if (!inTeam) {
            throw new IllegalArgumentException("That user must first be added to the project's team");
        }

        ProjectMemberId id = new ProjectMemberId(projectId, userId);
        if (projectMemberRepository.existsById(id)) {
            throw new IllegalArgumentException("User is already on this project");
        }

        ProjectMember saved = projectMemberRepository.save(ProjectMember.builder()
            .id(id)
            .project(project)
            .user(user)
            .role(normalizeRole(role))
            .build());
        notificationService.onProjectMemberAdded(project, user, saved.getRole());
        return self.getObject().detail(projectId);
    }

    public AdminProjectDetail changeRole(Integer projectId, Integer userId, String role) {
        ProjectMember member = projectMemberRepository.findById(new ProjectMemberId(projectId, userId))
                .orElseThrow(() -> new IllegalArgumentException("Member not found"));
        member.setRole(normalizeRole(role));
        projectMemberRepository.save(member);
        notificationService.onProjectMemberRoleChanged(member.getProject(), member.getUser(), member.getRole());
        return self.getObject().detail(projectId);
    }

    /** Removing someone unassigns them from this project's tasks. */
    public AdminProjectDetail removeMember(Integer projectId, Integer userId) {
        ProjectMemberId id = new ProjectMemberId(projectId, userId);
        if (!projectMemberRepository.existsById(id)) {
            throw new IllegalArgumentException("Member not found");
        }
        taskRepository.findByProjectId(projectId)
                .forEach(t -> t.getAssignees().removeIf(u -> userId.equals(u.getId())));
        projectMemberRepository.deleteById(id);
        return self.getObject().detail(projectId);
    }

    /** Changes a task's status. The status must belong to this project. */
    public AdminProjectDetail setTaskStatus(Integer projectId, Integer taskId, Integer statusId) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new IllegalArgumentException("Task not found"));
        if (!task.getProject().getId().equals(projectId)) {
            throw new IllegalArgumentException("That task is not in this project");
        }
        ProjectStatus status = projectStatusRepository.findById(statusId)
                .orElseThrow(() -> new IllegalArgumentException("Status not found"));
        if (!status.getProject().getId().equals(projectId)) {
            throw new IllegalArgumentException("That status is not in this project");
        }

        task.setStatus(status);
        taskRepository.save(task);
        projectStatusSync.sync(projectId);
        return self.getObject().detail(projectId);
    }

    public AdminProjectDetail deleteTask(Integer projectId, Integer taskId) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new IllegalArgumentException("Task not found"));
        if (!task.getProject().getId().equals(projectId)) {
            throw new IllegalArgumentException("That task is not in this project");
        }
        taskRepository.delete(task);
        projectStatusSync.sync(projectId);
        return self.getObject().detail(projectId);
    }

    private AdminProjectDetail.Task toTask(Task task) {
        List<String> assignees = task.getAssignees().stream()
                .map(User::getUsername)
                .sorted(String.CASE_INSENSITIVE_ORDER)
                .toList();

        return new AdminProjectDetail.Task(
                task.getId(),
                task.getTitle(),
                task.getPriority(),
                task.getStatus() != null ? task.getStatus().getName() : null,
                task.getStatus() != null && Boolean.TRUE.equals(task.getStatus().getIsFinal()),
                task.getDueDate() != null ? task.getDueDate().toString() : null,
                assignees);
    }

    private Project find(Integer id) {
        return projectRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Project not found"));
    }

    private static String normalizeRole(String value) {
        String role = value == null || value.isBlank() ? DEFAULT_MEMBER_ROLE : value.trim().toUpperCase();
        if (!MEMBER_ROLES.contains(role)) {
            throw new IllegalArgumentException("Role must be one of MANAGER, MEMBER, VIEWER");
        }
        return role;
    }
}