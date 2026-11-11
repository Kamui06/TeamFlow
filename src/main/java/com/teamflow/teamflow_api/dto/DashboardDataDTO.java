package com.teamflow.teamflow_api.dto;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class DashboardDataDTO {
    private Summary summary;
    private List<ProjectItem> projects;
    private List<TaskItem> tasks;

    @Getter
    @Builder
    public static class Summary {
        private long totalProjects;
        private long totalTeams;      // new
        private long totalTasks;
        private long completedTasks;
        private long pendingTasks;
    }

    @Getter
    @Builder
    public static class ProjectItem {
        private Integer id;
        private String name;
        private String description;
        private String status;
        private Integer progress;
        private Integer teamId;
    }

    @Getter
    @Builder
    public static class TaskItem {
        private Integer id;
        private String title;
        private String status;
        private String priority;
        private String dueDate;
        private Integer projectId;
        private String projectName;
    }
}