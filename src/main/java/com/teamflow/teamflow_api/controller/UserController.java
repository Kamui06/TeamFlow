package com.teamflow.teamflow_api.controller;

import com.teamflow.teamflow_api.dto.UserDTO;
import com.teamflow.teamflow_api.dto.UserLoginRequest;
import com.teamflow.teamflow_api.dto.UserRegistrationRequest;
import com.teamflow.teamflow_api.entity.SystemRole;
import com.teamflow.teamflow_api.entity.User;
import com.teamflow.teamflow_api.exception.InvalidRefreshTokenException;
import com.teamflow.teamflow_api.security.UserPrincipal;
import com.teamflow.teamflow_api.service.JwtService;
import com.teamflow.teamflow_api.service.RefreshTokenService;
import com.teamflow.teamflow_api.service.UserService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/users")
public class UserController {

    static final String REFRESH_COOKIE = "refreshToken";

    // Limits the cookie to the auth endpoints, so it isn't sent with every API call.
    private static final String COOKIE_PATH = "/api/users";
    private static final int ACCESS_TOKEN_SECONDS = 900;

    private final UserService userService;
    private final JwtService jwtService;
    private final RefreshTokenService refreshTokenService;
    private final boolean cookieSecure;

    public UserController(UserService userService,
                          JwtService jwtService,
                          RefreshTokenService refreshTokenService,
                          @Value("${jwt.refresh-cookie.secure:false}") boolean cookieSecure) {
        this.userService = userService;
        this.jwtService = jwtService;
        this.refreshTokenService = refreshTokenService;
        this.cookieSecure = cookieSecure;
    }

    // GET /api/users  (system admins only)
    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public List<UserDTO> getAllUsers() {
        return userService.getAllUsers().stream()
                .map(UserDTO::from)
                .toList();
    }

    // GET /api/users/{id}  (admins, or the user themselves)
    @GetMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN') or #id == authentication.principal.id")
    public ResponseEntity<UserDTO> getUserById(@PathVariable Integer id) {
        return userService.getUserById(id)
                .map(UserDTO::from)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    // PUT /api/users/{id}/role  (system admins only)
    @PutMapping("/{id}/role")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<UserDTO> changeSystemRole(
            @PathVariable Integer id,
            @RequestBody Map<String, String> body,
            Authentication authentication) {
        String raw = body.get("role");
        if (raw == null || raw.isBlank()) {
            throw new IllegalArgumentException("role is required");
        }
        SystemRole role = SystemRole.valueOf(raw.trim().toUpperCase());
        Object principal = authentication == null ? null : authentication.getPrincipal();
        if (!(principal instanceof UserPrincipal userPrincipal)) {
            throw new AccessDeniedException("Authenticated user principal is required");
        }
        Integer callerId = userPrincipal.getId();

        User updated = userService.changeSystemRole(id, role, callerId);
        return ResponseEntity.ok(UserDTO.from(updated));
    }

    @PostMapping("/register")
    public ResponseEntity<Map<String, Object>> registerUser(@Valid @RequestBody UserRegistrationRequest request) {
        User user = userService.registerUser(request);

        Map<String, Object> response = Map.of(
                "id", user.getId(),
                "username", user.getUsername(),
                "email", user.getEmail(),
                "message", "User registered successfully"
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    // POST /api/users/login  -> access token in the body, refresh token in an HttpOnly cookie
    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(@Valid @RequestBody UserLoginRequest request) {
        User user = userService.loginUser(request.getEmail(), request.getPassword());
        String refreshToken = refreshTokenService.issue(user);

        Map<String, Object> body = accessTokenBody(user);
        body.put("message", "Login successful");

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, refreshCookie(refreshToken, refreshTokenService.ttl()).toString())
                .body(body);
    }

    // POST /api/users/refresh  (reads the cookie; rotates it)
    @PostMapping("/refresh")
    public ResponseEntity<Object> refresh(
            @CookieValue(name = REFRESH_COOKIE, required = false) String refreshCookieValue) {
        if (refreshCookieValue == null || refreshCookieValue.isBlank()) {
            return sessionEnded("Your session has ended. Please log in again.");
        }
        try {
            RefreshTokenService.Rotation rotation = refreshTokenService.rotate(refreshCookieValue);
            return ResponseEntity.ok()
                    .header(HttpHeaders.SET_COOKIE,
                            refreshCookie(rotation.refreshToken(), refreshTokenService.ttl()).toString())
                    .body(accessTokenBody(rotation.user()));
        } catch (InvalidRefreshTokenException ex) {
            return sessionEnded(ex.getMessage());
        }
    }

    // POST /api/users/logout  (revokes the cookie's token and clears the cookie)
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(
            @CookieValue(name = REFRESH_COOKIE, required = false) String refreshCookieValue) {
        if (refreshCookieValue != null && !refreshCookieValue.isBlank()) {
            refreshTokenService.revoke(refreshCookieValue);
        }
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, refreshCookie("", Duration.ZERO).toString())
                .build();
    }

    private ResponseEntity<Object> sessionEnded(String message) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .header(HttpHeaders.SET_COOKIE, refreshCookie("", Duration.ZERO).toString())
                .body(Map.of("error", message));
    }

    private ResponseCookie refreshCookie(String value, Duration maxAge) {
        return ResponseCookie.from(REFRESH_COOKIE, value)
                .httpOnly(true)
                .secure(cookieSecure)
                .sameSite("Lax")
                .path(COOKIE_PATH)
                .maxAge(maxAge)
                .build();
    }

    private Map<String, Object> accessTokenBody(User user) {
        Map<String, Object> body = new HashMap<>();
        body.put("id", user.getId());
        body.put("username", user.getUsername());
        body.put("email", user.getEmail());
        body.put("role", user.getRole().name());
        body.put("accessToken", jwtService.generateTokenFromUserId(user.getId()));
        body.put("tokenType", "Bearer");
        body.put("expiresIn", ACCESS_TOKEN_SECONDS);
        return body;
    }
}