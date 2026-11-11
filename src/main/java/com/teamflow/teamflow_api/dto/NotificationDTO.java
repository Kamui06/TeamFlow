package com.teamflow.teamflow_api.dto;

import java.time.LocalDateTime;

public record NotificationDTO(
        Integer id,
        String type,
        String message,
        String actorUsername,
        String link,
        boolean read,
        LocalDateTime createdAt) {
}