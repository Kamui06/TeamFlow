package com.teamflow.teamflow_api.security;

import com.teamflow.teamflow_api.entity.Comment;
import com.teamflow.teamflow_api.entity.CommentScope;
import com.teamflow.teamflow_api.entity.TeamRole;
import com.teamflow.teamflow_api.repository.CommentRepository;
import com.teamflow.teamflow_api.repository.TaskRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

/*
    Comment permissions, derived from the scope a comment belongs to.

    Read:   anyone who can see the target (global comments: any signed-in user).
    Post:   MEMBER or higher on the target. VIEWERs and archived projects are read-only.
    Edit:   the author, while they can still read the target.
    Delete: the author, system admins, or a moderator of the scope:
            team OWNER/ADMIN for team comments, project MANAGER for project and task comments.
*/
@Component("commentAccess")
@RequiredArgsConstructor
public class CommentAccess {

    private final CommentRepository commentRepository;
    private final TaskRepository taskRepository;
    private final ProjectAccess projectAccess;
    private final TeamAccess teamAccess;

    public boolean canRead(Authentication auth, String scope, Integer targetId) {
        CommentScope s = CommentScope.from(scope);
        if (s == CommentScope.GLOBAL) {
            return true;
        }
        if (targetId == null) {
            return false;
        }
        return switch (s) {
            case TEAM -> teamAccess.has(auth, targetId, "VIEWER");
            case PROJECT -> projectAccess.canView(auth, targetId);
            case TASK -> taskRepository.findById(targetId)
                    .map(task -> projectAccess.canView(auth, task.getProject().getId()))
                    .orElse(false);
            case GLOBAL -> true;
        };
    }

    public boolean canPost(Authentication auth, String scope, Integer targetId) {
        CommentScope s = CommentScope.from(scope);
        if (s == CommentScope.GLOBAL) {
            return true;
        }
        if (targetId == null) {
            return false;
        }
        return switch (s) {
            case TEAM -> teamAccess.effectiveRole(auth, targetId)
                    .map(r -> r.atLeast(TeamRole.MEMBER))
                    .orElse(false);
            case PROJECT -> projectAccess.levelFor(auth, targetId) >= ProjectAccess.MEMBER;
            case TASK -> taskRepository.findById(targetId)
                    .map(task -> projectAccess.levelFor(auth, task.getProject()) >= ProjectAccess.MEMBER)
                    .orElse(false);
            case GLOBAL -> true;
        };
    }

    public boolean canEdit(Authentication auth, Integer commentId) {
        return commentRepository.findById(commentId).filter(c -> editable(auth, c)).isPresent();
    }

    public boolean canDelete(Authentication auth, Integer commentId) {
        return commentRepository.findById(commentId).filter(c -> deletable(auth, c)).isPresent();
    }

    public boolean editable(Authentication auth, Comment c) {
        return isAuthor(auth, c) && canRead(auth, c.getScope().name(), c.targetId());
    }

    public boolean deletable(Authentication auth, Comment c) {
        return isAuthor(auth, c) || CurrentUser.isSystemAdmin(auth) || moderates(auth, c);
    }

    private boolean moderates(Authentication auth, Comment c) {
        return switch (c.getScope()) {
            case GLOBAL -> false;
            case TEAM -> teamAccess.effectiveRole(auth, c.getTeam().getId())
                    .map(r -> r.atLeast(TeamRole.ADMIN))
                    .orElse(false);
            case PROJECT -> projectAccess.levelFor(auth, c.getProject()) >= ProjectAccess.MANAGER;
            case TASK -> projectAccess.levelFor(auth, c.getTask().getProject()) >= ProjectAccess.MANAGER;
        };
    }

    private static boolean isAuthor(Authentication auth, Comment c) {
        return c.getAuthor().getId().equals(CurrentUser.id(auth));
    }
}