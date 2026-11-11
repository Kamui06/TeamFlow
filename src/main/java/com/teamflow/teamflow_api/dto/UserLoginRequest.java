package com.teamflow.teamflow_api.dto;
 
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
 
@Data
@NoArgsConstructor
@AllArgsConstructor
public class UserLoginRequest {
    private String username;
    private String email;
    private String password;
}