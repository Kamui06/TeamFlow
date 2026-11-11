package com.teamflow.teamflow_api.controller;

import com.teamflow.teamflow_api.dto.CreateProjectRequest;
import com.teamflow.teamflow_api.dto.ProjectDTO;
import com.teamflow.teamflow_api.dto.ProjectMemberDTO;
import com.teamflow.teamflow_api.dto.UpdateProjectRequest;
import com.teamflow.teamflow_api.dto.UserSummaryDTO;
import com.teamflow.teamflow_api.security.CurrentUser;
import com.teamflow.teamflow_api.security.ProjectAccess;
import com.teamflow.teamflow_api.service.ProjectService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/projects")
@RequiredArgsConstructor
public class ProjectController {

    private final ProjectService projectService;
    private final ProjectAccess projectAccess;

    // GET /api/projects  (projects you are on, plus every project in teams you manage)
    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<ProjectDTO>> getUserProjects(Authentication authentication) {
        return ResponseEntity.ok(projectService.getProjectsByUser(
                CurrentUser.id(authentication), CurrentUser.isSystemAdmin(authentication)));
    }

    // GET /api/projects/team/{teamId}  (team member; you only see projects you are on)
    @GetMapping("/team/{teamId}")
    @PreAuthorize("@teamAccess.has(authentication, #teamId, 'VIEWER')")
    public ResponseEntity<List<ProjectDTO>> getTeamProjects(
            @PathVariable Integer teamId,
            Authentication authentication) {
        return ResponseEntity.ok(projectService.getProjectsByTeam(
                teamId, CurrentUser.id(authentication), CurrentUser.isSystemAdmin(authentication)));
    }

    // POST /api/projects  (MEMBER or higher in the team)
    @PostMapping
    @PreAuthorize("@projectAccess.canCreate(authentication, #request.teamId)")
    public ResponseEntity<ProjectDTO> createProject(
            @Valid @RequestBody CreateProjectRequest request,
            Authentication authentication) {
        ProjectDTO project = projectService.createProject(request, CurrentUser.id(authentication));
        return ResponseEntity.status(HttpStatus.CREATED).body(project);
    }

    @GetMapping("/{projectId}")
    @PreAuthorize("@projectAccess.canView(authentication, #projectId)")
    public ResponseEntity<ProjectDTO> getProject(
            @PathVariable Integer projectId,
    Authentication authentication) {
        String level = projectAccess.levelName(authentication, projectId);
        return ResponseEntity.ok(projectService.getProject(projectId, level));
    }

    // PUT /api/projects/{projectId}  (project MANAGER)
    @PutMapping("/{projectId}")
    @PreAuthorize("@projectAccess.canEdit(authentication, #projectId)")
    public ResponseEntity<ProjectDTO> updateProject(
            @PathVariable Integer projectId,
            @Valid @RequestBody UpdateProjectRequest request) {
        return ResponseEntity.ok(projectService.updateProject(projectId, request));
    }

    // DELETE /api/projects/{projectId}  (team OWNER)
    @DeleteMapping("/{projectId}")
    @PreAuthorize("@projectAccess.canDelete(authentication, #projectId)")
    public ResponseEntity<Void> deleteProject(@PathVariable Integer projectId) {
        projectService.deleteProject(projectId);
        return ResponseEntity.noContent().build();
    }

    // GET /api/projects/{projectId}/members  (project member)
    @GetMapping("/{projectId}/members")
    @PreAuthorize("@projectAccess.canView(authentication, #projectId)")
    public ResponseEntity<List<ProjectMemberDTO>> getProjectMembers(@PathVariable Integer projectId) {
        return ResponseEntity.ok(projectService.getProjectMembers(projectId));
    }

    // GET /api/projects/{projectId}/candidates  (project MANAGER): team members not yet on the project
    @GetMapping("/{projectId}/candidates")
    @PreAuthorize("@projectAccess.canManageMembers(authentication, #projectId)")
    public ResponseEntity<List<UserSummaryDTO>> getAddableMembers(@PathVariable Integer projectId) {
        return ResponseEntity.ok(projectService.getAddableMembers(projectId));
    }

    // POST /api/projects/{projectId}/members  body: {"userId": 2, "role": "MEMBER"}  (project MANAGER)
    @PostMapping("/{projectId}/members")
    @PreAuthorize("@projectAccess.canManageMembers(authentication, #projectId)")
    public ResponseEntity<ProjectMemberDTO> addProjectMember(
            @PathVariable Integer projectId,
            @RequestBody Map<String, Object> body) {
        Object rawUserId = body.get("userId");
        if (rawUserId == null) {
            throw new IllegalArgumentException("userId is required");
        }
        Integer userId = ((Number) rawUserId).intValue();
        String role = (String) body.get("role");
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(projectService.addProjectMember(projectId, userId, role));
    }

    // POST /api/projects/{projectId}/archive  (team OWNER/ADMIN or project MANAGER; project must be COMPLETED)
    @PostMapping("/{projectId}/archive")
    @PreAuthorize("@projectAccess.canArchive(authentication, #projectId)")
    public ResponseEntity<ProjectDTO> archiveProject(@PathVariable Integer projectId) {
        return ResponseEntity.ok(projectService.archiveProject(projectId));
    }

    // DELETE /api/projects/{projectId}/members/{userId}  (project MANAGER, or the member leaving)
    @DeleteMapping("/{projectId}/members/{userId}")
    @PreAuthorize("@projectAccess.canManageMembers(authentication, #projectId) or #userId == authentication.principal.id")
    public ResponseEntity<Void> removeProjectMember(
            @PathVariable Integer projectId,
            @PathVariable Integer userId) {
        projectService.removeProjectMember(projectId, userId);
        return ResponseEntity.noContent().build();
    }
}
