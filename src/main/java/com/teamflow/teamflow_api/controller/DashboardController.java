package com.teamflow.teamflow_api.controller;
 
import com.teamflow.teamflow_api.dto.UserStatsDTO;
import com.teamflow.teamflow_api.dto.TaskSummaryDTO;
import com.teamflow.teamflow_api.dto.TeamOverviewDTO;
import com.teamflow.teamflow_api.dto.ActivityDTO;
import com.teamflow.teamflow_api.dto.ProjectStatsDTO;
import com.teamflow.teamflow_api.dto.DashboardDataDTO;

import com.teamflow.teamflow_api.service.DashboardService;
import com.teamflow.teamflow_api.security.CurrentUser;
import com.teamflow.teamflow_api.security.UserPrincipal;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
 
@RestController
@RequestMapping("/dashboard")
@RequiredArgsConstructor
@CrossOrigin("http://localhost:5173")
@Slf4j
public class DashboardController {
    
    private final DashboardService dashboardService;
    
    @GetMapping
    @PreAuthorize("isAuthenticated()")
        public ResponseEntity<DashboardDataDTO> getDashboard(Authentication authentication) {
            return ResponseEntity.ok(dashboardService.getWorkspace(
        CurrentUser.id(authentication), CurrentUser.isSystemAdmin(authentication)));
    }
    
    @GetMapping("/stats")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<UserStatsDTO> getUserStats(Authentication authentication) {
        Integer userId = getUserId(authentication);
        UserStatsDTO stats = dashboardService.getUserStats(userId);
        return ResponseEntity.ok(stats);
    }
    
    @GetMapping("/tasks/assigned")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<TaskSummaryDTO>> getAssignedTasks(Authentication authentication) {
        Integer userId = getUserId(authentication);
        List<TaskSummaryDTO> tasks = dashboardService.getAssignedTasks(userId);
        return ResponseEntity.ok(tasks);
    }
    
    @GetMapping("/tasks/recent")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<TaskSummaryDTO>> getRecentTasks(Authentication authentication) {
        Integer userId = getUserId(authentication);
        List<TaskSummaryDTO> tasks = dashboardService.getRecentTasks(userId);
        return ResponseEntity.ok(tasks);
    }
    
    @GetMapping("/tasks/upcoming")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<TaskSummaryDTO>> getUpcomingTasks(Authentication authentication) {
        Integer userId = getUserId(authentication);
        List<TaskSummaryDTO> tasks = dashboardService.getUpcomingTasks(userId);
        return ResponseEntity.ok(tasks);
    }
    
    @GetMapping("/teams/my-teams")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<TeamOverviewDTO>> getUserTeams(Authentication authentication) {
        Integer userId = getUserId(authentication);
        List<TeamOverviewDTO> teams = dashboardService.getUserTeams(userId);
        return ResponseEntity.ok(teams);
    }
    
    @GetMapping("/activity")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<ActivityDTO>> getRecentActivity(
            Authentication authentication,
            @RequestParam(defaultValue = "10") int limit) {
        Integer userId = getUserId(authentication);
        List<ActivityDTO> activity = dashboardService.getRecentActivity(userId, limit);
        return ResponseEntity.ok(activity);
    }
    
    @GetMapping("/projects")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<ProjectStatsDTO>> getProjectStats(Authentication authentication) {
        Integer userId = getUserId(authentication);
        List<ProjectStatsDTO> stats = dashboardService.getProjectStats(userId);
        return ResponseEntity.ok(stats);
    }
    
    @GetMapping("/notifications/unread")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Long> getUnreadNotificationCount(Authentication authentication) {
        Integer userId = getUserId(authentication);
        long count = dashboardService.getUnreadNotificationCount(userId);
        return ResponseEntity.ok(count);
    }
    
    private Integer getUserId(Authentication authentication) {
        try {
            UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
            return principal.getId();
        } catch (Exception e) {
            log.error("Failed to extract user ID from authentication: {}", e.getMessage());
            throw new IllegalArgumentException("Invalid authentication");
        }
    }
}