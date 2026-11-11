package com.teamflow.teamflow_api.dto;
 
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
 
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserStatsDTO {
    private long totalTeams;
    private long totalProjects;
    private long assignedTasks;
    private long completedTasks;
    private long overdueCount;
    private int completionRate;
}