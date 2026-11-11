package com.teamflow.teamflow_api.repository;
 
import com.teamflow.teamflow_api.entity.User;
import com.teamflow.teamflow_api.entity.SystemRole;
import com.teamflow.teamflow_api.entity.Task;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.time.LocalDate;
import java.time.LocalDateTime;
 
@Repository
public interface UserRepository extends JpaRepository<User, Integer>, JpaSpecificationExecutor<User> {
    Optional<User> findByUsername(String username);
    Optional<User> findByEmail(String email);
    List<User> findByRole(SystemRole role);

    boolean existsByUsername(String username);
    boolean existsByEmail(String email);

    long countByCreatedAtAfter(LocalDateTime since);
    long countByRole(SystemRole role);

    @Query("""
        SELECT u FROM User u
        WHERE u.isActive = true
        AND LOWER(u.username) LIKE LOWER(CONCAT('%', :query, '%'))
        AND NOT EXISTS (
            SELECT tm FROM TeamMember tm
            WHERE tm.id.teamId = :teamId AND tm.id.userId = u.id
        )
        ORDER BY u.username ASC
    """)
    List<User> findAddableToTeam(@Param("teamId") Integer teamId, @Param("query") String query, Pageable pageable);

    @Query(value = """
        SELECT to_char(date_trunc('week', created_at), 'YYYY-MM-DD') AS week_start,
               COUNT(*) AS signups
        FROM users
        WHERE created_at >= :since
        GROUP BY week_start
        ORDER BY week_start
    """, nativeQuery = true)
    List<Object[]> countSignupsByWeek(@Param("since") LocalDateTime since);

    @Query("SELECT COUNT(u) FROM User u WHERE COALESCE(u.isActive, true) = :active")
    long countByActive(@Param("active") Boolean active);

    @Query("""
        SELECT t FROM Task t LEFT JOIN t.status s
        WHERE t.dueDate IS NOT NULL AND t.dueDate <= :limit
          AND (s IS NULL OR s.isFinal = false)
        """)
    List<Task> findOpenDueOnOrBefore(@Param("limit") LocalDate limit);
}