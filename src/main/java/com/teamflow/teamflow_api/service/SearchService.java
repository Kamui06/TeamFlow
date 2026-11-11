package com.teamflow.teamflow_api.service;

import com.teamflow.teamflow_api.dto.SearchDTOs;
import com.teamflow.teamflow_api.entity.Project;
import com.teamflow.teamflow_api.entity.Task;
import com.teamflow.teamflow_api.entity.Team;
import com.teamflow.teamflow_api.entity.User;
import com.teamflow.teamflow_api.repository.ProjectRepository;
import com.teamflow.teamflow_api.repository.TaskRepository;
import com.teamflow.teamflow_api.repository.TeamMemberRepository;
import com.teamflow.teamflow_api.repository.TeamRepository;
import com.teamflow.teamflow_api.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SearchService {

    private static final int PER_SECTION = 6;
    private static final int MIN_LENGTH = 2;
    private static final int MAX_LENGTH = 80;

    private final UserRepository userRepository;
    private final ProjectRepository projectRepository;
    private final TeamRepository teamRepository;
    private final TeamMemberRepository teamMemberRepository;
    private final TaskRepository taskRepository;
    private final ProjectVisibilityService visibility;

    public SearchDTOs.Results search(String rawQuery, Integer userId, boolean systemAdmin) {
        String query = rawQuery == null ? "" : rawQuery.trim();
        if (query.length() < MIN_LENGTH) {
            return new SearchDTOs.Results(query, List.of());
        }
        if (query.length() > MAX_LENGTH) {
            throw new IllegalArgumentException("Search text must be " + MAX_LENGTH + " characters or fewer");
        }
        String needle = query.toLowerCase(Locale.ROOT);

        Set<Integer> visibleProjectIds = visibility.visibleProjectIds(userId, systemAdmin);
        Set<Integer> myTeamIds = teamMemberRepository.findByIdUserId(userId).stream()
                .map(m -> m.getTeam().getId())
                .collect(Collectors.toSet());

        return new SearchDTOs.Results(query, List.of(
                users(needle),
                projects(needle, visibleProjectIds),
                teams(needle, myTeamIds, systemAdmin),
                tasks(needle, visibleProjectIds)));
    }

    private SearchDTOs.Section users(String needle) {
        List<SearchDTOs.Hit> hits = userRepository.findAll().stream()
                .filter(u -> matches(needle, u.getUsername(), u.getFirstName(), u.getLastName()))
                .sorted(Comparator.comparing(User::getUsername, String.CASE_INSENSITIVE_ORDER))
                .limit(PER_SECTION)
                .map(u -> new SearchDTOs.Hit(
                        u.getId(),
                        u.getUsername(),
                        fullName(u),
                        "/users/" + u.getId()))
                .toList();
        return new SearchDTOs.Section("users", "Users", hits);
    }

    private SearchDTOs.Section projects(String needle, Set<Integer> visibleProjectIds) {
        if (visibleProjectIds.isEmpty()) {
            return new SearchDTOs.Section("projects", "Projects", List.of());
        }
        List<SearchDTOs.Hit> hits = projectRepository.findAll().stream()
                .filter(p -> visibleProjectIds.contains(p.getId()))
                .filter(p -> matches(needle, p.getName()))
                .sorted(Comparator.comparing(Project::getName, String.CASE_INSENSITIVE_ORDER))
                .limit(PER_SECTION)
                .map(p -> new SearchDTOs.Hit(
                        p.getId(),
                        p.getName(),
                        p.getTeam().getName() + " · " + p.getStatus(),
                        "/projects/" + p.getId()))
                .toList();
        return new SearchDTOs.Section("projects", "Projects", hits);
    }

    private SearchDTOs.Section teams(String needle, Set<Integer> myTeamIds, boolean systemAdmin) {
        List<SearchDTOs.Hit> hits = teamRepository.findAll().stream()
                .filter(t -> systemAdmin || myTeamIds.contains(t.getId()))
                .filter(t -> matches(needle, t.getName()))
                .sorted(Comparator.comparing(Team::getName, String.CASE_INSENSITIVE_ORDER))
                .limit(PER_SECTION)
                .map(t -> new SearchDTOs.Hit(
                        t.getId(),
                        t.getName(),
                        "Owner: " + t.getOwner().getUsername(),
                        "/teams"))
                .toList();
        return new SearchDTOs.Section("teams", "Teams", hits);
    }

    private SearchDTOs.Section tasks(String needle, Set<Integer> visibleProjectIds) {
        if (visibleProjectIds.isEmpty()) {
            return new SearchDTOs.Section("tasks", "Tasks", List.of());
        }
        List<SearchDTOs.Hit> hits = taskRepository.findByProjectIdIn(visibleProjectIds).stream()
                .filter(t -> matches(needle, t.getTitle()))
                .sorted(Comparator.comparing(Task::getTitle, String.CASE_INSENSITIVE_ORDER))
                .limit(PER_SECTION)
                .map(t -> new SearchDTOs.Hit(
                        t.getId(),
                        t.getTitle(),
                        t.getProject().getName() + (t.getStatus() != null ? " · " + t.getStatus().getName() : ""),
                        "/tasks/" + t.getId()))
                .toList();
        return new SearchDTOs.Section("tasks", "Tasks", hits);
    }

    private static boolean matches(String needle, String... fields) {
        for (String field : fields) {
            if (field != null && field.toLowerCase(Locale.ROOT).contains(needle)) {
                return true;
            }
        }
        return false;
    }

    private static String fullName(User u) {
        String name = ((u.getFirstName() == null ? "" : u.getFirstName()) + " "
                + (u.getLastName() == null ? "" : u.getLastName())).trim();
        return name.isEmpty() ? "@" + u.getUsername() : name;
    }
}