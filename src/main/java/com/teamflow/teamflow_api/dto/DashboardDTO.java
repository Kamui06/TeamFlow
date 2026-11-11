package com.teamflow.teamflow_api.dto;
 
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;
 
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class DashboardDTO {
    private UserStatsDTO userStats;
    private List<TaskSummaryDTO> recentTasks;
    private List<TaskSummaryDTO> assignedTasks;
    private List<TeamOverviewDTO> userTeams;
    private List<ActivityDTO> recentActivity;
    private long unreadNotifications;
    private List<TaskSummaryDTO> upcomingTasks;
    private List<ProjectStatsDTO> projectStats;
}