package com.teamflow.teamflow_api.repository;

import com.teamflow.teamflow_api.entity.Notification;
import com.teamflow.teamflow_api.entity.NotificationType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, Integer> {

    Page<Notification> findByUserIdOrderByCreatedAtDesc(Integer userId, Pageable pageable);

    Page<Notification> findByUserIdAndReadAtIsNullOrderByCreatedAtDesc(Integer userId, Pageable pageable);

    List<Notification> findByUserIdAndReadAtIsNull(Integer userId);

    boolean existsByUserIdAndTaskIdAndTypeAndCreatedAtAfter(
            Integer userId, Integer taskId, NotificationType type, LocalDateTime since);

    @Query("SELECT COUNT(n) FROM Notification n WHERE n.user.id = :userId AND n.readAt IS NULL")
    long countUnreadByUserId(@Param("userId") Integer userId);

    @Modifying
    @Query("DELETE FROM Notification n WHERE n.user.id = :userId AND n.readAt IS NOT NULL")
    int deleteReadForUser(@Param("userId") Integer userId);

    /** Notifications linked to a project. Used to report what stays after a project is deleted. */
    @Query("SELECT COUNT(n) FROM Notification n WHERE n.project.id = :projectId")
    long countByProjectId(@Param("projectId") Integer projectId);

    /** Notifications linked to a team. Used to report what stays after a team is deleted. */
    @Query("SELECT COUNT(n) FROM Notification n WHERE n.team.id = :teamId")
    long countByTeamId(@Param("teamId") Integer teamId);
}