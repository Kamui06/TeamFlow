package com.teamflow.teamflow_api.service;

// import com.teamflow.teamflow_api.entity.Project;
import com.teamflow.teamflow_api.entity.Task;
import com.teamflow.teamflow_api.repository.ProjectRepository;
import com.teamflow.teamflow_api.repository.TaskRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class ProjectStatusSync {

    private static final String ACTIVE = "ACTIVE";
    private static final String COMPLETED = "COMPLETED";
    private static final String ARCHIVED = "ARCHIVED";

    private final ProjectRepository projectRepository;
    private final TaskRepository taskRepository;
    private final NotificationService notificationService;

    @Transactional
    public void sync(Integer projectId) {
        if (projectId == null) {
            return;
        }

        projectRepository.findById(projectId).ifPresent(project -> {
            if (ARCHIVED.equals(project.getStatus())) {
                return;
            }

            List<Task> tasks = taskRepository.findByProjectId(projectId);
            boolean allFinished = !tasks.isEmpty() && tasks.stream().allMatch(this::isFinished);
            String target = allFinished ? COMPLETED : ACTIVE;

            if (!target.equals(project.getStatus())) {
                project.setStatus(target);
                projectRepository.save(project);
                log.info("Project {} status changed to {}", projectId, target);

                if (COMPLETED.equals(target)) {
                    notificationService.onProjectCompleted(project);
                }
            }
        });
    }

    private boolean isFinished(Task task) {
        return task.getStatus() != null && Boolean.TRUE.equals(task.getStatus().getIsFinal());
    }
}