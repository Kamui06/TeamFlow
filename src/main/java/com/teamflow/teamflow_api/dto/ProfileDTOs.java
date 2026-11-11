package com.teamflow.teamflow_api.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public final class ProfileDTOs {

    private ProfileDTOs() {
    }

    public record TeamRef(Integer id, String name, String role) {
    }

    public record Profile(
            Integer id,
            String username,
            String email,
            String firstName,
            String lastName,
            String bio,
            String role,
            LocalDateTime joinedAt,
            List<TeamRef> teams) {
    }

    public record PublicProfile(
        Integer id,
        String username,
        String firstName,
        String lastName,
        String bio,
        String role,
        LocalDateTime joinedAt,
        List<TeamRef> teams,
        Counts tasks,
        long assignedProjects,
        long overdue,
        List<TaskItem> recentlyCompleted,
        List<TaskItem> upcoming,
        List<ActivityItem> recentActivity,
        List<ProjectItem> projects,
        List<TaskItem> assignedTasks) {
    }

    public record UpdateRequest(String username, String email, String firstName, String lastName, String bio) {
    }

    public record Counts(long completed, long total, long incomplete) {
        public static Counts of(long completed, long total) {
            return new Counts(completed, total, total - completed);
        }
    }

    public record TaskItem(
            Integer id,
            String title,
            Integer projectId,
            String projectName,
            String status,
            boolean completed,
            String priority,
            LocalDate dueDate,
            LocalDateTime updatedAt) {
    }

    public record ProjectItem(
            Integer id,
            String name,
            String teamName,
            String status,
            String myRole,
            long myTasks,
            long myCompleted) {
    }

    public record ActivityItem(String text, String link, LocalDateTime at) {
    }

    public record Overview(
            long assignedProjects,
            Counts tasks,
            long overdue,
            List<TaskItem> recentlyCompleted,
            List<TaskItem> upcoming,
            List<ActivityItem> recentActivity) {
    }

    public record Assignments(List<ProjectItem> projects, List<TaskItem> tasks) {
    }
}