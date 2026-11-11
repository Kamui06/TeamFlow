package com.teamflow.teamflow_api.security;

import com.teamflow.teamflow_api.entity.Project;
import com.teamflow.teamflow_api.entity.ProjectMemberId;
import com.teamflow.teamflow_api.entity.TeamRole;
import com.teamflow.teamflow_api.repository.ProjectMemberRepository;
import com.teamflow.teamflow_api.repository.ProjectRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

import java.util.Locale;

/*
    Project permissions.
 
    Team OWNER/ADMIN are MANAGER on every project in their team. Otherwise the level comes
    from the project membership. Team VIEWERs are read-only everywhere. ARCHIVED projects
    are read-only for everyone.
*/
@Component("projectAccess")
@RequiredArgsConstructor
public class ProjectAccess {

    public static final int NONE = 0;
    public static final int VIEWER = 1;
    public static final int MEMBER = 2;
    public static final int MANAGER = 3;

    private static final String ARCHIVED = "ARCHIVED";

    private final ProjectRepository projectRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final TeamAccess teamAccess;

    public boolean canView(Authentication auth, Integer projectId) {
        return levelFor(auth, projectId) >= VIEWER;
    }

    public boolean canCreate(Authentication auth, Integer teamId) {
        if (teamId == null) {
            return false;
        }
        return teamAccess.effectiveRole(auth, teamId)
                .map(r -> r.atLeast(TeamRole.MEMBER))
                .orElse(false);
    }

    public boolean canEdit(Authentication auth, Integer projectId) {
        return levelFor(auth, projectId) >= MANAGER;
    }

    public boolean canManageMembers(Authentication auth, Integer projectId) {
        return levelFor(auth, projectId) >= MANAGER;
    }

    // Archiving needs manager access in the project. The service also requires COMPLETED.
    public boolean canArchive(Authentication auth, Integer projectId) {
        if (projectId == null) {
            return false;
        }
        return projectRepository.findById(projectId)
                .map(project -> baseLevel(auth, project) >= MANAGER)
                .orElse(false);
    }

    // Deleting a project is reserved for the team owner (and system admins).
    public boolean canDelete(Authentication auth, Integer projectId) {
        if (projectId == null) {
            return false;
        }
        return projectRepository.findById(projectId)
                .flatMap(project -> teamAccess.effectiveRole(auth, project.getTeam().getId()))
                .map(r -> r.atLeast(TeamRole.OWNER))
                .orElse(false);
    }

    public int levelFor(Authentication auth, Integer projectId) {
        if (projectId == null) {
            return NONE;
        }
        return projectRepository.findById(projectId)
                .map(project -> levelFor(auth, project))
                .orElse(NONE);
    }

    // Archived projects are read-only, so the level is capped at VIEWER.
    public int levelFor(Authentication auth, Project project) {
        int base = baseLevel(auth, project);
        if (project != null && ARCHIVED.equals(project.getStatus())) {
            return Math.min(base, VIEWER);
        }
        return base;
    }

    public String levelName(Authentication auth, Integer projectId) {
        return switch (levelFor(auth, projectId)) {
            case MANAGER -> "MANAGER";
            case MEMBER -> "MEMBER";
            case VIEWER -> "VIEWER";
            default -> "NONE";
        };
    }

    // The level before archiving is applied.
    private int baseLevel(Authentication auth, Project project) {
        if (auth == null || project == null) {
            return NONE;
        }

        TeamRole teamRole = teamAccess.effectiveRole(auth, project.getTeam().getId()).orElse(null);
        if (teamRole == null) {
            return NONE;
        }
        if (teamRole.atLeast(TeamRole.ADMIN)) {
            return MANAGER;
        }

        ProjectMemberId id = ProjectMemberId.builder()
                .projectId(project.getId())
                .userId(CurrentUser.id(auth))
                .build();
        int membershipLevel = projectMemberRepository.findById(id)
                .map(pm -> levelOf(pm.getRole()))
                .orElse(NONE);

        return teamRole == TeamRole.VIEWER ? Math.min(membershipLevel, VIEWER) : membershipLevel;
    }

    private static int levelOf(String role) {
        if (role == null) {
            return VIEWER;
        }
        return switch (role.trim().toUpperCase(Locale.ROOT)) {
            case "MANAGER" -> MANAGER;
            case "MEMBER" -> MEMBER;
            default -> VIEWER;
        };
    }
}