package com.teamflow.teamflow_api.dto;
 
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
 
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProjectStatsDTO {
    private Integer id;
    private String name;
    private long totalTasks;
    private long completedTasks;
    private int completionPercentage;
    private long memberCount;
}