package com.teamflow.teamflow_api.service;

import com.teamflow.teamflow_api.entity.RefreshToken;
import com.teamflow.teamflow_api.entity.User;
import com.teamflow.teamflow_api.exception.InvalidRefreshTokenException;
import com.teamflow.teamflow_api.repository.RefreshTokenRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Transactional
@Slf4j
public class RefreshTokenService {

    private static final String SESSION_ENDED = "Your session has ended. Please log in again.";
    private static final SecureRandom RANDOM = new SecureRandom();

    private final RefreshTokenRepository refreshTokenRepository;

    @Value("${jwt.refresh.expiration:604800000}")
    private long refreshTtlMs;

    public record Rotation(User user, String refreshToken) {
    }

    public Duration ttl() {
        return Duration.ofMillis(refreshTtlMs);
    }

    // Creates a refresh token for a user at sign-in. Only its hash is stored. 
    public String issue(User user) {
        String raw = newRawToken();
        refreshTokenRepository.save(RefreshToken.builder()
                .user(user)
                .tokenHash(hash(raw))
                .expiresAt(LocalDateTime.now(ZoneOffset.UTC).plus(ttl()))
                .build());
        return raw;
    }

    /*
        Exchanges a refresh token for a new one.
        noRollbackFor keeps the revocation of a copied token when the request then fails.
    */
    @Transactional(noRollbackFor = InvalidRefreshTokenException.class)
    public Rotation rotate(String raw) {
        RefreshToken stored = refreshTokenRepository.findByTokenHash(hash(raw))
                .orElseThrow(() -> new InvalidRefreshTokenException(SESSION_ENDED));

        if (stored.isRevoked()) {
            return replay(stored);
        }
        if (stored.getExpiresAt().isBefore(LocalDateTime.now(ZoneOffset.UTC))) {
            throw new InvalidRefreshTokenException("Your session has expired. Please log in again.");
        }

        User user = stored.getUser();
        if (!Boolean.TRUE.equals(user.getIsActive())) {
            throw new InvalidRefreshTokenException("This account is inactive.");
        }

        String next = newRawToken();
        stored.setRevoked(true);
        stored.setSuccessorHash(hash(next));
        stored.setSuccessorSecret(next);

        refreshTokenRepository.save(RefreshToken.builder()
                .user(user)
                .tokenHash(hash(next))
                .expiresAt(LocalDateTime.now(ZoneOffset.UTC).plus(ttl()))
                .build());

        return new Rotation(user, next);
    }

    /*
        A revoked token came back. If its successor is still unused, the client never received
        that successor (lost response, sleep, parallel request), so hand the same one over again.
        If the successor was already used, this is a copy of the token, so end every session.
    */
    private Rotation replay(RefreshToken old) {
        if (old.getSuccessorHash() != null && old.getSuccessorSecret() != null) {
            Optional<RefreshToken> successor = refreshTokenRepository.findByTokenHash(old.getSuccessorHash());
            if (successor.isPresent()
                    && !successor.get().isRevoked()
                    && successor.get().getExpiresAt().isAfter(LocalDateTime.now(ZoneOffset.UTC))) {
                log.info("Refresh token replayed before its successor was used; returning the successor");
                return new Rotation(successor.get().getUser(), old.getSuccessorSecret());
            }
        }

        log.warn("Revoked refresh token reused for user {}. Ending all sessions.", old.getUser().getId());
        revokeAll(old.getUser().getId());
        throw new InvalidRefreshTokenException(SESSION_ENDED);
    }

    // Sign-out. Also revokes the successor, so a lost response can't leave a live session behind. 
    public void revoke(String raw) {
        refreshTokenRepository.findByTokenHash(hash(raw)).ifPresent(token -> {
            token.setRevoked(true);
            if (token.getSuccessorHash() != null) {
                refreshTokenRepository.findByTokenHash(token.getSuccessorHash())
                        .ifPresent(next -> next.setRevoked(true));
            }
        });
    }

    public void revokeAll(Integer userId) {
        refreshTokenRepository.findByUserIdAndRevokedFalse(userId).forEach(t -> t.setRevoked(true));
    }

    // Removes expired rows and the encrypted successor tokens stored on them. Runs nightly. 
    @Scheduled(cron = "0 15 3 * * *")
    public void purgeExpired() {
        long removed = refreshTokenRepository.deleteByExpiresAtBefore(LocalDateTime.now(ZoneOffset.UTC));
        log.info("Removed {} expired refresh tokens", removed);
    }

    private static String newRawToken() {
        byte[] bytes = new byte[48];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static String hash(String raw) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(raw.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is not available", e);
        }
    }
}