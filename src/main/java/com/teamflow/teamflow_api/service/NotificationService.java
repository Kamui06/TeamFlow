package com.teamflow.teamflow_api.service;

import com.teamflow.teamflow_api.dto.NotificationDTO;
import com.teamflow.teamflow_api.dto.PagedResponse;
import com.teamflow.teamflow_api.entity.Comment;
import com.teamflow.teamflow_api.entity.Notification;
import com.teamflow.teamflow_api.entity.NotificationType;
import com.teamflow.teamflow_api.entity.Project;
import com.teamflow.teamflow_api.entity.ProjectMember;
import com.teamflow.teamflow_api.entity.SystemRole;
import com.teamflow.teamflow_api.entity.Task;
import com.teamflow.teamflow_api.entity.Team;
import com.teamflow.teamflow_api.entity.TeamMember;
import com.teamflow.teamflow_api.entity.User;
import com.teamflow.teamflow_api.repository.NotificationRepository;
import com.teamflow.teamflow_api.repository.ProjectMemberRepository;
import com.teamflow.teamflow_api.repository.TeamMemberRepository;
import com.teamflow.teamflow_api.repository.UserRepository;
import com.teamflow.teamflow_api.security.UserPrincipal;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
@Slf4j
public class NotificationService {

    private static final int SNIPPET_LENGTH = 120;
    private static final String QUOTED_BY = "\" by ";

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final TeamMemberRepository teamMemberRepository;

    // ================= Teams =================

    public void onTeamCreated(Team team) {
        User actor = currentActor();
        notify(userRepository.findByRole(SystemRole.ADMIN), actor, NotificationType.TEAM_CREATED,
                null, null, team,
                "New team \"" + team.getName() + "\" created by " + nameOf(actor));
    }

    public void onTeamUpdated(Team team, String oldName, String oldDescription) {
        User actor = currentActor();
        List<User> members = teamMembers(team.getId());

        if (!Objects.equals(oldName, team.getName())) {
            notify(members, actor, NotificationType.TEAM_UPDATED, null, null, team,
                    "Team \"" + oldName + "\" edited to \"" + team.getName() + QUOTED_BY + nameOf(actor));
        }
        if (!Objects.equals(oldDescription, team.getDescription())) {
            notify(members, actor, NotificationType.TEAM_UPDATED, null, null, team,
                    "Description of \"" + team.getName() + "\" edited to \""
                            + snippet(team.getDescription()) + QUOTED_BY + nameOf(actor));
        }
    }

    /** Call before the team is deleted. The link is cleared; the message keeps the name. */
    public void onTeamDeleted(Team team) {
        User actor = currentActor();
        notify(teamMembers(team.getId()), actor, NotificationType.TEAM_DELETED, null, null, null,
                "Team \"" + team.getName() + "\" deleted by " + nameOf(actor));
    }

    public void onTeamMemberAdded(Team team, User added) {
        User actor = currentActor();
        notify(plus(teamManagers(team.getId()), added), actor, NotificationType.TEAM_MEMBER_ADDED,
                null, null, team,
                nameOf(added) + " added to team \"" + team.getName() + QUOTED_BY + nameOf(actor));
    }

    public void onTeamMemberRemoved(Team team, User removed) {
        User actor = currentActor();
        notify(plus(teamManagers(team.getId()), removed), actor, NotificationType.TEAM_MEMBER_REMOVED,
                null, null, team,
                nameOf(removed) + " removed from team \"" + team.getName() + QUOTED_BY + nameOf(actor));
    }

    public void onTeamMemberRoleChanged(Team team, User member, String role) {
        User actor = currentActor();
        notify(plus(teamManagers(team.getId()), member), actor, NotificationType.TEAM_MEMBER_ROLE_CHANGED,
                null, null, team,
                nameOf(member) + "'s role in team \"" + team.getName() + "\" changed to " + role
                        + " by " + nameOf(actor));
    }

    // ================= Projects =================

    public void onProjectCreated(Project project) {
        User actor = currentActor();
        Team team = project.getTeam();
        notify(teamMembers(team.getId()), actor, NotificationType.PROJECT_CREATED,
                null, project, null,
                "New project \"" + project.getName() + "\" created for team \"" + team.getName()
                    + QUOTED_BY + nameOf(actor));
    }

