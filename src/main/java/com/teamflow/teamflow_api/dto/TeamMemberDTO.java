package com.teamflow.teamflow_api.dto;

import com.teamflow.teamflow_api.entity.TeamMember;
import com.teamflow.teamflow_api.entity.User;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class TeamMemberDTO {
    private Integer teamId;
    private Integer userId;
    private String username;
    private String firstName;
    private String lastName;
    private String role;
    private LocalDateTime joinedAt;

    public static TeamMemberDTO from(TeamMember member) {
        User user = member.getUser();
        return TeamMemberDTO.builder()
                .teamId(member.getId().getTeamId())
                .userId(member.getId().getUserId())
                .username(user.getUsername())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .role(member.getRole())
                .joinedAt(member.getJoinedAt())
                .build();
    }
}