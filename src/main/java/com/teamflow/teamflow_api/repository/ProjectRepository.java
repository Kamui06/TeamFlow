package com.teamflow.teamflow_api.repository;

import com.teamflow.teamflow_api.entity.Project;
import com.teamflow.teamflow_api.entity.Team;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface ProjectRepository extends JpaRepository<Project, Integer> {

    List<Project> findByCreatedById(Integer createdById);

    long countByCreatedById(Integer createdById);
    long countByTeamId(Integer teamId);
    long countByCreatedAtAfter(LocalDateTime since);

    @Query("SELECT COUNT(pm) FROM ProjectMember pm WHERE pm.id.projectId = :projectId")
    long countMembersByProjectId(@Param("projectId") Integer projectId);

    @Query("SELECT p FROM Project p WHERE p.team.id IN :teamIds ORDER BY p.name")
    List<Project> findByTeamIds(@Param("teamIds") Collection<Integer> teamIds);

    List<Project> findByTeam(Team team);
    List<Project> findByTeamAndStatus(Team team, String status);
    Optional<Project> findByNameAndTeam(String name, Team team);
    List<Project> findByTeamIn(List<Team> teams);
    List<Project> findByTeamIdIn(Collection<Integer> teamIds);
}