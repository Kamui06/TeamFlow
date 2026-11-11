package com.teamflow.teamflow_api.controller;

import com.teamflow.teamflow_api.dto.ProfileDTOs;
import com.teamflow.teamflow_api.security.CurrentUser;
import com.teamflow.teamflow_api.service.ProfileService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/profile")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class ProfileController {

    private final ProfileService profileService;

    // GET /api/profile/me
    @GetMapping("/me")
    public ProfileDTOs.Profile me(Authentication authentication) {
        return profileService.profile(CurrentUser.id(authentication));
    }

    // PUT /api/profile/me  body: username, email, firstName, lastName, bio
    @PutMapping("/me")
    public ProfileDTOs.Profile update(
            @RequestBody ProfileDTOs.UpdateRequest body,
            Authentication authentication) {
        return profileService.update(CurrentUser.id(authentication), body);
    }

    // GET /api/profile/me/overview
    @GetMapping("/me/overview")
    public ProfileDTOs.Overview overview(Authentication authentication) {
        return profileService.overview(CurrentUser.id(authentication));
    }

    // GET /api/profile/users/{userId}  (any signed-in user; email is never included)
    @GetMapping("/users/{userId}")
    public ProfileDTOs.PublicProfile publicProfile(
        @PathVariable Integer userId,
        Authentication authentication) {
    return profileService.publicProfile(
        userId,
        CurrentUser.id(authentication),
        CurrentUser.isSystemAdmin(authentication));
    }

    // GET /api/profile/me/assignments
    @GetMapping("/me/assignments")
    public ProfileDTOs.Assignments assignments(Authentication authentication) {
        return profileService.assignments(CurrentUser.id(authentication));
    }
}