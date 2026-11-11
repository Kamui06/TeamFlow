package com.teamflow.teamflow_api.repository;

import com.teamflow.teamflow_api.entity.Task;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;

@Repository
public interface TaskRepository extends JpaRepository<Task, Integer> {

    List<Task> findByProjectId(Integer projectId);
    List<Task> findByProjectIdIn(Collection<Integer> projectIds);
    List<Task> findByCreatedById(Integer createdById);
    List<Task> findByProject_Team_IdIn(Collection<Integer> teamIds);

    long countByCreatedAtAfter(LocalDateTime since);

    @Query("SELECT DISTINCT t FROM Task t JOIN t.assignees a WHERE a.id = :userId")
    List<Task> findAssignedTo(@Param("userId") Integer userId);

    @Query("SELECT CASE WHEN COUNT(t) > 0 THEN true ELSE false END FROM Task t JOIN t.assignees a "
            + "WHERE t.id = :taskId AND a.id = :userId")
    boolean isAssignedTo(@Param("taskId") Integer taskId, @Param("userId") Integer userId);

    @Query("SELECT COUNT(DISTINCT t) FROM Task t JOIN t.assignees a WHERE a.id = :userId")
    long countAssignedTasks(@Param("userId") Integer userId);

    @Query("SELECT COUNT(DISTINCT t) FROM Task t JOIN t.assignees a "
            + "WHERE a.id = :userId AND t.status.isFinal = true")
    long countCompletedTasks(@Param("userId") Integer userId);

    @Query("SELECT COUNT(DISTINCT t) FROM Task t JOIN t.assignees a "
            + "WHERE a.id = :userId AND t.dueDate < CURRENT_DATE AND t.status.isFinal = false")
    long countOverdueTasks(@Param("userId") Integer userId);

    @Query("SELECT DISTINCT t FROM Task t JOIN t.assignees a "
            + "WHERE a.id = :userId AND t.dueDate BETWEEN :startDate AND :endDate ORDER BY t.dueDate ASC")
    List<Task> findUpcomingTasks(
            @Param("userId") Integer userId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    @Query("SELECT COUNT(t) FROM Task t WHERE t.project.id = :projectId")
    long countByProjectId(@Param("projectId") Integer projectId);

    @Query("SELECT COUNT(t) FROM Task t WHERE t.project.id = :projectId AND t.status.isFinal = true")
    long countCompletedByProjectId(@Param("projectId") Integer projectId);

    @Query("SELECT t FROM Task t WHERE t.project.team.id IN :teamIds")
    List<Task> findByTeamIds(@Param("teamIds") Collection<Integer> teamIds);

    // Open tasks (status not final) due on or before the given date. Tasks with no status count as open. 
    @Query("""
            SELECT t FROM Task t LEFT JOIN t.status s
            WHERE t.dueDate IS NOT NULL AND t.dueDate <= :limit
              AND (s IS NULL OR s.isFinal = false)
            """)
    List<Task> findOpenDueOnOrBefore(@Param("limit") LocalDate limit);
}