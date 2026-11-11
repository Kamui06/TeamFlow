package com.teamflow.teamflow_api.service;

import com.teamflow.teamflow_api.dto.AdminChartDTOs;
import com.teamflow.teamflow_api.dto.AdminDTOs;
import com.teamflow.teamflow_api.repository.ProjectRepository;
import com.teamflow.teamflow_api.repository.TaskRepository;
import com.teamflow.teamflow_api.repository.TeamRepository;
import com.teamflow.teamflow_api.repository.UserRepository;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AdminStatsService {

    private final UserRepository userRepository;
    private final TeamRepository teamRepository;
    private final ProjectRepository projectRepository;
    private final TaskRepository taskRepository;
    private final EntityManager em;

    // Step 1: KPIs and sign-ups

    public AdminDTOs.KpiSummary kpis() {
        LocalDateTime since = LocalDateTime.now(ZoneId.systemDefault()).minusDays(7);

        return new AdminDTOs.KpiSummary(
                new AdminDTOs.Kpi(userRepository.count(), userRepository.countByCreatedAtAfter(since)),
                new AdminDTOs.Kpi(teamRepository.count(), teamRepository.countByCreatedAtAfter(since)),
                new AdminDTOs.Kpi(projectRepository.count(), projectRepository.countByCreatedAtAfter(since)),
                new AdminDTOs.Kpi(taskRepository.count(), taskRepository.countByCreatedAtAfter(since)));
    }

    // Sign-ups for the last N weeks, oldest first. Weeks with no sign-ups are returned as 0.
    public List<AdminDTOs.SignupPoint> signupsByWeek(int weeks) {
        if (weeks < 1 || weeks > 52) {
            throw new IllegalArgumentException("weeks must be between 1 and 52");
        }

        LocalDate thisMonday = LocalDate.now(ZoneId.systemDefault())
                .with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        LocalDate firstMonday = thisMonday.minusWeeks(weeks - 1L);

        Map<LocalDate, Long> counts = new HashMap<>();
        for (Object[] row : userRepository.countSignupsByWeek(firstMonday.atStartOfDay())) {
            counts.put(LocalDate.parse((String) row[0]), ((Number) row[1]).longValue());
        }

        List<AdminDTOs.SignupPoint> points = new ArrayList<>(weeks);
        for (int i = 0; i < weeks; i++) {
            LocalDate week = firstMonday.plusWeeks(i);
            points.add(new AdminDTOs.SignupPoint(week.toString(), counts.getOrDefault(week, 0L)));
        }
        return points;
    }

    // Step 2: status and workload

    // Projects grouped by their status (ACTIVE, COMPLETED, ARCHIVED).
    public List<AdminChartDTOs.CategoryCount> projectsByStatus() {
        @SuppressWarnings("unchecked")
        List<Object[]> rows = em.createQuery(
                        "SELECT p.status, COUNT(p) FROM Project p GROUP BY p.status ORDER BY COUNT(p) DESC")
                .getResultList();

        return rows.stream()
                .map(r -> new AdminChartDTOs.CategoryCount((String) r[0], ((Number) r[1]).longValue()))
                .toList();
    }

    public List<AdminChartDTOs.CategoryCount> usersByStatus() {
        return List.of(
            new AdminChartDTOs.CategoryCount("Active", userRepository.countByActive(true)),
            new AdminChartDTOs.CategoryCount("Inactive", userRepository.countByActive(false)));
    }

    // Tasks grouped by priority. The frontend sets the display order.
    public List<AdminChartDTOs.CategoryCount> tasksByPriority() {
        @SuppressWarnings("unchecked")
        List<Object[]> rows = em.createQuery(
                        "SELECT t.priority, COUNT(t) FROM Task t GROUP BY t.priority")
                .getResultList();

        return rows.stream()
                .map(r -> new AdminChartDTOs.CategoryCount((String) r[0], ((Number) r[1]).longValue()))
                .toList();
    }

    /*
        Completed and open tasks for the N busiest projects.
        A task is completed when its status is final. A task with no status counts as open.
    */
    public List<AdminChartDTOs.ProjectTaskBreakdown> projectBreakdown(int limit) {
        validateLimit(limit);

        @SuppressWarnings("unchecked")
        List<Object[]> rows = em.createQuery("""
                        SELECT p.id, p.name,
                               SUM(CASE WHEN s.isFinal = true THEN 1 ELSE 0 END),
                               SUM(CASE WHEN s.isFinal = true THEN 0 ELSE 1 END)
                        FROM Task t
                        JOIN t.project p
                        LEFT JOIN t.status s
                        GROUP BY p.id, p.name
                        ORDER BY COUNT(t) DESC
                        """)
                .setMaxResults(limit)
                .getResultList();

        return rows.stream()
                .map(r -> new AdminChartDTOs.ProjectTaskBreakdown(
                        (Integer) r[0],
                        (String) r[1],
                        ((Number) r[2]).longValue(),
                        ((Number) r[3]).longValue()))
                .toList();
    }

    // Open tasks per assignee, busiest first. A task with several assignees counts once for each. 
    public List<AdminChartDTOs.UserWorkload> workload(int limit) {
        validateLimit(limit);

        @SuppressWarnings("unchecked")
        List<Object[]> rows = em.createQuery("""
                        SELECT a.id, a.username, COUNT(DISTINCT t)
                        FROM Task t
                        JOIN t.assignees a
                        LEFT JOIN t.status s
                        WHERE (s IS NULL OR s.isFinal = false)
                        GROUP BY a.id, a.username
                        ORDER BY COUNT(DISTINCT t) DESC
                        """)
                .setMaxResults(limit)
                .getResultList();

        return rows.stream()
                .map(r -> new AdminChartDTOs.UserWorkload(
                        (Integer) r[0],
                        (String) r[1],
                        ((Number) r[2]).longValue()))
                .toList();
    }

    private static void validateLimit(int limit) {
        if (limit < 1 || limit > 25) {
            throw new IllegalArgumentException("limit must be between 1 and 25");
        }
    }
}