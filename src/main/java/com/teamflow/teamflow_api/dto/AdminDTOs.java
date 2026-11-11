package com.teamflow.teamflow_api.dto;

import java.util.List;

public final class AdminDTOs {

    private AdminDTOs() {
    }

    public record OverviewStats(long users, long teams, long projects, long tasks) {
    }

    public record TeamRow(
            Integer id,
            String name,
            String ownerUsername,
            long memberCount,
            long projectCount,
            List<String> memberNames,
            List<String> projectNames) {
    }

    public record ProjectRow(
            Integer id,
            String name,
            Integer teamId,
            String teamName,
            String status,
            long memberCount,
            long taskCount,
            String createdByUsername) {
    }

    public record Kpi(long total, long addedLast7Days) {
    }

    public record KpiSummary(Kpi users, Kpi teams, Kpi projects, Kpi tasks) {
    }

    public record SignupPoint(String weekStart, long count) {
    }
}