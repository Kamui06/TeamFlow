package com.teamflow.teamflow_api.service;

import com.teamflow.teamflow_api.entity.Task;
import com.teamflow.teamflow_api.repository.TaskRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class TaskReminderService {

    private final TaskRepository taskRepository;
    private final NotificationService notificationService;

    // Every hour, on the hour. Tasks due within three days, or already overdue, that aren't finished.
    @Scheduled(cron = "0 0 * * * *")
    @Transactional
    public void sendDueReminders() {
        LocalDate today = LocalDate.now(ZoneId.systemDefault());
        List<Task> tasks = taskRepository.findOpenDueOnOrBefore(today.plusDays(3));
        tasks.forEach(task -> notificationService.onTaskDueReminder(task, today));
        log.debug("Due reminder check covered {} tasks", tasks.size());
    }
}