package com.teamflow.teamflow_api.service;
 
import com.teamflow.teamflow_api.dto.*;
import com.teamflow.teamflow_api.entity.*;
import com.teamflow.teamflow_api.repository.*;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;

import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
 
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
@Slf4j
public class DashboardService {
    
    private final UserRepository userRepository;
    private final TaskRepository taskRepository;
    private final ProjectRepository projectRepository;
    private final TeamMemberRepository teamMemberRepository;
    private final NotificationRepository notificationRepository;
    private final ActivityLogRepository activityLogRepository;
    private final ProjectVisibilityService visibility;
    
    public DashboardDTO getDashboardData(Integer userId) {
        userRepository.findById(userId).orElseThrow(() -> new IllegalArgumentException("User not found"));
        
        return DashboardDTO.builder()
                .userStats(getUserStats(userId))
                .recentTasks(getRecentTasks(userId))
                .assignedTasks(getAssignedTasks(userId))
                .userTeams(getUserTeams(userId))
                .recentActivity(getRecentActivity(userId, 10))
                .unreadNotifications(getUnreadNotificationCount(userId))
                .upcomingTasks(getUpcomingTasks(userId))
                .projectStats(getProjectStats(userId))
                .build();
    }
    
    public UserStatsDTO getUserStats(Integer userId) {
        long totalTeams = teamMemberRepository.countTeamsByUserId(userId);
        long totalProjects = projectRepository.countByCreatedById(userId);
        long assignedTasks = taskRepository.countAssignedTasks(userId);
        long completedTasks = taskRepository.countCompletedTasks(userId);
        long overdueCount = taskRepository.countOverdueTasks(userId);
        
        int completionRate = assignedTasks > 0 
                ? (int) ((completedTasks * 100) / assignedTasks) 
                : 0;
        
        return UserStatsDTO.builder()
                .totalTeams(totalTeams)
                .totalProjects(totalProjects)
                .assignedTasks(assignedTasks)
                .completedTasks(completedTasks)
                .overdueCount(overdueCount)
                .completionRate(completionRate)
                .build();
    }
    
    public List<TaskSummaryDTO> getRecentTasks(Integer userId) {
        LocalDateTime thirtyDaysAgo = LocalDateTime.now(ZoneId.systemDefault()).minusDays(30);
        
        return taskRepository.findByCreatedById(userId).stream()
                .filter(task -> task.getCreatedAt() != null && task.getCreatedAt().isAfter(thirtyDaysAgo))
                .sorted(Comparator.comparing((Task task) -> task == null ? null : task.getDueDate(),
                        Comparator.nullsLast(Comparator.naturalOrder())))
                .limit(10)
                .map(this::mapToTaskSummary)
                .toList();
    }
    
    public List<TaskSummaryDTO> getAssignedTasks(Integer userId) {
        return taskRepository.findAssignedTo(userId).stream()
            .filter(task -> task.getStatus() == null || !Boolean.TRUE.equals(task.getStatus().getIsFinal()))
            .sorted(Comparator.comparing(Task::getDueDate, Comparator.nullsLast(Comparator.<LocalDate>naturalOrder())))
            .limit(10)
            .map(this::mapToTaskSummary)
            .toList();
        }
    
    public List<TeamOverviewDTO> getUserTeams(Integer userId) {
        return teamMemberRepository.findByIdUserId(userId).stream()
                .map(member -> member == null ? null : member.getTeam())
                .filter(Objects::nonNull)
                .map(team -> TeamOverviewDTO.builder()
                        .id(team.getId())
                        .name(team.getName())
                        .memberCount(teamMemberRepository.countMembersByTeamId(team.getId()))
                        .projectCount(projectRepository.countByTeamId(team.getId()))
                        .role("MEMBER")
                        .build())
                .toList();
    }
    
