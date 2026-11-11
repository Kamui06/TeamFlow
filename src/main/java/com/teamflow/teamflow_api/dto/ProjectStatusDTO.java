package com.teamflow.teamflow_api.dto;

import com.teamflow.teamflow_api.entity.ProjectStatus;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class ProjectStatusDTO {
    private Integer id;
    private String name;
    private Integer position;
    private Boolean isDefault;
    private Boolean isFinal;

    public static ProjectStatusDTO from(ProjectStatus status) {
        return ProjectStatusDTO.builder()
                .id(status.getId())
                .name(status.getName())
                .position(status.getPosition())
                .isDefault(Boolean.TRUE.equals(status.getIsDefault()))
                .isFinal(Boolean.TRUE.equals(status.getIsFinal()))
                .build();
    }
}