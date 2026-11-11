package com.teamflow.teamflow_api.dto;

import com.teamflow.teamflow_api.entity.SystemRole;
import com.teamflow.teamflow_api.entity.User;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class UserDTO {
    private Integer id;
    private String username;
    private String email;
    private String firstName;
    private String lastName;
    private Boolean isActive;
    private SystemRole role;
    private LocalDateTime createdAt;

    public static UserDTO from(User user) {
        return UserDTO.builder()
                .id(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .isActive(user.getIsActive())
                .role(user.getRole())
                .createdAt(user.getCreatedAt())
                .build();
    }
}