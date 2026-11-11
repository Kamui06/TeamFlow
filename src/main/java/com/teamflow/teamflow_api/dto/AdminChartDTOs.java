package com.teamflow.teamflow_api.dto;

public final class AdminChartDTOs {

    private AdminChartDTOs() {
    }

    // One slice or bar: a label and a count.
    public record CategoryCount(String label, long count) {
    }

    // Completed and open task counts for one project.
    public record ProjectTaskBreakdown(Integer projectId, String projectName, long completed, long open) {
    }

    // Open (not final) tasks assigned to one user.
    public record UserWorkload(Integer userId, String username, long openTasks) {
    }
}