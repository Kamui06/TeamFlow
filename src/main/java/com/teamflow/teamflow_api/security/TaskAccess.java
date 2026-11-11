package com.teamflow.teamflow_api.security;

import com.teamflow.teamflow_api.entity.User;
import com.teamflow.teamflow_api.repository.TaskRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;


// Task permissions, derived from the caller's project level.
 
// VIEWER:  view
// MEMBER:  create; edit tasks they created or are assigned to; delete tasks they created
// MANAGER: everything in the project, including assigning people

@Component("taskAccess")
@RequiredArgsConstructor
public class TaskAccess {

    private final TaskRepository taskRepository;
    private final ProjectAccess projectAccess;

    public boolean canViewProject(Authentication auth, Integer projectId) {
        return projectAccess.canView(auth, projectId);
    }

    public boolean canCreate(Authentication auth, Integer projectId) {
        return projectAccess.levelFor(auth, projectId) >= ProjectAccess.MEMBER;
    }

    public boolean canAssignInProject(Authentication auth, Integer projectId) {
        return projectAccess.levelFor(auth, projectId) >= ProjectAccess.MANAGER;
    }

    public boolean canView(Authentication auth, Integer taskId) {
        return taskRepository.findById(taskId)
                .filter(task -> projectAccess.levelFor(auth, task.getProject()) >= ProjectAccess.VIEWER)
                .isPresent();
    }

    public boolean canEdit(Authentication auth, Integer taskId) {
        return taskRepository.findById(taskId)
                .filter(task -> {
                    int level = projectAccess.levelFor(auth, task.getProject());
                    if (level >= ProjectAccess.MANAGER) {
                        return true;
                    }
                    if (level < ProjectAccess.MEMBER) {
                        return false;
                    }
                    Integer me = CurrentUser.id(auth);
                    return isUser(task.getCreatedBy(), me) || taskRepository.isAssignedTo(taskId, me);
                })
                .isPresent();
    }

    public boolean canAssign(Authentication auth, Integer taskId) {
        return taskRepository.findById(taskId)
                .filter(task -> projectAccess.levelFor(auth, task.getProject()) >= ProjectAccess.MANAGER)
                .isPresent();
    }

    public boolean canDelete(Authentication auth, Integer taskId) {
        return taskRepository.findById(taskId)
                .filter(task -> {
                    int level = projectAccess.levelFor(auth, task.getProject());
                    if (level >= ProjectAccess.MANAGER) {
                        return true;
                    }
                    return level >= ProjectAccess.MEMBER && isUser(task.getCreatedBy(), CurrentUser.id(auth));
                })
                .isPresent();
    }

    private static boolean isUser(User user, Integer userId) {
        return user != null && user.getId().equals(userId);
    }
}