    public void onProjectMemberAdded(Project project, User added, String role) {
        User actor = currentActor();
        notify(plus(projectManagers(project.getId()), added), actor, NotificationType.PROJECT_MEMBER_ADDED,
                null, project, null,
                nameOf(added) + " added as " + role + " to project \"" + project.getName()
                    + QUOTED_BY + nameOf(actor));
    }

    public void onProjectMemberRemoved(Project project, User removed) {
        User actor = currentActor();
        notify(plus(projectManagers(project.getId()), removed), actor, NotificationType.PROJECT_MEMBER_REMOVED,
                null, project, null,
                nameOf(removed) + " removed from project \"" + project.getName() + QUOTED_BY + nameOf(actor));
    }

    public void onProjectMemberRoleChanged(Project project, User member, String role) {
        User actor = currentActor();
        notify(plus(projectManagers(project.getId()), member), actor, NotificationType.PROJECT_MEMBER_ROLE_CHANGED,
                null, project, null,
                nameOf(member) + "'s role in project \"" + project.getName() + "\" changed to " + role
                        + " by " + nameOf(actor));
    }

    /** Triggered by the automatic status rule, so there is no actor to name. */
    public void onProjectCompleted(Project project) {
        notify(projectMembers(project.getId()), null, NotificationType.PROJECT_COMPLETED,
                null, project, null,
                "Project \"" + project.getName() + "\" is done");
    }

    public void onProjectArchived(Project project) {
        User actor = currentActor();
        notify(projectMembers(project.getId()), actor, NotificationType.PROJECT_ARCHIVED,
                null, project, null,
                "Project \"" + project.getName() + "\" is archived by " + nameOf(actor));
    }

    // ================= Tasks =================

    public void onTaskCreated(Task task) {
        User actor = currentActor();
        Project project = task.getProject();
        notify(projectMembers(project.getId()), actor, NotificationType.TASK_CREATED,
                task, project, null,
                "New task \"" + task.getTitle() + "\" in project \"" + project.getName()
                        + "\" created by " + nameOf(actor) + ", priority: " + task.getPriority()
                        + ", click for details");
    }

    /** Notifies only users who were not assignees before the change. */
    public void onTaskAssigned(Task task, Set<Integer> previousAssigneeIds) {
        Set<Integer> previous = previousAssigneeIds == null ? Set.of() : previousAssigneeIds;
        List<User> added = task.getAssignees().stream()
                .filter(u -> !previous.contains(u.getId()))
                .toList();
        if (added.isEmpty()) {
            return;
        }
        User actor = currentActor();
        notify(added, actor, NotificationType.TASK_ASSIGNED, task, task.getProject(), null,
                "\"" + task.getTitle() + "\" assigned to " + names(task.getAssignees())
                        + " by " + nameOf(actor));
    }

    public void onTaskStatusChanged(Task task) {
        User actor = currentActor();
        String status = task.getStatus() != null ? task.getStatus().getName() : "No status";
        notify(assigneesAndCreator(task), actor, NotificationType.TASK_STATUS_CHANGED,
                task, task.getProject(), null,
                "\"" + task.getTitle() + "\" status updated to \"" + status + QUOTED_BY + nameOf(actor));
    }

    public void onTaskPriorityChanged(Task task) {
        User actor = currentActor();
        notify(assigneesAndCreator(task), actor, NotificationType.TASK_PRIORITY_CHANGED,
                task, task.getProject(), null,
                "\"" + task.getTitle() + "\" priority updated to " + task.getPriority()
                        + " by " + nameOf(actor));
    }

    /** Call before the task is deleted. The link is cleared; the message keeps the title. */
    public void onTaskDeleted(Task task) {
        User actor = currentActor();
        notify(assigneesAndCreator(task), actor, NotificationType.TASK_DELETED,
                null, task.getProject(), null,
                "\"" + task.getTitle() + "\" in project \"" + task.getProject().getName()
                        + "\" deleted by " + nameOf(actor));
    }

