package com.teamflow.teamflow_api.service;

import com.teamflow.teamflow_api.dto.ProfileDTOs;
import com.teamflow.teamflow_api.entity.Comment;
import com.teamflow.teamflow_api.entity.Project;
import com.teamflow.teamflow_api.entity.Task;
import com.teamflow.teamflow_api.entity.User;
import com.teamflow.teamflow_api.repository.CommentRepository;
import com.teamflow.teamflow_api.repository.ProjectMemberRepository;
import com.teamflow.teamflow_api.repository.TaskRepository;
import com.teamflow.teamflow_api.repository.TeamMemberRepository;
import com.teamflow.teamflow_api.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class ProfileService {

    private static final Pattern USERNAME = Pattern.compile("^[A-Za-z0-9._-]{3,50}$");
    private static final Pattern EMAIL = Pattern.compile("^[^\\s@]++@[^\\s@.]++(?:\\.[^\\s@.]++)++$");
    private static final int UPCOMING_DAYS = 14;
        private static final String PROJECT_LINK_PREFIX = "/projects/";
        private static final String TASK_LINK_PREFIX = "/tasks/";

    private final UserRepository userRepository;
    private final TeamMemberRepository teamMemberRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final ProjectVisibilityService visibility;
    private final TaskRepository taskRepository;
    private final CommentRepository commentRepository;

    // ---------- Own profile ----------

    @Transactional(readOnly = true)
    public ProfileDTOs.Profile profile(Integer userId) {
        return toProfile(find(userId));
    }

    public ProfileDTOs.Profile update(Integer userId, ProfileDTOs.UpdateRequest req) {
        User user = find(userId);

        String username = required(req.username(), "Username", 3, 50);
        if (!USERNAME.matcher(username).matches()) {
            throw new IllegalArgumentException(
                    "Username can contain only letters, numbers, dots, dashes and underscores");
        }
        if (!username.equals(user.getUsername())
                && userRepository.findByUsername(username).filter(u -> !u.getId().equals(userId)).isPresent()) {
            throw new IllegalArgumentException("That username is already taken");
        }

        String email = required(req.email(), "Email", 3, 100);
        if (!EMAIL.matcher(email).matches()) {
            throw new IllegalArgumentException("Enter a valid email address");
        }
        if (!email.equalsIgnoreCase(user.getEmail())
                && userRepository.findByEmail(email).filter(u -> !u.getId().equals(userId)).isPresent()) {
            throw new IllegalArgumentException("That email is already in use");
        }

        user.setUsername(username);
        user.setEmail(email);
        user.setFirstName(optional(req.firstName(), 100, "First name"));
        user.setLastName(optional(req.lastName(), 100, "Last name"));
        user.setBio(optional(req.bio(), 500, "Bio"));
        userRepository.save(user);

        return toProfile(user);
    }

    // ---------- Public profile (what the viewer is allowed to see) ----------

    @Transactional(readOnly = true)
    public ProfileDTOs.PublicProfile publicProfile(Integer userId, Integer viewerId, boolean viewerIsAdmin) {
        User u = find(userId);
        ProfileDTOs.Profile full = toProfile(u);

        Set<Integer> viewable = visibility.visibleProjectIds(viewerId, viewerIsAdmin);
        LocalDate today = today();

        // Only tasks in projects the viewer can see are shown or counted.
        List<Task> tasks = taskRepository.findAssignedTo(userId).stream()
                .filter(t -> viewable.contains(t.getProject().getId()))
                .toList();

        long completed = tasks.stream().filter(ProfileService::isDone).count();
        long overdue = tasks.stream()
                .filter(t -> !isDone(t) && t.getDueDate() != null && t.getDueDate().isBefore(today))
                .count();

        List<ProfileDTOs.TaskItem> recentlyCompleted = tasks.stream()
                .filter(ProfileService::isDone)
                .sorted(Comparator.comparing(Task::getUpdatedAt,
                        Comparator.nullsLast(Comparator.<LocalDateTime>reverseOrder())))
                .limit(5)
                .map(ProfileService::item)
                .toList();

        List<ProfileDTOs.TaskItem> upcoming = tasks.stream()
                .filter(t -> !isDone(t) && t.getDueDate() != null
                        && !t.getDueDate().isAfter(today.plusDays(UPCOMING_DAYS)))
                .sorted(Comparator.comparing(Task::getDueDate))
                .limit(8)
                .map(ProfileService::item)
                .toList();

        List<ProfileDTOs.TaskItem> assignedTasks = tasks.stream()
                .sorted(Comparator.comparing(Task::getDueDate,
                        Comparator.nullsLast(Comparator.<LocalDate>naturalOrder())))
                .map(ProfileService::item)
                .toList();

        // Filter first, then limit, so hidden items don't reduce the visible count.
        List<ProfileDTOs.ActivityItem> activity = allActivity(userId).stream()
                .filter(a -> a.link() == null || isVisibleLink(a.link(), viewable))
                .limit(10)
                .toList();

        List<ProfileDTOs.ProjectItem> projects = projectMemberRepository.findByIdUserId(userId).stream()
                .filter(pm -> viewable.contains(pm.getProject().getId()))
                .map(pm -> {
                    Project p = pm.getProject();
                    List<Task> mine = tasks.stream()
                            .filter(t -> t.getProject().getId().equals(p.getId()))
                            .toList();
                    return new ProfileDTOs.ProjectItem(
                            p.getId(),
                            p.getName(),
                            p.getTeam().getName(),
                            p.getStatus(),
                            pm.getRole(),
                            mine.size(),
                            mine.stream().filter(ProfileService::isDone).count());
                })
                .sorted(Comparator.comparing(ProfileDTOs.ProjectItem::name, String.CASE_INSENSITIVE_ORDER))
                .toList();

        return new ProfileDTOs.PublicProfile(
                full.id(),
                full.username(),
                full.firstName(),
                full.lastName(),
                full.bio(),
                full.role(),
                full.joinedAt(),
                full.teams(),
                ProfileDTOs.Counts.of(completed, tasks.size()),
                projects.size(),
                overdue,
                recentlyCompleted,
                upcoming,
                activity,
                projects,
                assignedTasks);
    }

    /** Links look like /tasks/{id} or /projects/{id}. Team and dashboard links are always allowed. */
    private boolean isVisibleLink(String link, Set<Integer> viewableProjects) {
                if (link.startsWith(PROJECT_LINK_PREFIX)) {
                        return viewableProjects.contains(parseId(link.substring(PROJECT_LINK_PREFIX.length())));
        }
                if (link.startsWith(TASK_LINK_PREFIX)) {
                        return taskRepository.findById(parseId(link.substring(TASK_LINK_PREFIX.length())))
                    .map(t -> viewableProjects.contains(t.getProject().getId()))
                    .orElse(false);
        }
        return true;
    }

    private static Integer parseId(String text) {
        try {
            return Integer.valueOf(text);
        } catch (NumberFormatException _) {
            return -1;
        }
    }

    // ---------- Overview (own profile) ----------

    @Transactional(readOnly = true)
    public ProfileDTOs.Overview overview(Integer userId) {
        LocalDate today = today();
        List<Task> tasks = taskRepository.findAssignedTo(userId);

        long completed = tasks.stream().filter(ProfileService::isDone).count();
        long overdue = tasks.stream()
                .filter(t -> !isDone(t) && t.getDueDate() != null && t.getDueDate().isBefore(today))
                .count();

        List<ProfileDTOs.TaskItem> recentlyCompleted = tasks.stream()
                .filter(ProfileService::isDone)
                .sorted(Comparator.comparing(Task::getUpdatedAt,
                        Comparator.nullsLast(Comparator.<LocalDateTime>reverseOrder())))
                .limit(5)
                .map(ProfileService::item)
                .toList();

        List<ProfileDTOs.TaskItem> upcoming = tasks.stream()
                .filter(t -> !isDone(t) && t.getDueDate() != null
                        && !t.getDueDate().isAfter(today.plusDays(UPCOMING_DAYS)))
                .sorted(Comparator.comparing(Task::getDueDate))
                .limit(8)
                .map(ProfileService::item)
                .toList();

        return new ProfileDTOs.Overview(
                projectMemberRepository.findByIdUserId(userId).size(),
                ProfileDTOs.Counts.of(completed, tasks.size()),
                overdue,
                recentlyCompleted,
                upcoming,
                allActivity(userId).stream().limit(10).toList());
    }

    /** Everything the user created or commented on, newest first. Callers apply their own limits. */
    private List<ProfileDTOs.ActivityItem> allActivity(Integer userId) {
        List<ProfileDTOs.ActivityItem> items = new ArrayList<>();

        taskRepository.findByCreatedById(userId).forEach(t -> items.add(new ProfileDTOs.ActivityItem(
                "Created task \"" + t.getTitle() + "\" in " + t.getProject().getName(),
                TASK_LINK_PREFIX + t.getId(),
                t.getCreatedAt())));

        commentRepository.findByAuthorId(userId).forEach(c -> items.add(new ProfileDTOs.ActivityItem(
                "Commented on " + commentTarget(c),
                commentLink(c),
                c.getCreatedAt())));

        return items.stream()
                .sorted(Comparator.comparing(ProfileDTOs.ActivityItem::at,
                        Comparator.nullsLast(Comparator.<LocalDateTime>reverseOrder())))
                .toList();
    }

    // ---------- Assignments (own profile) ----------

    @Transactional(readOnly = true)
    public ProfileDTOs.Assignments assignments(Integer userId) {
        List<Task> tasks = taskRepository.findAssignedTo(userId);

        Map<Integer, List<Task>> byProject = tasks.stream()
                .collect(Collectors.groupingBy(t -> t.getProject().getId()));

        List<ProfileDTOs.ProjectItem> projects = projectMemberRepository.findByIdUserId(userId).stream()
                .map(pm -> {
                    Project p = pm.getProject();
                    List<Task> mine = byProject.getOrDefault(p.getId(), List.of());
                    return new ProfileDTOs.ProjectItem(
                            p.getId(),
                            p.getName(),
                            p.getTeam().getName(),
                            p.getStatus(),
                            pm.getRole(),
                            mine.size(),
                            mine.stream().filter(ProfileService::isDone).count());
                })
                .sorted(Comparator.comparing(ProfileDTOs.ProjectItem::name, String.CASE_INSENSITIVE_ORDER))
                .toList();

        List<ProfileDTOs.TaskItem> taskItems = tasks.stream()
                .sorted(Comparator.comparing(Task::getDueDate,
                        Comparator.nullsLast(Comparator.<LocalDate>naturalOrder())))
                .map(ProfileService::item)
                .toList();

        return new ProfileDTOs.Assignments(projects, taskItems);
    }

    // ---------- Helpers ----------

    private User find(Integer userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
    }

    private ProfileDTOs.Profile toProfile(User u) {
        List<ProfileDTOs.TeamRef> teams = teamMemberRepository.findByIdUserId(u.getId()).stream()
                .map(m -> new ProfileDTOs.TeamRef(m.getTeam().getId(), m.getTeam().getName(), m.getRole()))
                .sorted(Comparator.comparing(ProfileDTOs.TeamRef::name, String.CASE_INSENSITIVE_ORDER))
                .toList();

        return new ProfileDTOs.Profile(
                u.getId(),
                u.getUsername(),
                u.getEmail(),
                u.getFirstName(),
                u.getLastName(),
                u.getBio(),
                u.getRole().name(),
                u.getCreatedAt(),
                teams);
    }

    private static LocalDate today() {
        return LocalDate.now(ZoneId.systemDefault());
    }

    private static boolean isDone(Task t) {
        return t.getStatus() != null && Boolean.TRUE.equals(t.getStatus().getIsFinal());
    }

    private static ProfileDTOs.TaskItem item(Task t) {
        return new ProfileDTOs.TaskItem(
                t.getId(),
                t.getTitle(),
                t.getProject().getId(),
                t.getProject().getName(),
                t.getStatus() != null ? t.getStatus().getName() : null,
                isDone(t),
                t.getPriority(),
                t.getDueDate(),
                t.getUpdatedAt());
    }

    private static String commentTarget(Comment c) {
        return switch (c.getScope()) {
            case GLOBAL -> "the workspace";
            case TASK -> "task \"" + c.getTask().getTitle() + "\"";
            case PROJECT -> "project \"" + c.getProject().getName() + "\"";
            case TEAM -> "team \"" + c.getTeam().getName() + "\"";
        };
    }

    private static String commentLink(Comment c) {
        return switch (c.getScope()) {
            case GLOBAL -> "/dashboard";
            case TASK -> TASK_LINK_PREFIX + c.getTask().getId();
            case PROJECT -> PROJECT_LINK_PREFIX + c.getProject().getId();
            case TEAM -> "/teams";
        };
    }

    private static String required(String value, String label, int min, int max) {
        String v = value == null ? "" : value.trim();
        if (v.length() < min) {
            throw new IllegalArgumentException(label + " must be at least " + min + " characters");
        }
        if (v.length() > max) {
            throw new IllegalArgumentException(label + " must be " + max + " characters or fewer");
        }
        return v;
    }

    private static String optional(String value, int max, String label) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String v = value.trim();
        if (v.length() > max) {
            throw new IllegalArgumentException(label + " must be " + max + " characters or fewer");
        }
        return v;
    }
}