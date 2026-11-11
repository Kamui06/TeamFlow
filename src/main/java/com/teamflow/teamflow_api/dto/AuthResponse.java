package com.teamflow.teamflow_api.dto;
 
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
 
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class AuthResponse {
    private Integer userId;
    private String username;
    private String email;
    private String firstName;
    private String token;
    private String refreshToken;
    private String message;
    
    // Constructor for error responses
    public AuthResponse(Integer userId, String username, String email, String firstName, 
                       String token, String message) {
        this.userId = userId;
        this.username = username;
        this.email = email;
        this.firstName = firstName;
        this.token = token;
        this.message = message;
    }
}