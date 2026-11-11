package com.teamflow.teamflow_api.service;

import com.teamflow.teamflow_api.dto.CreateProjectRequest;
import com.teamflow.teamflow_api.dto.ProjectDTO;
import com.teamflow.teamflow_api.dto.ProjectMemberDTO;
import com.teamflow.teamflow_api.dto.UpdateProjectRequest;
import com.teamflow.teamflow_api.dto.UserSummaryDTO;
import com.teamflow.teamflow_api.entity.Project;
import com.teamflow.teamflow_api.entity.ProjectMember;
import com.teamflow.teamflow_api.entity.ProjectMemberId;
import com.teamflow.teamflow_api.entity.ProjectStatus;
import com.teamflow.teamflow_api.entity.Team;
import com.teamflow.teamflow_api.entity.TeamMemberId;
import com.teamflow.teamflow_api.entity.User;
import com.teamflow.teamflow_api.repository.ProjectMemberRepository;
import com.teamflow.teamflow_api.repository.ProjectRepository;
import com.teamflow.teamflow_api.repository.ProjectStatusRepository;
import com.teamflow.teamflow_api.repository.TaskLabelRepository;
import com.teamflow.teamflow_api.repository.TaskRepository;
import com.teamflow.teamflow_api.repository.TeamMemberRepository;
import com.teamflow.teamflow_api.repository.TeamRepository;
import com.teamflow.teamflow_api.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
@Slf4j
public class ProjectService {

    private static final String MANAGER_ROLE = "MANAGER";
    private static final String ACTIVE_STATUS = "ACTIVE";
    private static final String ARCHIVED_STATUS = "ARCHIVED";
    private static final Set<String> MEMBER_ROLES = Set.of(MANAGER_ROLE, "MEMBER", "VIEWER");

    private final ProjectRepository projectRepository;
    private final ProjectStatusRepository projectStatusRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final TeamRepository teamRepository;
    private final TeamMemberRepository teamMemberRepository;
    private final TaskRepository taskRepository;
    private final TaskLabelRepository taskLabelRepository;
    private final UserRepository userRepository;
    private final ProjectVisibilityService visibility;
    private final NotificationService notificationService;

    // ---------- Create ----------

    /** The start date is always today, set here. Any start date sent by the client is ignored. */
    public ProjectDTO createProject(CreateProjectRequest request, Integer creatorId) {
        if (request.getTeamId() == null) {
            throw new IllegalArgumentException("Team is required");
        }
        if (request.getName() == null || request.getName().isBlank()) {
            throw new IllegalArgumentException("Project name is required");
        }

        Team team = findTeam(request.getTeamId());
        User creator = findUser(creatorId);
        String name = request.getName().trim();

        if (projectRepository.findByNameAndTeam(name, team).isPresent()) {
            throw new IllegalArgumentException("A project with this name already exists in the team");
        }

        LocalDate today = LocalDate.now(ZoneId.systemDefault());
        LocalDate due = request.getEndDate();
        if (due != null && due.isBefore(today)) {
            throw new IllegalArgumentException("Due date can't be in the past");
        }

        Project project = projectRepository.save(Project.builder()
                .name(name)
                .description(request.getDescription())
                .team(team)
                .createdBy(creator)
                .status(ACTIVE_STATUS)
                .startDate(today)
                .dueDate(due)
                .build());

        seedDefaultStatuses(project);

        // The creator manages the project they create.
        projectMemberRepository.save(buildMember(project, creator, MANAGER_ROLE));
        notificationService.onProjectCreated(project);
        log.info("Created project {} in team {} by user {}", project.getId(), team.getId(), creatorId);
        return toDto(project, MANAGER_ROLE);
    }

    // ---------- Read ----------

