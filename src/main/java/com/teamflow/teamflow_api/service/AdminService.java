package com.teamflow.teamflow_api.service;

import com.teamflow.teamflow_api.dto.AdminDTOs;
import com.teamflow.teamflow_api.dto.AdminUserRow;
import com.teamflow.teamflow_api.dto.PagedResponse;
import com.teamflow.teamflow_api.dto.UserDTO;

import com.teamflow.teamflow_api.entity.Project;
import com.teamflow.teamflow_api.entity.SystemRole;
import com.teamflow.teamflow_api.entity.User;
import com.teamflow.teamflow_api.entity.Team;
import com.teamflow.teamflow_api.entity.TeamMember;

import com.teamflow.teamflow_api.repository.ProjectMemberRepository;
import com.teamflow.teamflow_api.repository.ProjectRepository;
import com.teamflow.teamflow_api.repository.TaskRepository;
import com.teamflow.teamflow_api.repository.TeamMemberRepository;
import com.teamflow.teamflow_api.repository.TeamRepository;
import com.teamflow.teamflow_api.repository.UserRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;

import org.jspecify.annotations.Nullable;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
@Slf4j
public class AdminService {

    private final UserRepository userRepository;
    private final TeamRepository teamRepository;
    private final TeamMemberRepository teamMemberRepository;
    private final ProjectRepository projectRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final TaskRepository taskRepository;

    public AdminDTOs.OverviewStats overview() {
        return new AdminDTOs.OverviewStats(
                userRepository.count(),
                teamRepository.count(),
                projectRepository.count(),
                taskRepository.count());
    }

    public List<AdminDTOs.TeamRow> teams() {
        List<Team> teams = teamRepository.findAllWithOwner();
        if (teams.isEmpty()) {
            return List.of();
        }

        List<Integer> teamIds = teams.stream().map(Team::getId).toList();

        Map<Integer, List<String>> membersByTeam = new HashMap<>();
        for (TeamMember m : teamMemberRepository.findByTeamIdsWithUser(teamIds)) {
            membersByTeam
                .computeIfAbsent(m.getTeam().getId(), k -> new ArrayList<>())
                .add(m.getUser().getUsername());
        }

        Map<Integer, List<String>> projectsByTeam = new HashMap<>();
        for (Project p : projectRepository.findByTeamIds(teamIds)) {
            projectsByTeam
                .computeIfAbsent(p.getTeam().getId(), k -> new ArrayList<>())
                .add(p.getName());
        }

        return teams.stream()
            .map(team -> {
                List<String> members = membersByTeam.getOrDefault(team.getId(), List.of());
                List<String> projects = projectsByTeam.getOrDefault(team.getId(), List.of());
                return new AdminDTOs.TeamRow(
                        team.getId(),
                        team.getName(),
                        team.getOwner().getUsername(),
                        members.size(),
                        projects.size(),
                        members,
                        projects);
            })
        .toList();
    }

    public List<AdminDTOs.ProjectRow> projects() {
        return projectRepository.findAll().stream()
                .map(p -> new AdminDTOs.ProjectRow(
                        p.getId(),
                        p.getName(),
                        p.getTeam().getId(),
                        p.getTeam().getName(),
                        p.getStatus(),
                        projectMemberRepository.findByIdProjectId(p.getId()).size(),
                        taskRepository.countByProjectId(p.getId()),
                        p.getCreatedBy().getUsername()))
                .toList();
    }

    @Transactional
    public UserDTO setActive(Integer targetId, boolean active, Integer callerId) {
        if (!active && targetId.equals(callerId)) {
            throw new IllegalArgumentException("You cannot deactivate your own account");
        }
        User user = userRepository.findById(targetId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        user.setIsActive(active);
        log.info("Set user {} active={} by admin {}", targetId, active, callerId);
        return UserDTO.from(userRepository.save(user));
    }

    public PagedResponse<AdminUserRow> searchUsers(String q, String role, String status, int page, int size) {
        if (size < 1 || size > 100) {
            throw new IllegalArgumentException("size must be between 1 and 100");
        }
        Page<User> result = userRepository.findAll(
                UserSearchSpec.matching(q, parseRole(role), parseStatus(status)),
                PageRequest.of(Math.max(page, 0), size, Sort.by("username").ascending()));

        return new PagedResponse<>(
                result.getContent().stream().map(AdminUserRow::from).toList(),
                result.getNumber(),
                result.getSize(),
                result.getTotalElements(),
                result.getTotalPages());
    }

    private static SystemRole parseRole(String value) {
        if (value == null || value.isBlank() || "ALL".equalsIgnoreCase(value)) {
            return null;
        }
        return SystemRole.valueOf(value.trim().toUpperCase(Locale.ROOT));
    }

    @Nullable
    private static Boolean parseStatus(String value) {
        if (value == null || value.isBlank() || "ALL".equalsIgnoreCase(value)) {
            return null;
        }
        return switch (value.trim().toUpperCase(Locale.ROOT)) {
            case "ACTIVE" -> Boolean.TRUE;
            case "INACTIVE" -> Boolean.FALSE;
            default -> throw new IllegalArgumentException("status must be ALL, ACTIVE, or INACTIVE");
        };
    }
}