package com.teamflow.teamflow_api.controller;

import com.teamflow.teamflow_api.dto.TeamDTO;
import com.teamflow.teamflow_api.dto.TeamMemberDTO;
import com.teamflow.teamflow_api.dto.UserSummaryDTO;
import com.teamflow.teamflow_api.entity.TeamRole;
import com.teamflow.teamflow_api.security.TeamAccess;
import com.teamflow.teamflow_api.security.UserPrincipal;
import com.teamflow.teamflow_api.service.TeamService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/teams")
@RequiredArgsConstructor
public class TeamController {

    private final TeamService teamService;
    private final TeamAccess teamAccess;

    // ---------- Teams ----------

    // GET /api/teams/my-teams
    @GetMapping("/my-teams")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<TeamDTO>> getMyTeams(Authentication authentication) {
        return ResponseEntity.ok(teamService.getTeamsForUser(getUserId(authentication)));
    }

    // POST /api/teams
    @PostMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<TeamDTO> createTeam(
            Authentication authentication,
            @RequestBody Map<String, String> request) {
        TeamDTO team = teamService.createTeam(
                request.get("name"),
                request.get("description"),
                getUserId(authentication));
        return ResponseEntity.status(HttpStatus.CREATED).body(team);
    }

    // GET /api/teams/{teamId}  (any member)
    @GetMapping("/{teamId}")
    @PreAuthorize("@teamAccess.has(authentication, #teamId, 'VIEWER')")
    public ResponseEntity<TeamDTO> getTeam(
            @PathVariable Integer teamId,
            Authentication authentication) {
        return teamService.getTeamById(teamId, callerRole(authentication, teamId))
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    // PUT /api/teams/{teamId}  (ADMIN or OWNER)
    @PutMapping("/{teamId}")
    @PreAuthorize("@teamAccess.has(authentication, #teamId, 'ADMIN')")
    public ResponseEntity<TeamDTO> updateTeam(
            @PathVariable Integer teamId,
            @RequestBody Map<String, String> updates,
            Authentication authentication) {
        return ResponseEntity.ok(teamService.updateTeam(
                teamId,
                updates.get("name"),
                updates.get("description"),
                callerRole(authentication, teamId)));
    }

    // DELETE /api/teams/{teamId}  (OWNER only)
    @DeleteMapping("/{teamId}")
    @PreAuthorize("@teamAccess.has(authentication, #teamId, 'OWNER')")
    public ResponseEntity<Void> deleteTeam(@PathVariable Integer teamId) {
        teamService.deleteTeam(teamId);
        return ResponseEntity.noContent().build();
    }

    // ---------- Members ----------

    // GET /api/teams/{teamId}/members  (any member)
    @GetMapping("/{teamId}/members")
    @PreAuthorize("@teamAccess.has(authentication, #teamId, 'VIEWER')")
    public ResponseEntity<List<TeamMemberDTO>> getTeamMembers(@PathVariable Integer teamId) {
        return ResponseEntity.ok(teamService.getTeamMembers(teamId));
    }

    // POST /api/teams/{teamId}/members  body: {"userId": 2, "role": "MEMBER"}  (ADMIN or OWNER)
    @PostMapping("/{teamId}/members")
    @PreAuthorize("@teamAccess.has(authentication, #teamId, 'ADMIN')")
    public ResponseEntity<TeamMemberDTO> addTeamMember(
            @PathVariable Integer teamId,
            @RequestBody Map<String, Object> request,
            Authentication authentication) {
        Object rawUserId = request.get("userId");
        if (rawUserId == null) {
            throw new IllegalArgumentException("userId is required");
        }
        Integer userId = ((Number) rawUserId).intValue();
        String role = (String) request.get("role");

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(teamService.addTeamMember(teamId, userId, role, callerRole(authentication, teamId)));
    }

    // PUT /api/teams/{teamId}/members/{userId}  body: {"role": "ADMIN"}  (OWNER only)
    @PutMapping("/{teamId}/members/{userId}")
    @PreAuthorize("@teamAccess.has(authentication, #teamId, 'OWNER')")
    public ResponseEntity<TeamMemberDTO> changeMemberRole(
            @PathVariable Integer teamId,
            @PathVariable Integer userId,
            @RequestBody Map<String, String> request,
            Authentication authentication) {
        return ResponseEntity.ok(teamService.changeMemberRole(
                teamId,
                userId,
                request.get("role"),
                callerRole(authentication, teamId)));
    }

    // DELETE /api/teams/{teamId}/members/{userId}  (ADMIN/OWNER, or the user leaving)
    @DeleteMapping("/{teamId}/members/{userId}")
    @PreAuthorize("@teamAccess.has(authentication, #teamId, 'ADMIN') or #userId == authentication.principal.id")
    public ResponseEntity<Void> removeTeamMember(
            @PathVariable Integer teamId,
            @PathVariable Integer userId,
            Authentication authentication) {
        teamService.removeTeamMember(teamId, userId, getUserId(authentication), callerRole(authentication, teamId));
        return ResponseEntity.noContent().build();
    }

    // ---------- Helpers ----------

    private TeamRole callerRole(Authentication authentication, Integer teamId) {
        return teamAccess.effectiveRole(authentication, teamId).orElse(null);
    }

    private Integer getUserId(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof UserPrincipal principal)) {
            throw new IllegalStateException("Authenticated user principal is missing");
        }
        return principal.getId();
    }

    // GET /api/teams/{teamId}/candidates?q=ann  (ADMIN or OWNER)
    @GetMapping("/{teamId}/candidates")
    @PreAuthorize("@teamAccess.has(authentication, #teamId, 'ADMIN')")
    public ResponseEntity<List<UserSummaryDTO>> findCandidates(
            @PathVariable Integer teamId,
            @RequestParam(defaultValue = "") String q) {
        return ResponseEntity.ok(teamService.findAddableUsers(teamId, q));
    }
}