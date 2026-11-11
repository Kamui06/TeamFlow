package com.teamflow.teamflow_api.service;

import com.teamflow.teamflow_api.dto.AdminUserDetail;
import com.teamflow.teamflow_api.dto.AdminUserRow;
import com.teamflow.teamflow_api.dto.AdminUserUpdateRequest;
import com.teamflow.teamflow_api.entity.SystemRole;
import com.teamflow.teamflow_api.entity.Team;
import com.teamflow.teamflow_api.entity.User;
import com.teamflow.teamflow_api.repository.CommentRepository;
import com.teamflow.teamflow_api.repository.ProjectMemberRepository;
import com.teamflow.teamflow_api.repository.ProjectRepository;
import com.teamflow.teamflow_api.repository.TaskRepository;
import com.teamflow.teamflow_api.repository.TeamMemberRepository;
import com.teamflow.teamflow_api.repository.TeamRepository;
import com.teamflow.teamflow_api.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
@Transactional
@Slf4j
public class AdminUserService {

    private static final Pattern EMAIL = Pattern.compile("^[^\\s@]++@(?=[^\\s@]*\\.[^\\s@])[^\\s@]++$");
    private static final int MIN_PASSWORD = 8;

    private final UserRepository userRepository;
    private final TeamRepository teamRepository;
    private final TeamMemberRepository teamMemberRepository;
    private final ProjectRepository projectRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final TaskRepository taskRepository;
    private final PasswordEncoder passwordEncoder;
    private final RefreshTokenService refreshTokenService;
    private final CommentRepository commentRepository;

    @Transactional(readOnly = true)
    public AdminUserDetail detail(Integer userId) {
        User user = find(userId);

        List<AdminUserDetail.Membership> teams = teamMemberRepository.findByIdUserId(userId).stream()
                .map(m -> new AdminUserDetail.Membership(m.getTeam().getId(), m.getTeam().getName(), m.getRole()))
                .toList();

        List<AdminUserDetail.Membership> projects = projectMemberRepository.findByIdUserId(userId).stream()
                .map(m -> new AdminUserDetail.Membership(m.getProject().getId(), m.getProject().getName(), m.getRole()))
                .toList();

        return new AdminUserDetail(AdminUserRow.from(user), teams, projects);
    }

    /** Sends every field. A blank password leaves the current one unchanged. */
    public AdminUserRow update(Integer userId, AdminUserUpdateRequest req, Integer callerId) {
        User user = find(userId);

        String username = required(req.username(), "Username", 3, 50);
        if (!username.equals(user.getUsername())) {
            if (userRepository.findByUsername(username).filter(u -> !u.getId().equals(userId)).isPresent()) {
                throw new IllegalArgumentException("That username is already taken");
            }
            user.setUsername(username);
        }

        String email = required(req.email(), "Email", 3, 100);
        if (!EMAIL.matcher(email).matches()) {
            throw new IllegalArgumentException("Enter a valid email address");
        }
        if (!email.equalsIgnoreCase(user.getEmail())) {
            if (userRepository.findByEmail(email).filter(u -> !u.getId().equals(userId)).isPresent()) {
                throw new IllegalArgumentException("That email is already in use");
            }
            user.setEmail(email);
        }

        user.setFirstName(optional(req.firstName(), 100));
        user.setLastName(optional(req.lastName(), 100));

        boolean changingPassword = req.password() != null && !req.password().isBlank();
        if (changingPassword) {
            if (req.password().length() < MIN_PASSWORD) {
                throw new IllegalArgumentException("Password must be at least " + MIN_PASSWORD + " characters");
            }
            user.setPasswordHash(passwordEncoder.encode(req.password()));
        }

        User saved = userRepository.save(user);

        if (changingPassword) {
            // Existing sessions were opened with the old password, so they end here.
            refreshTokenService.revokeAll(userId);
            log.info("Admin {} changed the password of user {}; sessions ended", callerId, userId);
        }
        return AdminUserRow.from(saved);
    }

    public void delete(Integer targetId, Integer callerId) {
        if (targetId.equals(callerId)) {
            throw new IllegalArgumentException("You cannot delete your own account");
        }

        User user = find(targetId);
        if (user.getRole() == SystemRole.ADMIN && userRepository.countByRole(SystemRole.ADMIN) <= 1) {
            throw new IllegalArgumentException("Cannot delete the last system admin");
        }

        List<String> ownedTeams = teamRepository.findAll().stream()
                .filter(t -> t.getOwner().getId().equals(targetId))
                .map(Team::getName)
                .toList();
        if (!ownedTeams.isEmpty()) {
            throw new IllegalArgumentException("This user owns " + String.join(", ", ownedTeams)
                    + ". Delete those teams first");
        }

        // Work they created is kept and reassigned to the admin doing the deletion.
        User caller = find(callerId);
        projectRepository.findByCreatedById(targetId).forEach(p -> p.setCreatedBy(caller));
        taskRepository.findByCreatedById(targetId).forEach(t -> t.setCreatedBy(caller));

        commentRepository.findByAuthorId(targetId).forEach(c -> c.setAuthor(caller));
        
        userRepository.delete(user);
        log.info("Admin {} deleted user {}", callerId, targetId);
    }

    private User find(Integer id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
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

    private static String optional(String value, int max) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String v = value.trim();
        if (v.length() > max) {
            throw new IllegalArgumentException("Names must be " + max + " characters or fewer");
        }
        return v;
    }
}