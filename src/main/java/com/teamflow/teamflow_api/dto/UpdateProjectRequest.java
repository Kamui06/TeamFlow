package com.teamflow.teamflow_api.dto;

import java.time.LocalDate;

public class UpdateProjectRequest {

    private String name;
    private String description;
    private String status;

    /** New due date, yyyy-mm-dd. Ignored when clearEndDate is true. */
    private LocalDate endDate;

    /** true clears the due date. */
    private Boolean clearEndDate;

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public LocalDate getEndDate() { return endDate; }
    public void setEndDate(LocalDate endDate) { this.endDate = endDate; }

    public Boolean getClearEndDate() { return clearEndDate; }
    public void setClearEndDate(Boolean clearEndDate) { this.clearEndDate = clearEndDate; }
}