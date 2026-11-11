package com.teamflow.teamflow_api.controller;

import com.teamflow.teamflow_api.dto.AdminChartDTOs;
import com.teamflow.teamflow_api.dto.AdminDTOs;
import com.teamflow.teamflow_api.dto.AdminProjectDetail;
import com.teamflow.teamflow_api.dto.AdminProjectUpdateRequest;
import com.teamflow.teamflow_api.dto.AdminUserDetail;
import com.teamflow.teamflow_api.dto.AdminUserRow;
import com.teamflow.teamflow_api.dto.AdminUserUpdateRequest;
import com.teamflow.teamflow_api.dto.PagedResponse;
import com.teamflow.teamflow_api.dto.UserDTO;

import com.teamflow.teamflow_api.security.CurrentUser;
import com.teamflow.teamflow_api.service.AdminDeletionService;
import com.teamflow.teamflow_api.service.AdminProjectService;
import com.teamflow.teamflow_api.service.AdminService;
import com.teamflow.teamflow_api.service.AdminStatsService;
import com.teamflow.teamflow_api.service.AdminUserService;
import com.teamflow.teamflow_api.dto.DeletionImpact;

import lombok.RequiredArgsConstructor;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/admin")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {

    private final AdminService adminService;
    private final AdminStatsService adminStatsService;
    private final AdminUserService adminUserService;
    private final AdminProjectService adminProjectService;
    private final AdminDeletionService adminDeletionService;

    // Overview and charts

    @GetMapping("/overview")
    public AdminDTOs.OverviewStats overview() {
        return adminService.overview();
    }

    @GetMapping("/stats/kpis")
    public AdminDTOs.KpiSummary kpis() {
        return adminStatsService.kpis();
    }

    @GetMapping("/stats/signups")
    public List<AdminDTOs.SignupPoint> signups(@RequestParam(defaultValue = "12") int weeks) {
        return adminStatsService.signupsByWeek(weeks);
    }

    @GetMapping("/stats/users-by-status")
    public List<AdminChartDTOs.CategoryCount> usersByStatus() {
        return adminStatsService.usersByStatus();
    }

    @GetMapping("/stats/projects-by-status")
    public List<AdminChartDTOs.CategoryCount> projectsByStatus() {
        return adminStatsService.projectsByStatus();
    }

    @GetMapping("/stats/tasks-by-priority")
    public List<AdminChartDTOs.CategoryCount> tasksByPriority() {
        return adminStatsService.tasksByPriority();
    }

    @GetMapping("/stats/project-breakdown")
    public List<AdminChartDTOs.ProjectTaskBreakdown> projectBreakdown(
            @RequestParam(defaultValue = "10") int limit) {
        return adminStatsService.projectBreakdown(limit);
    }

    @GetMapping("/stats/workload")
    public List<AdminChartDTOs.UserWorkload> workload(@RequestParam(defaultValue = "10") int limit) {
        return adminStatsService.workload(limit);
    }

    // Teams and projects

    @GetMapping("/teams")
    public List<AdminDTOs.TeamRow> teams() {
        return adminService.teams();
    }

    @GetMapping("/projects")
    public List<AdminDTOs.ProjectRow> projects() {
        return adminService.projects();
    }

    // Users

    @GetMapping("/users")
    public PagedResponse<AdminUserRow> users(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String role,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return adminService.searchUsers(q, role, status, page, size);
    }

    // GET /api/admin/users/{id}  (profile, teams, and projects)
    @GetMapping("/users/{id}")
    public AdminUserDetail userDetail(@PathVariable Integer id) {
        return adminUserService.detail(id);
    }

    // PUT /api/admin/users/{id}  body: username, email, firstName, lastName, password (blank = unchanged)
    @PutMapping("/users/{id}")
    public AdminUserRow updateUser(
            @PathVariable Integer id,
            @RequestBody AdminUserUpdateRequest body,
            Authentication authentication) {
        return adminUserService.update(id, body, CurrentUser.id(authentication));
    }

    @DeleteMapping("/users/{id}")
    public ResponseEntity<Void> deleteUser(@PathVariable Integer id, Authentication authentication) {
        adminUserService.delete(id, CurrentUser.id(authentication));
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/users/{id}/active")
    public UserDTO setActive(
            @PathVariable Integer id,
            @RequestBody Map<String, Boolean> body,
            Authentication authentication) {
        Boolean active = body.get("active");
        if (active == null) {
            throw new IllegalArgumentException("active is required");
        }
        return adminService.setActive(id, active, CurrentUser.id(authentication));
    }

    // ---------- Project editor ----------

    @GetMapping("/projects/{id}")
    public AdminProjectDetail projectDetail(@PathVariable Integer id) {
        return adminProjectService.detail(id);
    }

    @PutMapping("/projects/{id}")
    public AdminProjectDetail updateProject(
    @PathVariable Integer id,
    @RequestBody AdminProjectUpdateRequest body) {
        return adminProjectService.update(id, body);
    }

    @PostMapping("/projects/{id}/members")
    public AdminProjectDetail addProjectMember(
    @PathVariable Integer id,
    @RequestBody Map<String, Object> body) {
        Object raw = body.get("userId");
        if (raw == null) {
            throw new IllegalArgumentException("userId is required");
        }
        return adminProjectService.addMember(id, ((Number) raw).intValue(), (String) body.get("role"));
    }

    @PutMapping("/projects/{id}/members/{userId}")
    public AdminProjectDetail changeProjectRole(
    @PathVariable Integer id,
    @PathVariable Integer userId,
    @RequestBody Map<String, String> body) {
        return adminProjectService.changeRole(id, userId, body.get("role"));
    }

    @DeleteMapping("/projects/{id}/members/{userId}")
    public AdminProjectDetail removeProjectMember(@PathVariable Integer id, @PathVariable Integer userId) {
        return adminProjectService.removeMember(id, userId);
    }

    @PutMapping("/projects/{id}/tasks/{taskId}/status")
    public AdminProjectDetail setTaskStatus(
    @PathVariable Integer id,
    @PathVariable Integer taskId,
    @RequestBody Map<String, Integer> body) {
        Integer statusId = body.get("statusId");
        if (statusId == null) {
            throw new IllegalArgumentException("statusId is required");
        }
        return adminProjectService.setTaskStatus(id, taskId, statusId);
    }

    @DeleteMapping("/projects/{id}/tasks/{taskId}")
    public AdminProjectDetail deleteTask(@PathVariable Integer id, @PathVariable Integer taskId) {
        return adminProjectService.deleteTask(id, taskId);
    }

    // ---------- Deletion (system admins only) ----------

    // GET /api/admin/teams/{id}/deletion-impact
    @GetMapping("/teams/{id}/deletion-impact")
    public DeletionImpact teamDeletionImpact(@PathVariable Integer id) {
        return adminDeletionService.teamImpact(id);
    }

    // DELETE /api/admin/teams/
    @DeleteMapping("/teams/{id}")
    public ResponseEntity<Void> deleteTeam(@PathVariable Integer id) {
        adminDeletionService.deleteTeam(id);
        return ResponseEntity.noContent().build();
    }

    // GET /api/admin/projects/{id}/deletion-impact
    @GetMapping("/projects/{id}/deletion-impact")
    public DeletionImpact projectDeletionImpact(@PathVariable Integer id) {
        return adminDeletionService.projectImpact(id);
    }

    // DELETE /api/admin/projects/
    @DeleteMapping("/projects/{id}")
    public ResponseEntity<Void> deleteProject(@PathVariable Integer id) {
        adminDeletionService.deleteProject(id);
        return ResponseEntity.noContent().build();
    }
}