    /**
     * Sends at most one due or overdue reminder per user, per task, per day.
     * Called by TaskReminderService, so there is no signed-in actor.
     */
    public void onTaskDueReminder(Task task, LocalDate today) {
        if (task.getDueDate() == null) {
            return;
        }
        long days = ChronoUnit.DAYS.between(today, task.getDueDate());

        NotificationType type;
        String phrase;
        if (days < 0) {
            type = NotificationType.TASK_OVERDUE;
            phrase = "is overdue by " + (-days) + (days == -1 ? " day" : " days");
        } else if (days <= 3) {
            type = NotificationType.TASK_DUE_SOON;
            phrase = switch ((int) days) {
                case 0 -> "due today";
                case 1 -> "due tomorrow";
                default -> "due in " + days + " days";
            };
        } else {
            return;
        }

        String message = "\"" + task.getTitle() + "\" " + phrase;
        LocalDateTime startOfDay = today.atStartOfDay();
        List<User> recipients = task.getAssignees().isEmpty() && task.getCreatedBy() != null
                ? List.of(task.getCreatedBy())
                : new ArrayList<>(task.getAssignees());

        for (User user : recipients) {
            boolean alreadySent = notificationRepository.existsByUserIdAndTaskIdAndTypeAndCreatedAtAfter(
                    user.getId(), task.getId(), type, startOfDay);
            if (!alreadySent) {
                notificationRepository.save(build(user, null, type, task, task.getProject(), null, message));
            }
        }
    }

    // ================= Comments =================

    public void onCommentPosted(Comment comment) {
        User author = comment.getAuthor();
        String snippet = snippet(comment.getContent());

        switch (comment.getScope()) {
            case GLOBAL -> {
                // Global comments don't notify, so every user isn't notified.
            }
            case TASK -> {
                Task task = comment.getTask();
                notify(assigneesAndCreator(task), author, NotificationType.TASK_COMMENT,
                        task, task.getProject(), null,
                        author.getUsername() + " commented on \"" + task.getTitle() + "\": " + snippet);
            }
            case PROJECT -> {
                Project project = comment.getProject();
                notify(projectMembers(project.getId()), author, NotificationType.PROJECT_COMMENT,
                        null, project, null,
                        author.getUsername() + " commented in " + project.getName() + ": " + snippet);
            }
            case TEAM -> {
                Team team = comment.getTeam();
                notify(teamMembers(team.getId()), author, NotificationType.TEAM_COMMENT,
                        null, null, team,
                        author.getUsername() + " commented in " + team.getName() + ": " + snippet);
            }
        }
    }

    // ================= Reads and actions for the signed-in user =================

    @Transactional(readOnly = true)
    public PagedResponse<NotificationDTO> list(Integer userId, boolean unreadOnly, int page, int size) {
        if (size < 1 || size > 100) {
            throw new IllegalArgumentException("size must be between 1 and 100");
        }
        PageRequest request = PageRequest.of(Math.max(page, 0), size);
        Page<Notification> result = unreadOnly
                ? notificationRepository.findByUserIdAndReadAtIsNullOrderByCreatedAtDesc(userId, request)
                : notificationRepository.findByUserIdOrderByCreatedAtDesc(userId, request);

        return new PagedResponse<>(
                result.map(this::toDto).getContent(),
                result.getNumber(),
                result.getSize(),
                result.getTotalElements(),
                result.getTotalPages());
    }

    @Transactional(readOnly = true)
    public long unreadCount(Integer userId) {
        return notificationRepository.countUnreadByUserId(userId);
    }

    public void markRead(Integer notificationId, Integer userId) {
        Notification n = owned(notificationId, userId);
        if (n.getReadAt() == null) {
            n.setReadAt(LocalDateTime.now(ZoneId.systemDefault()));
        }
    }

    public void markAllRead(Integer userId) {
        LocalDateTime now = LocalDateTime.now(ZoneId.systemDefault());
        notificationRepository.findByUserIdAndReadAtIsNull(userId).forEach(n -> n.setReadAt(now));
    }

    public void delete(Integer notificationId, Integer userId) {
        notificationRepository.delete(owned(notificationId, userId));
    }

