package com.teamflow.teamflow_api.security;

import org.springframework.security.core.Authentication;

public final class CurrentUser {

    private CurrentUser() {
    }

    public static Integer id(Authentication auth) {
        if (auth == null || !(auth.getPrincipal() instanceof UserPrincipal principal)) {
            throw new IllegalStateException("Authenticated user principal is missing");
        }
        return principal.getId();
    }

    public static boolean isSystemAdmin(Authentication auth) {
        return auth != null && auth.getAuthorities().stream()
                .anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
    }
}