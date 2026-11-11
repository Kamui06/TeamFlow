package com.teamflow.teamflow_api.controller;

import com.teamflow.teamflow_api.dto.ProjectStatusDTO;
import com.teamflow.teamflow_api.dto.TaskDTO;
import com.teamflow.teamflow_api.dto.TaskRequest;
import com.teamflow.teamflow_api.security.CurrentUser;
import com.teamflow.teamflow_api.security.TaskAccess;
import com.teamflow.teamflow_api.service.TaskService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/tasks")
@RequiredArgsConstructor
public class TaskController {

    private final TaskService taskService;
    private final TaskAccess taskAccess;

    public record AssigneesRequest(List<Integer> userIds) {
    }

    // GET /api/tasks/my  (tasks I am assigned to, in projects I can see)
    @GetMapping("/my")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<TaskDTO>> getMyTasks(Authentication authentication) {
        return ResponseEntity.ok(taskService.getMyTasks(
                CurrentUser.id(authentication), CurrentUser.isSystemAdmin(authentication)));
    }

    // GET /api/tasks  (every task in projects I can see)
    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<TaskDTO>> getVisibleTasks(Authentication authentication) {
        return ResponseEntity.ok(taskService.getVisibleTasks(
                CurrentUser.id(authentication), CurrentUser.isSystemAdmin(authentication)));
    }

    // GET /api/tasks/project/{projectId}  (project VIEWER or higher)
    @GetMapping("/project/{projectId}")
    @PreAuthorize("@taskAccess.canViewProject(authentication, #projectId)")
    public ResponseEntity<List<TaskDTO>> getProjectTasks(@PathVariable Integer projectId) {
        return ResponseEntity.ok(taskService.getTasksForProject(projectId));
    }

    // GET /api/tasks/project/{projectId}/statuses  (project VIEWER or higher)
    @GetMapping("/project/{projectId}/statuses")
    @PreAuthorize("@taskAccess.canViewProject(authentication, #projectId)")
    public ResponseEntity<List<ProjectStatusDTO>> getProjectStatuses(@PathVariable Integer projectId) {
        return ResponseEntity.ok(taskService.getStatusesForProject(projectId));
    }

    // GET /api/tasks/{taskId}  (project VIEWER or higher)
    @GetMapping("/{taskId}")
    @PreAuthorize("@taskAccess.canView(authentication, #taskId)")
    public ResponseEntity<TaskDTO> getTask(@PathVariable Integer taskId) {
        return ResponseEntity.ok(taskService.getTask(taskId));
    }

    // POST /api/tasks  (project MEMBER or higher; assigning people needs MANAGER)
    @PostMapping
    @PreAuthorize("@taskAccess.canCreate(authentication, #request.projectId)")
    public ResponseEntity<TaskDTO> createTask(
            @Valid @RequestBody TaskRequest request,
            Authentication authentication) {
        if (hasAssignees(request.getAssigneeIds())
                && !taskAccess.canAssignInProject(authentication, request.getProjectId())) {
            throw new AccessDeniedException("Only project managers can assign people to a task");
        }
        TaskDTO task = taskService.createTask(request, CurrentUser.id(authentication));
        return ResponseEntity.status(HttpStatus.CREATED).body(task);
    }

    // PUT /api/tasks/{taskId}  (MANAGER, or MEMBER for their own or assigned tasks)
    @PutMapping("/{taskId}")
    @PreAuthorize("@taskAccess.canEdit(authentication, #taskId)")
    public ResponseEntity<TaskDTO> updateTask(
    @PathVariable Integer taskId,
    @Valid @RequestBody TaskRequest request,
    Authentication authentication) {
        TaskDTO current = taskService.getTask(taskId);

        boolean movingProject = request.getProjectId() != null
            && !request.getProjectId().equals(current.getProjectId());
        if (movingProject && !(taskAccess.canAssignInProject(authentication, current.getProjectId())
            && taskAccess.canAssignInProject(authentication, request.getProjectId()))) {
                throw new AccessDeniedException("Moving a task needs project manager access in both projects");
            }
            if (request.getAssigneeIds() != null && !taskAccess.canAssign(authentication, taskId)) {
                throw new AccessDeniedException("Only project managers can change assignees");
            }

        return ResponseEntity.ok(taskService.updateTask(taskId, request));
    }

    // PUT /api/tasks/{taskId}/assignees  body: {"userIds": [2, 3]}  (MANAGER)
    @PutMapping("/{taskId}/assignees")
    @PreAuthorize("@taskAccess.canAssign(authentication, #taskId)")
    public ResponseEntity<TaskDTO> setAssignees(
            @PathVariable Integer taskId,
            @RequestBody AssigneesRequest body) {
        if (body == null || body.userIds() == null) {
            throw new IllegalArgumentException("userIds is required");
        }
        return ResponseEntity.ok(taskService.setAssignees(taskId, body.userIds()));
    }

    // DELETE /api/tasks/{taskId}  (MANAGER, or the MEMBER who created it)
    @DeleteMapping("/{taskId}")
    @PreAuthorize("@taskAccess.canDelete(authentication, #taskId)")
    public ResponseEntity<Void> deleteTask(@PathVariable Integer taskId) {
        taskService.deleteTask(taskId);
        return ResponseEntity.noContent().build();
    }

    private static boolean hasAssignees(List<Integer> ids) {
        return ids != null && !ids.isEmpty();
    }
}