    @Transactional(readOnly = true)
    public List<ProjectDTO> getProjectsByUser(Integer userId, boolean systemAdmin) {
        return visibility.visibleProjects(userId, systemAdmin).stream()
                .map(this::toDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<ProjectDTO> getProjectsByTeam(Integer teamId, Integer userId, boolean systemAdmin) {
        return visibility.visibleProjects(userId, systemAdmin).stream()
                .filter(p -> p.getTeam().getId().equals(teamId))
                .map(this::toDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public ProjectDTO getProject(Integer projectId) {
        return toDto(findProject(projectId));
    }

    @Transactional(readOnly = true)
    public ProjectDTO getProject(Integer projectId, String myLevel) {
        return toDto(findProject(projectId), myLevel);
    }

    // ---------- Update ----------

    /**
     * The start date is never changed after creation. The due date can be set, changed,
     * or cleared, and it can't be before the start date.
     */
    public ProjectDTO updateProject(Integer projectId, UpdateProjectRequest request) {
        Project project = findProject(projectId);

        if (ARCHIVED_STATUS.equals(project.getStatus())) {
            throw new IllegalArgumentException("Archived projects cannot be edited");
        }
        if (request.getStatus() != null) {
            throw new IllegalArgumentException(
                    "Status is managed automatically. Use Archive to archive a completed project");
        }

        if (request.getName() != null) {
            if (request.getName().isBlank()) {
                throw new IllegalArgumentException("Project name cannot be empty");
            }
            project.setName(request.getName().trim());
        }
        if (request.getDescription() != null) {
            project.setDescription(request.getDescription());
        }

        if (request.getEndDate() != null) {
            LocalDate due = request.getEndDate();
            LocalDate start = project.getStartDate();
            if (due != null && start != null && due.isBefore(start)) {
                throw new IllegalArgumentException("Due date can't be before the start date");
            }
            project.setDueDate(due);
        }

        return toDto(projectRepository.save(project));
    }

    // Manual step: only a COMPLETED project can be archived, and archiving is one-way.
    public ProjectDTO archiveProject(Integer projectId) {
        Project project = findProject(projectId);

        if (ARCHIVED_STATUS.equals(project.getStatus())) {
            throw new IllegalArgumentException("Project is already archived");
        }
        if (!"COMPLETED".equals(project.getStatus())) {
            throw new IllegalArgumentException(
                    "Only a completed project can be archived. Finish all its tasks first");
        }

        project.setStatus(ARCHIVED_STATUS);
        log.info("Archived project {}", projectId);
        notificationService.onProjectArchived(project);
        return toDto(projectRepository.save(project));
    }

    // ---------- Delete ----------

    public void deleteProject(Integer projectId) {
        Project project = findProject(projectId);

        taskLabelRepository.deleteAll(taskLabelRepository.findByProjectId(projectId));
        taskRepository.deleteAll(taskRepository.findByProjectId(projectId));
        projectStatusRepository.deleteAll(projectStatusRepository.findByProjectId(projectId));
        projectMemberRepository.deleteAll(projectMemberRepository.findByIdProjectId(projectId));
        projectRepository.flush();

        projectRepository.delete(project);
        log.info("Deleted project {}", projectId);
    }

    // ---------- Members ----------

    @Transactional(readOnly = true)
    public List<ProjectMemberDTO> getProjectMembers(Integer projectId) {
        return projectMemberRepository.findByIdProjectId(projectId).stream()
                .map(ProjectMemberDTO::from)
                .toList();
    }

    // Team members who are not yet on this project. Used by the Add member picker.
    @Transactional(readOnly = true)
    public List<UserSummaryDTO> getAddableMembers(Integer projectId) {
        Project project = findProject(projectId);

        Set<Integer> alreadyOnProject = projectMemberRepository.findByIdProjectId(projectId).stream()
                .map(pm -> pm.getId().getUserId())
                .collect(Collectors.toSet());

        return teamMemberRepository.findByIdTeamId(project.getTeam().getId()).stream()
                .filter(tm -> !alreadyOnProject.contains(tm.getId().getUserId()))
                .map(tm -> tm.getUser())
                .map(u -> new UserSummaryDTO(u.getId(), u.getUsername(), u.getFirstName(), u.getLastName()))
                .toList();
    }

    // The user must already belong to the project's team.
    public ProjectMemberDTO addProjectMember(Integer projectId, Integer userId, String roleText) {
        Project project = findProject(projectId);
        User user = findUser(userId);

        boolean inTeam = teamMemberRepository.existsById(TeamMemberId.builder()
                .teamId(project.getTeam().getId())
                .userId(userId)
                .build());
        if (!inTeam) {
            throw new IllegalArgumentException("That user must first be added to the project's team");
        }

        if (projectMemberRepository.existsById(memberId(projectId, userId))) {
            throw new IllegalArgumentException("User is already on this project");
        }

        ProjectMember saved = projectMemberRepository.save(
                buildMember(project, user, normalizeRole(roleText)));
        notificationService.onProjectMemberAdded(project, user, saved.getRole());
        return ProjectMemberDTO.from(saved);
    }

    // Removing someone also unassigns their tasks in this project.
    public void removeProjectMember(Integer projectId, Integer userId) {
        ProjectMemberId id = memberId(projectId, userId);
        if (!projectMemberRepository.existsById(id)) {
            throw new IllegalArgumentException("Member not found");
        }
        Project project = findProject(projectId);
        User user = findUser(userId);

        taskRepository.findByProjectId(projectId)
                .forEach(t -> t.getAssignees().removeIf(u -> userId.equals(u.getId())));

        projectMemberRepository.deleteById(id);
        notificationService.onProjectMemberRemoved(project, user);
    }

    // ---------- Helpers ----------

    private ProjectDTO toDto(Project project) {
        return toDto(project, null);
    }

    private ProjectDTO toDto(Project project, String myLevel) {
        Integer projectId = project.getId();
        long total = taskRepository.countByProjectId(projectId);
        long completed = taskRepository.countCompletedByProjectId(projectId);

        return ProjectDTO.builder()
                .id(projectId)
                .name(project.getName())
                .description(project.getDescription())
                .teamId(project.getTeam().getId())
                .status(project.getStatus())
                .startDate(project.getStartDate() != null ? project.getStartDate().atStartOfDay() : null)
                .endDate(project.getDueDate() != null ? project.getDueDate().atStartOfDay() : null)
                .createdAt(project.getCreatedAt())
                .updatedAt(project.getUpdatedAt())
                .createdById(project.getCreatedBy().getId())
                .createdByUsername(project.getCreatedBy().getUsername())
                .taskCount((int) total)
                .completedTaskCount((int) completed)
                .myProjectLevel(myLevel)
                .build();
    }

    private ProjectMember buildMember(Project project, User user, String role) {
        return ProjectMember.builder()
                .id(memberId(project.getId(), user.getId()))
                .project(project)
                .user(user)
                .role(role)
                .build();
    }

    private ProjectMemberId memberId(Integer projectId, Integer userId) {
        return ProjectMemberId.builder()
                .projectId(projectId)
                .userId(userId)
                .build();
    }

    private Project findProject(Integer projectId) {
        return projectRepository.findById(projectId)
                .orElseThrow(() -> new IllegalArgumentException("Project not found"));
    }

    private Team findTeam(Integer teamId) {
        return teamRepository.findById(teamId)
                .orElseThrow(() -> new IllegalArgumentException("Team not found"));
    }

    private User findUser(Integer userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
    }

    private static String normalizeRole(String value) {
        if (value == null || value.isBlank()) {
            return "MEMBER";
        }
        String normalized = value.trim().toUpperCase(Locale.ROOT);
        if (!MEMBER_ROLES.contains(normalized)) {
            throw new IllegalArgumentException("Role must be one of MANAGER, MEMBER, VIEWER");
        }
        return normalized;
    }

    private void seedDefaultStatuses(Project project) {
        record Default(String name, String code, boolean isDefault, boolean isFinal) {}

        List<Default> defaults = List.of(
                new Default("To Do", "TODO", true, false),
                new Default("In Progress", "IN_PROGRESS", false, false),
                new Default("Done", "DONE", false, true));

        for (int i = 0; i < defaults.size(); i++) {
            Default d = defaults.get(i);
            projectStatusRepository.save(ProjectStatus.builder()
                    .project(project)
                    .name(d.name())
                    .code(d.code())
                    .position(i)
                    .isDefault(d.isDefault())
                    .isFinal(d.isFinal())
                    .build());
        }
    }
}