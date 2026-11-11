package com.teamflow.teamflow_api.service;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import com.teamflow.teamflow_api.security.UserPrincipal;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import javax.crypto.SecretKey;

@Service
@RequiredArgsConstructor
@Slf4j
public class JwtService {

    @Value("${jwt.secret}")
    private String jwtSecret;

    @Value("${jwt.expiration:900000}")
    private long jwtExpirationInMs;

    @Value("${jwt.refresh.expiration:604800000}")
    private long refreshTokenExpirationInMs;

    /**
     * Generate JWT token from Authentication object
     */
    public String generateToken(Authentication authentication) {
        if (authentication == null) {
            throw new IllegalArgumentException("Authentication must not be null");
        }

        Object principal = authentication.getPrincipal();
        if (!(principal instanceof UserPrincipal)) {
            throw new IllegalArgumentException("Authentication principal must be a UserPrincipal");
        }

        return generateTokenFromUserId(((UserPrincipal) principal).getId());
    }

    /**
     * Generate JWT token from User ID
     */
    public String generateTokenFromUserId(Integer userId) {
        return generateToken(userId, jwtExpirationInMs);
    }

    /**
     * Generate refresh token from User ID
     */
    public String generateRefreshToken(Integer userId) {
        return generateToken(userId, refreshTokenExpirationInMs);
    }

    private String generateToken(Integer userId, long expirationInMs) {
        SecretKey key = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
        Instant issuedAt = Instant.now();
        Instant expiresAt = issuedAt.plusMillis(expirationInMs);

        return Jwts.builder()
                .subject(userId.toString())
                .issuedAt(Date.from(issuedAt))
                .expiration(Date.from(expiresAt))
                .signWith(key, Jwts.SIG.HS512)
                .compact();
    }

    /**
     * Extract User ID from JWT token
     */
    public Integer getUserIdFromToken(String token) {
        try {
            SecretKey key = Keys.hmacShaKeyFor(
                    jwtSecret.getBytes(StandardCharsets.UTF_8)
            );

            Claims claims = Jwts.parser()
                    .verifyWith(key)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();

            return Integer.parseInt(claims.getSubject());

        } catch (JwtException e) {
            log.error("Error parsing JWT token: {}", e.getMessage());
            return null;
        } catch (NumberFormatException e) {
            log.error("Invalid user ID in token: {}", e.getMessage());
            return null;
        }
    }

    /**
     * Validate JWT token
     */
    public boolean validateToken(String token) {
        try {
            SecretKey key = Keys.hmacShaKeyFor(
                    jwtSecret.getBytes(StandardCharsets.UTF_8)
            );

            Jwts.parser()
                    .verifyWith(key)
                    .build()
                    .parseSignedClaims(token);

            return true;

        } catch (MalformedJwtException ex) {
            log.error("Invalid JWT token: {}", ex.getMessage());
        } catch (ExpiredJwtException ex) {
            log.error("Expired JWT token: {}", ex.getMessage());
        } catch (UnsupportedJwtException ex) {
            log.error("Unsupported JWT token: {}", ex.getMessage());
        } catch (IllegalArgumentException ex) {
            log.error("JWT claims string is empty: {}", ex.getMessage());
        } catch (JwtException ex) {
            log.error("JWT validation failed: {}", ex.getMessage());
        }

        return false;
    }
}