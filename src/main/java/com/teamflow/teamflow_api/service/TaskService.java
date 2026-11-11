package com.teamflow.teamflow_api.service;

import com.teamflow.teamflow_api.dto.ProjectStatusDTO;
import com.teamflow.teamflow_api.dto.TaskDTO;
import com.teamflow.teamflow_api.dto.TaskRequest;
import com.teamflow.teamflow_api.entity.Project;
import com.teamflow.teamflow_api.entity.ProjectMemberId;
import com.teamflow.teamflow_api.entity.ProjectStatus;
import com.teamflow.teamflow_api.entity.Task;
import com.teamflow.teamflow_api.entity.TeamMemberId;
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
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
@Slf4j
public class TaskService {

    private static final List<String> PRIORITIES = List.of("LOW", "MEDIUM", "HIGH", "URGENT");

    private final TaskRepository taskRepository;
    private final ProjectRepository projectRepository;
    private final ProjectStatusRepository projectStatusRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final TeamMemberRepository teamMemberRepository;
    private final ProjectVisibilityService visibility;
    private final UserRepository userRepository;
    private final ProjectStatusSync projectStatusSync;
    private final NotificationService notificationService;

    // Reads

    @Transactional(readOnly = true)
    public List<TaskDTO> getTasksForProject(Integer projectId) {
        return taskRepository.findByProjectId(projectId).stream()
                .sorted(byDueDate())
                .map(TaskDTO::from)
                .toList();
    }

    // Tasks the caller is assigned to, in projects they can see, earliest due date first. 
    @Transactional(readOnly = true)
    public List<TaskDTO> getMyTasks(Integer userId, boolean systemAdmin) {
        Set<Integer> visibleProjectIds = visibility.visibleProjectIds(userId, systemAdmin);
        if (visibleProjectIds.isEmpty()) {
            return List.of();
        }
        return taskRepository.findAssignedTo(userId).stream()
                .filter(t -> visibleProjectIds.contains(t.getProject().getId()))
                .sorted(byDueDate())
                .map(TaskDTO::from)
                .toList();
    }

