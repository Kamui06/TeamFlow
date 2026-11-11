package com.teamflow.teamflow_api.controller;

import com.teamflow.teamflow_api.dto.CommentDTO;
import com.teamflow.teamflow_api.dto.CommentRequest;
import com.teamflow.teamflow_api.entity.CommentScope;
import com.teamflow.teamflow_api.service.CommentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/comments")
@RequiredArgsConstructor
public class CommentController {

    private final CommentService commentService;

    // GET /api/comments?scope=TASK&targetId=14  (anyone who can read the target)
    @GetMapping
    @PreAuthorize("@commentAccess.canRead(authentication, #scope, #targetId)")
    public CommentDTO.Thread thread(
            @RequestParam("scope") String scope,
            @RequestParam(value = "targetId", required = false) Integer targetId,
            Authentication authentication) {
        return commentService.thread(CommentScope.from(scope), targetId, authentication);
    }

    // POST /api/comments  body: {"scope":"TASK","targetId":14,"content":"..."}  (MEMBER or higher)
    @PostMapping
    @PreAuthorize("@commentAccess.canPost(authentication, #request.scope, #request.targetId)")
    public ResponseEntity<CommentDTO> create(
            @RequestBody CommentRequest request,
            Authentication authentication) {
        return ResponseEntity.status(HttpStatus.CREATED).body(commentService.create(request, authentication));
    }

    // PUT /api/comments/{id}  body: {"content":"..."}  (author only)
    @PutMapping("/{commentId}")
    @PreAuthorize("@commentAccess.canEdit(authentication, #commentId)")
    public CommentDTO update(
            @PathVariable Integer commentId,
            @RequestBody Map<String, String> body,
            Authentication authentication) {
        return commentService.update(commentId, body.get("content"), authentication);
    }

    // DELETE /api/comments/{id}  (author, project MANAGER, team OWNER/ADMIN, or system admin)
    @DeleteMapping("/{commentId}")
    @PreAuthorize("@commentAccess.canDelete(authentication, #commentId)")
    public ResponseEntity<Void> delete(@PathVariable Integer commentId) {
        commentService.delete(commentId);
        return ResponseEntity.noContent().build();
    }

    // GET /api/comments/admin?scope=ALL&q=text  (system admins only)
    @GetMapping("/admin")
    @PreAuthorize("hasRole('ADMIN')")
    public List<CommentDTO> adminSearch(
            @RequestParam(value = "scope", required = false) String scope,
            @RequestParam(value = "q", required = false) String q,
            Authentication authentication) {
        return commentService.adminSearch(scope, q, authentication);
    }

    // POST /api/comments/admin/encrypt-legacy  (system admins only)
    // Encrypts comments saved before encryption was enabled. Safe to call more than once.
    @PostMapping("/admin/encrypt-legacy")
    @PreAuthorize("hasRole('ADMIN')")
    public Map<String, Integer> encryptLegacy() {
        return Map.of("encrypted", commentService.encryptLegacyComments());
    }
}