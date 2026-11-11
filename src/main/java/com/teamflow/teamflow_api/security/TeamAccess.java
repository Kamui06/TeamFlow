package com.teamflow.teamflow_api.security;

import com.teamflow.teamflow_api.entity.TeamMemberId;
import com.teamflow.teamflow_api.entity.TeamRole;
import com.teamflow.teamflow_api.repository.TeamMemberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

import java.util.Optional;

@Component("teamAccess")
@RequiredArgsConstructor
public class TeamAccess {

    private final TeamMemberRepository teamMemberRepository;

    /** True if the caller is a system admin or holds at least minRole in the team. */
    public boolean has(Authentication auth, Integer teamId, String minRole) {
        if (isSystemAdmin(auth)) {
            return true;
        }
        return currentUserId(auth)
            .flatMap(userId -> roleOf(teamId, userId))
                .map(role -> role.atLeast(TeamRole.valueOf(minRole)))
                .orElse(false);
    }

    /** The caller's effective role in the team. System admins are treated as OWNER. */
    public Optional<TeamRole> effectiveRole(Authentication auth, Integer teamId) {
        if (isSystemAdmin(auth)) {
            return Optional.of(TeamRole.OWNER);
        }
        return currentUserId(auth)
            .flatMap(userId -> roleOf(teamId, userId));
    }

    public Optional<TeamRole> roleOf(Integer teamId, Integer userId) {
        return teamMemberRepository.findById(TeamMemberId.builder()
                        .teamId(teamId)
                        .userId(userId)
                        .build())
                .map(m -> TeamRole.valueOf(m.getRole()));
    }

    private Optional<Integer> currentUserId(Authentication auth) {
        if (auth == null || !(auth.getPrincipal() instanceof UserPrincipal principal)) {
            return Optional.empty();
        }
        return Optional.ofNullable(principal.getId());
    }

    private boolean isSystemAdmin(Authentication auth) {
        return auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
    }
}