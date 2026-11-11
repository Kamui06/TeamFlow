package com.teamflow.teamflow_api.dto;

import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.LocalDate;
import java.util.List;


// Used for creating and updating a task.
// On create, projectId and title are required (checked in TaskService).
// On update, any null field is left unchanged.
// assigneeIds: null leaves assignees unchanged; an empty list clears them.

@Data
public class TaskRequest {

    private Integer projectId;

    @Size(max = 200, message = "Title must be 200 characters or fewer")
    private String title;

    private String description;

    private String priority;

    private Integer statusId;

    private LocalDate dueDate;

    private Boolean clearDueDate;

    private List<Integer> assigneeIds;
}