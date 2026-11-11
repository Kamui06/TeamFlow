package com.teamflow.teamflow_api.dto;
 
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDate;
 
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class TaskSummaryDTO {
    private Integer id;
    private String title;
    private Integer projectId;
    private String priority;
    private String status;
    private LocalDate dueDate;
    private String assigneeName;
}