    public int clearRead(Integer userId) {
        return notificationRepository.deleteReadForUser(userId);
    }

    // ================= Helpers =================

    /** Sends to each recipient once, skipping null entries and the actor who caused the change. */
    private void notify(Collection<User> recipients, User actor, NotificationType type,
                        Task task, Project project, Team team, String message) {
        Set<Integer> seen = new HashSet<>();
        for (User recipient : recipients) {
            if (recipient != null && seen.add(recipient.getId())
                    && (actor == null || !recipient.getId().equals(actor.getId()))) {
                notificationRepository.save(build(recipient, actor, type, task, project, team, message));
            }
        }
    }

    private static Notification build(User recipient, User actor, NotificationType type,
                                      Task task, Project project, Team team, String message) {
        return Notification.builder()
                .user(recipient)
                .actor(actor)
                .type(type)
                .task(task)
                .project(project)
                .team(team)
                .message(message)
                .build();
    }

    private List<User> teamMembers(Integer teamId) {
        return teamMemberRepository.findByIdTeamId(teamId).stream()
                .map(TeamMember::getUser)
                .toList();
    }

    private List<User> teamManagers(Integer teamId) {
        return teamMemberRepository.findByIdTeamId(teamId).stream()
                .filter(m -> "OWNER".equals(m.getRole()) || "ADMIN".equals(m.getRole()))
                .map(TeamMember::getUser)
                .toList();
    }

    private List<User> projectMembers(Integer projectId) {
        return projectMemberRepository.findByIdProjectId(projectId).stream()
                .map(ProjectMember::getUser)
                .toList();
    }

    private List<User> projectManagers(Integer projectId) {
        return projectMemberRepository.findByIdProjectId(projectId).stream()
                .filter(m -> "MANAGER".equals(m.getRole()))
                .map(ProjectMember::getUser)
                .toList();
    }

    /** Assignees plus the creator, without duplicates. */
    private static List<User> assigneesAndCreator(Task task) {
        Map<Integer, User> recipients = new LinkedHashMap<>();
        task.getAssignees().forEach(u -> recipients.put(u.getId(), u));
        if (task.getCreatedBy() != null) {
            recipients.putIfAbsent(task.getCreatedBy().getId(), task.getCreatedBy());
        }
        return new ArrayList<>(recipients.values());
    }

    private static List<User> plus(List<User> list, User extra) {
        List<User> result = new ArrayList<>(list);
        result.add(extra);
        return result;
    }

    private static String names(Collection<User> users) {
        return users.stream()
                .map(User::getUsername)
                .sorted()
                .collect(Collectors.joining(", "));
    }

    private static String nameOf(User user) {
        return user == null ? "the system" : user.getUsername();
    }

    private Notification owned(Integer notificationId, Integer userId) {
        Notification n = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new IllegalArgumentException("Notification not found"));
        // The same answer for "not yours" and "does not exist", so ids can't be probed.
        if (!n.getUser().getId().equals(userId)) {
            throw new IllegalArgumentException("Notification not found");
        }
        return n;
    }

    private NotificationDTO toDto(Notification n) {
        return new NotificationDTO(
                n.getId(),
                n.getType().name(),
                n.getMessage(),
                n.getActor() != null ? n.getActor().getUsername() : null,
                linkFor(n),
                n.getReadAt() != null,
                n.getCreatedAt());
    }

    private static String linkFor(Notification n) {
        if (n.getTask() != null) {
            return "/tasks/" + n.getTask().getId();
        }
        if (n.getProject() != null) {
            return "/projects/" + n.getProject().getId();
        }
        if (n.getTeam() != null) {
            return "/teams";
        }
        return "/dashboard";
    }

    /** The signed-in user who caused the change, or null for system events. */
    private User currentActor() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserPrincipal principal) {
            return userRepository.findById(principal.getId()).orElse(null);
        }
        return null;
    }

    private static String snippet(String text) {
        if (text == null) {
            return "";
        }
        String oneLine = text.replaceAll("\\s+", " ").trim();
        return oneLine.length() > SNIPPET_LENGTH ? oneLine.substring(0, SNIPPET_LENGTH - 1) + "…" : oneLine;
    }
}