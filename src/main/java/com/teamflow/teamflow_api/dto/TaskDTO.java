package com.teamflow.teamflow_api.dto;

import com.teamflow.teamflow_api.entity.Task;
import com.teamflow.teamflow_api.entity.User;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;

@Getter
@Builder
public class TaskDTO {
    private Integer id;
    private Integer teamId;
    private Integer projectId;
    private String projectName;
    private String title;
    private String description;
    private String priority;
    private Integer statusId;
    private String statusName;
    private boolean statusFinal;
    private List<AssigneeRef> assignees;
    private Integer createdById;
    private String createdByUsername;
    private LocalDate dueDate;
    private Integer position;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public record AssigneeRef(Integer userId, String username) {
    }

    public static TaskDTO from(Task task) {
        List<AssigneeRef> assignees = task.getAssignees().stream()
                .sorted(Comparator.comparing(User::getUsername, String.CASE_INSENSITIVE_ORDER))
                .map(u -> new AssigneeRef(u.getId(), u.getUsername()))
                .toList();

        return TaskDTO.builder()
                .id(task.getId())
                .teamId(task.getProject().getTeam().getId())
                .projectId(task.getProject().getId())
                .projectName(task.getProject().getName())
                .title(task.getTitle())
                .description(task.getDescription())
                .priority(task.getPriority())
                .statusId(task.getStatus() != null ? task.getStatus().getId() : null)
                .statusName(task.getStatus() != null ? task.getStatus().getName() : null)
                .statusFinal(task.getStatus() != null && Boolean.TRUE.equals(task.getStatus().getIsFinal()))
                .assignees(assignees)
                .createdById(task.getCreatedBy().getId())
                .createdByUsername(task.getCreatedBy().getUsername())
                .dueDate(task.getDueDate())
                .position(task.getPosition())
                .createdAt(task.getCreatedAt())
                .updatedAt(task.getUpdatedAt())
                .build();
    }
}
