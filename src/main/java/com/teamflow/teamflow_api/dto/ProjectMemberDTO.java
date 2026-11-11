package com.teamflow.teamflow_api.dto;

import com.teamflow.teamflow_api.entity.ProjectMember;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class ProjectMemberDTO {
    private Integer projectId;
    private Integer userId;
    private String username;
    private String firstName;
    private String lastName;
    private String role;
    private LocalDateTime joinedAt;

    public static ProjectMemberDTO from(ProjectMember member) {
        return ProjectMemberDTO.builder()
                .projectId(member.getId().getProjectId())
                .userId(member.getId().getUserId())
                .username(member.getUser().getUsername())
                .firstName(member.getUser().getFirstName())
                .lastName(member.getUser().getLastName())
                .role(member.getRole())
                .joinedAt(member.getJoinedAt())
                .build();
    }
}