package com.teamflow.teamflow_api.controller;
 
import com.teamflow.teamflow_api.dto.AuthResponse;
import com.teamflow.teamflow_api.entity.User;
import com.teamflow.teamflow_api.service.JwtService;
import com.teamflow.teamflow_api.service.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import org.springframework.web.bind.annotation.*;
 
@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
@CrossOrigin("http://localhost:5173")
@Slf4j
public class AuthController {
    
    private final UserService userService;
    private final JwtService jwtService;
    
    @PostMapping("/refresh")
    public ResponseEntity<AuthResponse> refreshToken(@RequestHeader("Authorization") String token) {
        try {
            if (!token.startsWith("Bearer ")) {
                throw new IllegalArgumentException("Invalid token format");
            }
            
            String jwt = token.substring(7);
            if (!jwtService.validateToken(jwt)) {
                throw new IllegalArgumentException("Invalid or expired token");
            }
            
            Integer userId = jwtService.getUserIdFromToken(jwt);
            User user = userService.getUserById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
            
            return ResponseEntity.ok(new AuthResponse(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getFirstName(),
                jwtService.generateTokenFromUserId(user.getId()),
                jwtService.generateRefreshToken(user.getId())
            ));
        } catch (Exception e) {
            log.error("Token refresh failed: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(new AuthResponse(null, null, null, null, null, "Token refresh failed"));
        }
    }
}