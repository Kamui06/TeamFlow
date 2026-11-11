package com.teamflow.teamflow_api.dto;

import lombok.*;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProjectDTO {
    private Integer id;
    private String name;
    private String description;
    private Integer teamId;
    private String status;
    private String myProjectLevel;
    private LocalDateTime startDate;
    private LocalDateTime endDate;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private Integer createdById;
    private String createdByUsername;
    private Integer taskCount;
    private Integer completedTaskCount;
}