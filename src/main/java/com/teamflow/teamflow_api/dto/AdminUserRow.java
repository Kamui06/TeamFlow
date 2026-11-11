package com.teamflow.teamflow_api.dto;

import com.teamflow.teamflow_api.entity.SystemRole;
import com.teamflow.teamflow_api.entity.User;

import java.time.LocalDateTime;

public record AdminUserRow(
        Integer id,
        String username,
        String email,
        String firstName,
        String lastName,
        SystemRole role,
        boolean isActive,
        LocalDateTime createdAt) {

    public static AdminUserRow from(User user) {
        return new AdminUserRow(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getFirstName(),
                user.getLastName(),
                user.getRole(),
                Boolean.TRUE.equals(user.getIsActive()),
                user.getCreatedAt());
    }
}
