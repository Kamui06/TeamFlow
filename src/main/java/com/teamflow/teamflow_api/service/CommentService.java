package com.teamflow.teamflow_api.service;

import com.teamflow.teamflow_api.dto.CommentDTO;
import com.teamflow.teamflow_api.dto.CommentRequest;
import com.teamflow.teamflow_api.entity.Comment;
import com.teamflow.teamflow_api.entity.CommentScope;
// import com.teamflow.teamflow_api.entity.Project;
// import com.teamflow.teamflow_api.entity.Task;
// import com.teamflow.teamflow_api.entity.Team;
import com.teamflow.teamflow_api.entity.User;
import com.teamflow.teamflow_api.repository.CommentRepository;
import com.teamflow.teamflow_api.repository.ProjectRepository;
import com.teamflow.teamflow_api.repository.TaskRepository;
import com.teamflow.teamflow_api.repository.TeamRepository;
import com.teamflow.teamflow_api.repository.UserRepository;
import com.teamflow.teamflow_api.security.CommentAccess;
import com.teamflow.teamflow_api.security.CurrentUser;
import com.teamflow.teamflow_api.security.FieldCipher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
@Transactional
@Slf4j
public class CommentService {

    private static final int MAX_LENGTH = 2000;

    private final CommentRepository commentRepository;
    private final TaskRepository taskRepository;
    private final ProjectRepository projectRepository;
    private final TeamRepository teamRepository;
    private final UserRepository userRepository;
    private final CommentAccess commentAccess;
    private final NotificationService notificationService;

    @Transactional(readOnly = true)
    public CommentDTO.Thread thread(CommentScope scope, Integer targetId, Authentication auth) {
        List<Comment> comments = switch (scope) {
            case GLOBAL -> commentRepository.findByScopeOrderByCreatedAtAsc(CommentScope.GLOBAL);
            case TASK -> commentRepository.findByTaskIdOrderByCreatedAtAsc(requireId(targetId));
            case PROJECT -> commentRepository.findByProjectIdOrderByCreatedAtAsc(requireId(targetId));
            case TEAM -> commentRepository.findByTeamIdOrderByCreatedAtAsc(requireId(targetId));
        };

        boolean canPost = commentAccess.canPost(auth, scope.name(), targetId);
        return new CommentDTO.Thread(canPost, comments.stream().map(c -> toDto(c, auth)).toList());
    }

    public CommentDTO create(CommentRequest request, Authentication auth) {
        CommentScope scope = CommentScope.from(request.getScope());
        String content = cleanContent(request.getContent());
        User author = userRepository.findById(CurrentUser.id(auth))
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        Comment.CommentBuilder builder = Comment.builder()
                .scope(scope)
                .author(author)
                .content(content);

        switch (scope) {
            case GLOBAL -> {
                // Global comments intentionally have no related entity.
            }
            case TASK -> builder.task(taskRepository.findById(requireId(request.getTargetId()))
                    .orElseThrow(() -> new IllegalArgumentException("Task not found")));
            case PROJECT -> builder.project(projectRepository.findById(requireId(request.getTargetId()))
                    .orElseThrow(() -> new IllegalArgumentException("Project not found")));
            case TEAM -> builder.team(teamRepository.findById(requireId(request.getTargetId()))
                    .orElseThrow(() -> new IllegalArgumentException("Team not found")));
        }

        Comment saved = commentRepository.save(builder.build());

        notificationService.onCommentPosted(saved);
        
        log.info("User {} commented on {} {}", author.getId(), scope, saved.targetId());
        return toDto(saved, auth);
    }

    public CommentDTO update(Integer commentId, String content, Authentication auth) {
        Comment comment = find(commentId);
        comment.setContent(cleanContent(content));
        return toDto(commentRepository.save(comment), auth);
    }

    public void delete(Integer commentId) {
        commentRepository.delete(find(commentId));
    }

    // Admin moderation list across all scopes, newest first, filtered by text in memory. 
    @Transactional(readOnly = true)
    public List<CommentDTO> adminSearch(String scope, String q, Authentication auth) {
        CommentScope filter = scope == null || scope.isBlank() || "ALL".equalsIgnoreCase(scope)
                ? null
                : CommentScope.from(scope);
        String needle = q == null || q.isBlank() ? null : q.trim().toLowerCase(Locale.ROOT);

        List<Comment> rows = filter == null
                ? commentRepository.findTop500ByOrderByCreatedAtDesc()
                : commentRepository.findTop500ByScopeOrderByCreatedAtDesc(filter);

        return rows.stream()
                .filter(c -> needle == null || c.getContent().toLowerCase(Locale.ROOT).contains(needle))
                .map(c -> toDto(c, auth))
                .toList();
    }

    /*
        Encrypts every comment that is still stored as plain text.
        Safe to run more than once: rows that are already encrypted are skipped.
    */
    public int encryptLegacyComments() {
        int updated = 0;
        for (Object[] row : commentRepository.findRawContent()) {
            Integer id = ((Number) row[0]).intValue();
            String stored = (String) row[1];
            if (FieldCipher.isEncrypted(stored)) {
                continue;
            }
            commentRepository.updateStoredContent(id, FieldCipher.encrypt(stored));
            updated++;
        }
        log.info("Encrypted {} legacy comments", updated);
        return updated;
    }

    private CommentDTO toDto(Comment c, Authentication auth) {
        return new CommentDTO(
                c.getId(),
                c.getScope().name(),
                c.targetId(),
                targetName(c),
                c.getAuthor().getId(),
                c.getAuthor().getUsername(),
                c.getContent(),
                c.getCreatedAt(),
                c.getUpdatedAt(),
                commentAccess.editable(auth, c),
                commentAccess.deletable(auth, c));
    }

    private static String targetName(Comment c) {
        return switch (c.getScope()) {
            case GLOBAL -> "Global";
            case TASK -> c.getTask().getTitle() + " · " + c.getTask().getProject().getName();
            case PROJECT -> c.getProject().getName();
            case TEAM -> c.getTeam().getName();
        };
    }

    private Comment find(Integer commentId) {
        return commentRepository.findById(commentId)
                .orElseThrow(() -> new IllegalArgumentException("Comment not found"));
    }

    private static Integer requireId(Integer id) {
        if (id == null) {
            throw new IllegalArgumentException("targetId is required");
        }
        return id;
    }

    private static String cleanContent(String value) {
        String text = value == null ? "" : value.trim();
        if (text.isEmpty()) {
            throw new IllegalArgumentException("Comment cannot be empty");
        }
        if (text.length() > MAX_LENGTH) {
            throw new IllegalArgumentException("Comments can be " + MAX_LENGTH + " characters or fewer");
        }
        return text;
    }
}