    // Every task in projects the caller can see.
    @Transactional(readOnly = true)
    public List<TaskDTO> getVisibleTasks(Integer userId, boolean systemAdmin) {
        Set<Integer> visibleProjectIds = visibility.visibleProjectIds(userId, systemAdmin);
        if (visibleProjectIds.isEmpty()) {
            return List.of();
        }
        return taskRepository.findByProjectIdIn(visibleProjectIds).stream()
                .sorted(byDueDate())
                .map(TaskDTO::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public TaskDTO getTask(Integer taskId) {
        return TaskDTO.from(findTask(taskId));
    }

    @Transactional(readOnly = true)
    public List<ProjectStatusDTO> getStatusesForProject(Integer projectId) {
        return projectStatusRepository.findByProjectId(projectId).stream()
                .sorted(byPosition())
                .map(ProjectStatusDTO::from)
                .toList();
    }

    // Writes

    public TaskDTO createTask(TaskRequest request, Integer creatorId) {
        if (request.getProjectId() == null) {
            throw new IllegalArgumentException("Project is required");
        }
        if (request.getTitle() == null || request.getTitle().isBlank()) {
            throw new IllegalArgumentException("Title is required");
        }

        Project project = findProject(request.getProjectId());
        User creator = findUser(creatorId);

        ProjectStatus status = request.getStatusId() != null
                ? resolveStatus(request.getStatusId(), project.getId())
                : defaultStatus(project.getId());

        Task task = Task.builder()
                .project(project)
                .title(request.getTitle().trim())
                .description(request.getDescription())
                .priority(normalizePriority(request.getPriority()))
                .createdBy(creator)
                .status(status)
                .dueDate(request.getDueDate())
                .position(0)
                .assignees(resolveAssignees(project.getId(), request.getAssigneeIds()))
                .build();

        Task saved = taskRepository.save(task);
        notificationService.onTaskCreated(saved);
        notificationService.onTaskAssigned(saved, Set.of());
        projectStatusSync.sync(project.getId());
        log.info("Created task {} in project {} by user {}", saved.getId(), project.getId(), creatorId);
        return TaskDTO.from(saved);
    }

    /*
        Updates the task. A projectId that differs from the current one moves the task.
        Moving resets the status to the new project's default unless a valid statusId is given,
        and keeps only the current assignees who belong to the new team.
    */
    public TaskDTO updateTask(Integer taskId, TaskRequest request) {
        Task task = findTask(taskId);

        Integer oldStatusId = task.getStatus() != null ? task.getStatus().getId() : null;
        String oldPriority = task.getPriority();
        Set<Integer> previousAssignees = task.getAssignees().stream()
            .map(User::getId)
        .collect(Collectors.toSet());
       
        Integer currentProjectId = task.getProject().getId();
        Integer targetProjectId = request.getProjectId() != null ? request.getProjectId() : currentProjectId;
        boolean moving = !targetProjectId.equals(currentProjectId);

        updateTaskFields(task, request);
        updateTaskProjectAndStatus(task, request, currentProjectId, targetProjectId, moving);
        if (request.getAssigneeIds() != null) {
            task.setAssignees(resolveAssignees(targetProjectId, request.getAssigneeIds()));
        }

        Task saved = taskRepository.save(task);
        projectStatusSync.sync(targetProjectId);
        if (moving) {
            projectStatusSync.sync(currentProjectId);
        }

        Integer newStatusId = saved.getStatus() != null ? saved.getStatus().getId() : null;
        if (!Objects.equals(oldStatusId, newStatusId)) {
            notificationService.onTaskStatusChanged(saved);
        }
        if (!Objects.equals(oldPriority, saved.getPriority())) {
            notificationService.onTaskPriorityChanged(saved);
        }

        notificationService.onTaskAssigned(saved, previousAssignees);
        return TaskDTO.from(saved);
    }

    private void updateTaskFields(Task task, TaskRequest request) {
        if (request.getTitle() != null) {
            if (request.getTitle().isBlank()) {
                throw new IllegalArgumentException("Title cannot be empty");
            }
            task.setTitle(request.getTitle().trim());
        }
        if (request.getDescription() != null) {
            task.setDescription(request.getDescription());
        }
        if (request.getPriority() != null) {
            task.setPriority(normalizePriority(request.getPriority()));
        }
        if (Boolean.TRUE.equals(request.getClearDueDate())) {
            task.setDueDate(null);
        } else if (request.getDueDate() != null) {
            task.setDueDate(request.getDueDate());
        }
    }

    private void updateTaskProjectAndStatus(Task task, TaskRequest request, Integer currentProjectId,
                                            Integer targetProjectId, boolean moving) {
        if (moving) {
            Project target = findProject(targetProjectId);
            task.setProject(target);
            task.setStatus(request.getStatusId() != null
                ? resolveStatus(request.getStatusId(), targetProjectId)
                : defaultStatus(targetProjectId));

            if (request.getAssigneeIds() == null) {
                retainAssigneesInTargetTeam(task, target, targetProjectId);
            }
        } else if (request.getStatusId() != null) {
            task.setStatus(resolveStatus(request.getStatusId(), currentProjectId));
        }
    }

    private void retainAssigneesInTargetTeam(Task task, Project target, Integer targetProjectId) {
        Integer teamId = target.getTeam().getId();
        List<Integer> keep = task.getAssignees().stream()
                .map(User::getId)
                .filter(uid -> teamMemberRepository.existsById(teamMemberId(teamId, uid)))
                .toList();
        task.setAssignees(resolveAssignees(targetProjectId, keep));
    }

    // Replaces the full assignee list. Pass an empty list to unassign everyone.
    public TaskDTO setAssignees(Integer taskId, List<Integer> userIds) {
        Task task = findTask(taskId);
        Set<Integer> previousAssignees = task.getAssignees().stream()
            .map(User::getId)
            .collect(Collectors.toSet());

        task.setAssignees(resolveAssignees(task.getProject().getId(), userIds));
        Task saved = taskRepository.save(task);
        notificationService.onTaskAssigned(saved, previousAssignees);
        return TaskDTO.from(saved);
    }

    public void deleteTask(Integer taskId) {
        Task task = findTask(taskId);
        Integer projectId = task.getProject().getId();
        notificationService.onTaskDeleted(task);
        taskRepository.delete(task);
        projectStatusSync.sync(projectId);
    }
    
    // Comparators

    private static Comparator<Task> byDueDate() {
        return Comparator.comparing(
                Task::getDueDate,
                Comparator.nullsLast(Comparator.<LocalDate>naturalOrder()));
    }

    private static Comparator<ProjectStatus> byPosition() {
        return Comparator.comparing(
                ProjectStatus::getPosition,
                Comparator.nullsLast(Comparator.<Integer>naturalOrder()));
    }

    // Helpers

    /*
        Assignees must belong to the project's team. Anyone on the team who isn't yet on the
        project is added to it as MEMBER, so the task is visible to them.
    */
    private Set<User> resolveAssignees(Integer projectId, List<Integer> userIds) {
        Set<User> assignees = new HashSet<>();
        if (userIds == null) {
            return assignees;
        }

        Project project = findProject(projectId);
        Integer teamId = project.getTeam().getId();

        for (Integer userId : new LinkedHashSet<>(userIds)) {
            if (userId == null) {
                continue;
            }
            if (!teamMemberRepository.existsById(teamMemberId(teamId, userId))) {
                throw new IllegalArgumentException("User " + userId + " is not a member of this project's team");
            }

            ProjectMemberId projectMemberId = ProjectMemberId.builder()
                    .projectId(projectId)
                    .userId(userId)
                    .build();
            User user = findUser(userId);

            if (!projectMemberRepository.existsById(projectMemberId)) {
                projectMemberRepository.save(com.teamflow.teamflow_api.entity.ProjectMember.builder()
                        .id(projectMemberId)
                        .project(project)
                        .user(user)
                        .role("MEMBER")
                        .build());
            }
            assignees.add(user);
        }
        return assignees;
    }

    private TeamMemberId teamMemberId(Integer teamId, Integer userId) {
        return TeamMemberId.builder()
                .teamId(teamId)
                .userId(userId)
                .build();
    }

    private Task findTask(Integer taskId) {
        return taskRepository.findById(taskId)
                .orElseThrow(() -> new IllegalArgumentException("Task not found"));
    }

    private Project findProject(Integer projectId) {
        return projectRepository.findById(projectId)
                .orElseThrow(() -> new IllegalArgumentException("Project not found"));
    }

    private User findUser(Integer userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
    }

    private ProjectStatus resolveStatus(Integer statusId, Integer projectId) {
        ProjectStatus status = projectStatusRepository.findById(statusId)
                .orElseThrow(() -> new IllegalArgumentException("Status not found"));
        if (!status.getProject().getId().equals(projectId)) {
            throw new IllegalArgumentException("That status does not belong to this project");
        }
        return status;
    }

    private ProjectStatus defaultStatus(Integer projectId) {
        List<ProjectStatus> statuses = projectStatusRepository.findByProjectId(projectId);
        return statuses.stream()
                .filter(s -> Boolean.TRUE.equals(s.getIsDefault()))
                .findFirst()
                .or(() -> statuses.stream().sorted(byPosition()).findFirst())
                .orElse(null);
    }

    private String normalizePriority(String value) {
        if (value == null || value.isBlank()) {
            return "MEDIUM";
        }
        String normalized = value.trim().toUpperCase(Locale.ROOT);
        if (!PRIORITIES.contains(normalized)) {
            throw new IllegalArgumentException("Priority must be one of LOW, MEDIUM, HIGH, URGENT");
        }
        return normalized;
    }
}