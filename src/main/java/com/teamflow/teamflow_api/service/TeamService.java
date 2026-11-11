package com.teamflow.teamflow_api.service;

import com.teamflow.teamflow_api.dto.TeamDTO;
import com.teamflow.teamflow_api.dto.TeamMemberDTO;
import com.teamflow.teamflow_api.dto.UserSummaryDTO;
import com.teamflow.teamflow_api.entity.Team;
import com.teamflow.teamflow_api.entity.TeamMember;
import com.teamflow.teamflow_api.entity.TeamMemberId;
import com.teamflow.teamflow_api.entity.TeamRole;
import com.teamflow.teamflow_api.entity.User;
import com.teamflow.teamflow_api.repository.TeamMemberRepository;
import com.teamflow.teamflow_api.repository.TeamRepository;
import com.teamflow.teamflow_api.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Transactional
@Slf4j
public class TeamService {

    private final TeamRepository teamRepository;
    private final TeamMemberRepository teamMemberRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;

    // Teams

    public TeamDTO createTeam(String name, String description, Integer ownerId) {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("Team name is required");
        }
        User owner = findUser(ownerId);

        Team team = teamRepository.save(Team.builder()
                .name(name.trim())
                .description(description)
                .owner(owner)
                .build());

        addMembership(team, owner, TeamRole.OWNER);
        notificationService.onTeamCreated(team);
        log.info("Created team {} for user {}", team.getId(), ownerId);
        return toDto(team, TeamRole.OWNER);
    }

    @Transactional(readOnly = true)
    public Optional<TeamDTO> getTeamById(Integer teamId, TeamRole callerRole) {
        return teamRepository.findById(teamId)
                .map(team -> toDto(team, callerRole));
    }

    // Teams the user belongs to. Uses the role from the membership row, so no extra lookup. 
    @Transactional(readOnly = true)
    public List<TeamDTO> getTeamsForUser(Integer userId) {
        return teamMemberRepository.findByIdUserId(userId).stream()
                .map(m -> toDto(m.getTeam(), TeamRole.valueOf(m.getRole())))
                .toList();
    }

    public TeamDTO updateTeam(Integer teamId, String name, String description, TeamRole callerRole) {
        Team team = findTeam(teamId);
        String oldName = team.getName();
        String oldDescription = team.getDescription();

        if (name != null && !name.isBlank()) {
            team.setName(name.trim());
        }
        if (description != null) {
            team.setDescription(description);
        }

        Team saved = teamRepository.save(team);
        notificationService.onTeamUpdated(saved, oldName, oldDescription);
        return toDto(saved, callerRole);
    }

    public void deleteTeam(Integer teamId) {
        Team team = findTeam(teamId);
        // Notify before the delete, so the members are still known.
        notificationService.onTeamDeleted(team);
        teamRepository.deleteById(teamId);
    }

    // Members

    @Transactional(readOnly = true)
    public List<TeamMemberDTO> getTeamMembers(Integer teamId) {
        return teamMemberRepository.findByIdTeamId(teamId).stream()
                .map(TeamMemberDTO::from)
                .toList();
    }

    public TeamMemberDTO addTeamMember(Integer teamId, Integer userId, String roleText, TeamRole callerRole) {
        TeamRole role = roleText == null ? TeamRole.MEMBER : TeamRole.parse(roleText);

        if (role == TeamRole.OWNER) {
            throw new IllegalArgumentException("A team has one owner. Ownership cannot be assigned here.");
        }
        if (role == TeamRole.ADMIN) {
            requireAtLeast(callerRole, TeamRole.OWNER, "Only the owner can add admins");
        }

        Team team = findTeam(teamId);
        User user = findUser(userId);

        if (teamMemberRepository.existsById(memberId(teamId, userId))) {
            throw new IllegalArgumentException("User is already a member of this team");
        }

        TeamMember saved = addMembership(team, user, role);
        notificationService.onTeamMemberAdded(team, user);
        return TeamMemberDTO.from(saved);
    }

    // Owner only. Changes another member's role. 
    public TeamMemberDTO changeMemberRole(Integer teamId, Integer targetUserId, String roleText, TeamRole callerRole) {
        requireAtLeast(callerRole, TeamRole.OWNER, "Only the owner can change roles");

        TeamRole newRole = TeamRole.parse(roleText);
        if (newRole == TeamRole.OWNER) {
            throw new IllegalArgumentException("Ownership cannot be assigned here.");
        }

        TeamMember member = findMembership(teamId, targetUserId);
        if (TeamRole.valueOf(member.getRole()) == TeamRole.OWNER) {
            throw new IllegalArgumentException("The owner's role cannot be changed");
        }

        member.setRole(newRole.name());
        TeamMember saved = teamMemberRepository.save(member);
        notificationService.onTeamMemberRoleChanged(saved.getTeam(), saved.getUser(), newRole.name());
        return TeamMemberDTO.from(saved);
    }

    /*
        Removes a member. The controller already allows ADMIN/OWNER or the user removing themselves.
        This method adds the target-specific rules.
    */
    public void removeTeamMember(Integer teamId, Integer targetUserId, Integer callerId, TeamRole callerRole) {
        TeamMember target = findMembership(teamId, targetUserId);
        TeamRole targetRole = TeamRole.valueOf(target.getRole());

        if (targetRole == TeamRole.OWNER) {
            throw new IllegalArgumentException("The owner cannot be removed. Transfer ownership first.");
        }

        boolean leavingSelf = targetUserId.equals(callerId);
        if (!leavingSelf && targetRole == TeamRole.ADMIN) {
            requireAtLeast(callerRole, TeamRole.OWNER, "Only the owner can remove admins");
        }

        Team team = target.getTeam();
        User removed = target.getUser();

        teamMemberRepository.deleteById(memberId(teamId, targetUserId));
        notificationService.onTeamMemberRemoved(team, removed);
    }

    // Candidates

    // Users who are not yet in the team, matched by username. Returns at most 20. 
    @Transactional(readOnly = true)
    public List<UserSummaryDTO> findAddableUsers(Integer teamId, String query) {
        String q = query == null ? "" : query.trim();
        return userRepository.findAddableToTeam(teamId, q, PageRequest.of(0, 20)).stream()
                .map(u -> new UserSummaryDTO(u.getId(), u.getUsername(), u.getFirstName(), u.getLastName()))
                .toList();
    }

    // Helpers

    private Team findTeam(Integer teamId) {
        return teamRepository.findById(teamId)
                .orElseThrow(() -> new IllegalArgumentException("Team not found"));
    }

    private User findUser(Integer userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
    }

    private TeamMember findMembership(Integer teamId, Integer userId) {
        return teamMemberRepository.findById(memberId(teamId, userId))
                .orElseThrow(() -> new IllegalArgumentException("Member not found"));
    }

    private TeamMemberId memberId(Integer teamId, Integer userId) {
        return TeamMemberId.builder()
                .teamId(teamId)
                .userId(userId)
                .build();
    }

    private TeamMember addMembership(Team team, User user, TeamRole role) {
        TeamMember member = TeamMember.builder()
                .id(memberId(team.getId(), user.getId()))
                .team(team)
                .user(user)
                .role(role.name())
                .build();
        return teamMemberRepository.save(member);
    }

    private TeamDTO toDto(Team team, TeamRole myRole) {
        List<TeamMemberDTO> members = teamMemberRepository.findByIdTeamId(team.getId()).stream()
                .map(TeamMemberDTO::from)
                .toList();
        return TeamDTO.from(team, members, myRole == null ? null : myRole.name());
    }

    private void requireAtLeast(TeamRole callerRole, TeamRole required, String message) {
        if (callerRole == null || !callerRole.atLeast(required)) {
            throw new AccessDeniedException(message);
        }
    }
}