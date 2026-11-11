package com.teamflow.teamflow_api.entity;

import java.util.Locale;

public enum CommentScope {
    GLOBAL, TEAM, PROJECT, TASK;

    public static CommentScope from(String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("scope is required");
        }
        try {
            return valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException _) {
            throw new IllegalArgumentException("scope must be GLOBAL, TEAM, PROJECT or TASK");
        }
    }
}