    public List<ActivityDTO> getRecentActivity(Integer userId, int limit) {
        return activityLogRepository.findByActorId(userId).stream()
                .sorted(Comparator.comparing(
                        (ActivityLog activity) -> activity == null ? null : activity.getCreatedAt(),
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(limit)
                .map(log -> ActivityDTO.builder()
                        .id(log.getId())
                        .action(log.getAction())
                        .entityType(log.getAction())
                        .description(log.getAction())
                        .createdAt(log.getCreatedAt())
                        .build())
                .toList();
    }
    
    public long getUnreadNotificationCount(Integer userId) {
        return notificationRepository.countUnreadByUserId(userId);
    }
    
    public List<TaskSummaryDTO> getUpcomingTasks(Integer userId) {
        LocalDate today = LocalDate.now(ZoneId.systemDefault());
        LocalDate nextWeek = today.plusDays(7);
        
        return taskRepository.findUpcomingTasks(userId, today, nextWeek).stream()
                .map(this::mapToTaskSummary)
                .toList();
    }
    
    public List<ProjectStatsDTO> getProjectStats(Integer userId) {
        return projectRepository.findByCreatedById(userId).stream()
                .map(project -> {
                    long totalTasks = taskRepository.countByProjectId(project.getId());
                    long completedTasks = taskRepository.countCompletedByProjectId(project.getId());
                    int completionPercentage = totalTasks > 0 
                            ? (int) ((completedTasks * 100) / totalTasks) 
                            : 0;
                    long memberCount = teamMemberRepository.countMembersByTeamId(project.getTeam().getId());
                    
                    return ProjectStatsDTO.builder()
                            .id(project.getId())
                            .name(project.getName())
                            .totalTasks(totalTasks)
                            .completedTasks(completedTasks)
                            .completionPercentage(completionPercentage)
                            .memberCount(memberCount)
                            .build();
                })
                .toList();
    }
    
        private TaskSummaryDTO mapToTaskSummary(Task task) {
                String assigneeNames = task.getAssignees().isEmpty()
                        ? "Unassigned"
                        : task.getAssignees().stream()
                        .map(User::getUsername)
                        .sorted()
                .collect(Collectors.joining(", "));

                return TaskSummaryDTO.builder()
                        .id(task.getId())
                        .title(task.getTitle())
                        .projectId(task.getProject().getId())
                        .priority(task.getPriority())
                        .status(task.getStatus() != null ? task.getStatus().getName() : "UNASSIGNED")
                        .dueDate(task.getDueDate())
                        .assigneeName(assigneeNames)
                .build();
        }

        // Dashboard data: only projects the user can see, and their tasks.
        @Transactional(readOnly = true)
        public DashboardDataDTO getWorkspace(Integer userId, boolean systemAdmin) {
                Set<Integer> teamIds = getWorkspaceTeamIds(userId);
                List<Project> projects = visibility.visibleProjects(userId, systemAdmin);

                Set<Integer> projectIds = projects.stream()
                        .filter(Objects::nonNull)
                        .map(project -> Objects.requireNonNull(project).getId())
                        .filter(Objects::nonNull)
                        .collect(Collectors.toSet());
                List<Task> tasks = projectIds.isEmpty() ? List.of() : taskRepository.findByProjectIdIn(projectIds);

                Map<Integer, List<Task>> tasksByProject = tasks.stream()
                .collect(Collectors.groupingBy(t -> t.getProject().getId()));

                List<DashboardDataDTO.ProjectItem> projectItems = projects.stream()
                        .map(project -> mapWorkspaceProject(project,
                        tasksByProject.getOrDefault(project.getId(), List.of())))
                .toList();

                List<DashboardDataDTO.TaskItem> taskItems = tasks.stream()
                .map(this::mapWorkspaceTask)
                .toList();

                long completed = tasks.stream().filter(this::isCompleted).count();

                return DashboardDataDTO.builder()
                .summary(DashboardDataDTO.Summary.builder()
                    .totalProjects(projects.size())
                    .totalTeams(teamIds.size())
                    .totalTasks(tasks.size())
                    .completedTasks(completed)
                    .pendingTasks(tasks.size() - completed)
                    .build())
                .projects(projectItems)
                .tasks(taskItems)
                .build();
        }

        private Set<Integer> getWorkspaceTeamIds(Integer userId) {
                return teamMemberRepository.findByIdUserId(userId).stream()
                .map(member -> member == null ? null : member.getTeam())
                .filter(Objects::nonNull)
                .map(team -> team == null ? null : team.getId())
                .collect(Collectors.toSet());
        }

        private DashboardDataDTO.ProjectItem mapWorkspaceProject(Project project, List<Task> projectTasks) {
                long done = projectTasks.stream().filter(this::isCompleted).count();
                int progress = projectTasks.isEmpty() ? 0 : (int) (done * 100 / projectTasks.size());

                return DashboardDataDTO.ProjectItem.builder()
                        .id(project.getId())
                        .name(project.getName())
                        .description(project.getDescription())
                        .status(project.getStatus())
                        .progress(progress)
                        .teamId(project.getTeam().getId())
                        .build();
        }

        private DashboardDataDTO.TaskItem mapWorkspaceTask(Task task) {
                return DashboardDataDTO.TaskItem.builder()
                        .id(task.getId())
                        .title(task.getTitle())
                        .status(task.getStatus() != null ? task.getStatus().getName() : "UNASSIGNED")
                        .priority(task.getPriority())
                        .dueDate(task.getDueDate() != null ? task.getDueDate().toString() : null)
                        .projectId(task.getProject().getId())
                        .projectName(task.getProject().getName())
                        .build();
        }

        private boolean isCompleted(Task task) {
                return task.getStatus() != null && Boolean.TRUE.equals(task.getStatus().getIsFinal());
        }
}