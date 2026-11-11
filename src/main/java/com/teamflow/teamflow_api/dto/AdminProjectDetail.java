package com.teamflow.teamflow_api.dto;

import java.time.LocalDateTime;
import java.util.List;

public record AdminProjectDetail(
        Integer id,
        String name,
        String description,
        String status,
        Integer teamId,
        String teamName,
        String createdByUsername,
        LocalDateTime createdAt,
        List<Member> members,
        List<Task> tasks,
        List<StatusOption> statuses,
        List<Member> addableMembers) {

    public record Member(Integer userId, String username, String role) {
    }

    public record Task(
            Integer id,
            String title,
            String priority,
            String statusName,
            boolean statusFinal,
            String dueDate,
            List<String> assignees) {
    }

    public record StatusOption(Integer id, String name, Integer position, boolean isFinal) {
    }
}