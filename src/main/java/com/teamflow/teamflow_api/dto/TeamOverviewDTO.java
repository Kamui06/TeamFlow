package com.teamflow.teamflow_api.dto;
 
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
 
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TeamOverviewDTO {
    private Integer id;
    private String name;
    private long memberCount;
    private long projectCount;
    private String role;
}