package com.teamflow.teamflow_api.controller;

import com.teamflow.teamflow_api.dto.NotificationDTO;
import com.teamflow.teamflow_api.dto.PagedResponse;
import com.teamflow.teamflow_api.security.CurrentUser;
import com.teamflow.teamflow_api.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/notifications")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class NotificationController {

    private final NotificationService notificationService;

    // GET /api/notifications?unreadOnly=true&page=0&size=20
    @GetMapping
    public PagedResponse<NotificationDTO> list(
            @RequestParam(defaultValue = "false") boolean unreadOnly,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            Authentication authentication) {
        return notificationService.list(CurrentUser.id(authentication), unreadOnly, page, size);
    }

    // GET /api/notifications/unread-count
    @GetMapping("/unread-count")
    public Map<String, Long> unreadCount(Authentication authentication) {
        return Map.of("count", notificationService.unreadCount(CurrentUser.id(authentication)));
    }

    // POST /api/notifications/{id}/read
    @PostMapping("/{notificationId}/read")
    public ResponseEntity<Void> markRead(@PathVariable Integer notificationId, Authentication authentication) {
        notificationService.markRead(notificationId, CurrentUser.id(authentication));
        return ResponseEntity.noContent().build();
    }

    // POST /api/notifications/read-all
    @PostMapping("/read-all")
    public ResponseEntity<Void> markAllRead(Authentication authentication) {
        notificationService.markAllRead(CurrentUser.id(authentication));
        return ResponseEntity.noContent().build();
    }

    // DELETE /api/notifications/
    @DeleteMapping("/{notificationId}")
    public ResponseEntity<Void> delete(@PathVariable Integer notificationId, Authentication authentication) {
        notificationService.delete(notificationId, CurrentUser.id(authentication));
        return ResponseEntity.noContent().build();
    }

    // DELETE /api/notifications/read  (removes every read notification)
    @DeleteMapping("/read")
    public Map<String, Integer> clearRead(Authentication authentication) {
        return Map.of("deleted", notificationService.clearRead(CurrentUser.id(authentication)));
    }
}