package com.teamflow.teamflow_api.dto;
 
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;
 
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ActivityDTO {
    private Integer id;
    private String action;
    private String entityType;
    private Integer entityId;
    private String description;
    private LocalDateTime createdAt;
}