package com.teamflow.teamflow_api.repository;

import com.teamflow.teamflow_api.entity.RefreshToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Integer> {

    Optional<RefreshToken> findByTokenHash(String tokenHash);
    List<RefreshToken> findByUserIdAndRevokedFalse(Integer userId);

    long deleteByExpiresAtBefore(LocalDateTime cutoff);
}