package com.teamflow.teamflow_api.dto;

public record AdminUserUpdateRequest(
        String username,
        String email,
        String firstName,
        String lastName,
        String password) {
}