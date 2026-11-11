package com.teamflow.teamflow_api.dto;

import java.time.LocalDate;

public class CreateProjectRequest {

    private String name;
    private String description;
    private Integer teamId;

    /** Optional due date, yyyy-mm-dd. The start date is set by the server. */
    private LocalDate endDate;

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public Integer getTeamId() { return teamId; }
    public void setTeamId(Integer teamId) { this.teamId = teamId; }

    public LocalDate getEndDate() { return endDate; }
    public void setEndDate(LocalDate endDate) { this.endDate = endDate; }
}