package com.teamflow.teamflow_api.entity;

import java.util.Locale;

public enum TeamRole {
    VIEWER, MEMBER, ADMIN, OWNER;

    public boolean atLeast(TeamRole required) {
        return this.ordinal() >= required.ordinal();
    }

    public static TeamRole parse(String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("Role is required");
        }
        try {
            return TeamRole.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException _) {
            throw new IllegalArgumentException("Invalid role: " + value);
        }
    }
}