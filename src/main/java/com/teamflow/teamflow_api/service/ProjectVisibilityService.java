package com.teamflow.teamflow_api.service;

import com.teamflow.teamflow_api.entity.Project;
import com.teamflow.teamflow_api.entity.TeamMember;
import com.teamflow.teamflow_api.entity.TeamRole;
import com.teamflow.teamflow_api.repository.ProjectMemberRepository;
import com.teamflow.teamflow_api.repository.ProjectRepository;
import com.teamflow.teamflow_api.repository.TeamMemberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Decides which projects a user can see.
 * - System admins: every project.
 * - Team OWNER/ADMIN: every project in their team.
 * - Everyone else: projects they are a project member of, only while they still belong to that team.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ProjectVisibilityService {

    private final ProjectRepository projectRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final TeamMemberRepository teamMemberRepository;

    public List<Project> visibleProjects(Integer userId, boolean systemAdmin) {
        if (systemAdmin) {
            return projectRepository.findAll();
        }

        List<TeamMember> teamMemberships = teamMemberRepository.findByIdUserId(userId);

        Set<Integer> memberTeamIds = teamMemberships.stream()
                .map(m -> m.getTeam().getId())
                .collect(Collectors.toSet());
        if (memberTeamIds.isEmpty()) {
            return List.of();
        }

        Set<Integer> managedTeamIds = teamMemberships.stream()
                .filter(m -> TeamRole.valueOf(m.getRole()).atLeast(TeamRole.ADMIN))
                .map(m -> m.getTeam().getId())
                .collect(Collectors.toSet());

        Set<Integer> projectIds = projectMemberRepository.findByIdUserId(userId).stream()
                .map(pm -> pm.getId().getProjectId())
                .collect(Collectors.toSet());

        Map<Integer, Project> visible = new LinkedHashMap<>();
        projectRepository.findAllById(projectIds).forEach(p -> visible.put(p.getId(), p));

        if (!managedTeamIds.isEmpty()) {
            projectRepository.findByTeamIdIn(managedTeamIds).forEach(p -> visible.put(p.getId(), p));
        }

        // Drop projects whose team membership has since been removed.
        return visible.values().stream()
                .filter(p -> memberTeamIds.contains(p.getTeam().getId()))
                .toList();
    }

    public Set<Integer> visibleProjectIds(Integer userId, boolean systemAdmin) {
        return visibleProjects(userId, systemAdmin).stream()
                .map(Project::getId)
                .collect(Collectors.toSet());
    }
}