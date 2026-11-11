package com.teamflow.teamflow_api.dto;

import com.teamflow.teamflow_api.entity.Team;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;
import java.util.List;

@Getter
@Builder
public class TeamDTO {
    private Integer id;
    private String name;
    private String description;
    private Integer ownerId;
    private String ownerUsername;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private int memberCount;
    private String myRole;
    private List<TeamMemberDTO> members;

    public static TeamDTO from(Team team, List<TeamMemberDTO> members, String myRole) {
        return TeamDTO.builder()
                .id(team.getId())
                .name(team.getName())
                .description(team.getDescription())
                .ownerId(team.getOwner().getId())
                .ownerUsername(team.getOwner().getUsername())
                .createdAt(team.getCreatedAt())
                .updatedAt(team.getUpdatedAt())
                .memberCount(members.size())
                .myRole(myRole)
                .members(members)
                .build();
    }
}