package com.teamflow.teamflow_api.controller;

import com.teamflow.teamflow_api.dto.SearchDTOs;
import com.teamflow.teamflow_api.security.CurrentUser;
import com.teamflow.teamflow_api.service.SearchService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/search")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class SearchController {

    private final SearchService searchService;

    // GET /api/search?q=text
    @GetMapping
    public SearchDTOs.Results search(
            @RequestParam(value = "q", required = false) String q,
            Authentication authentication) {
        return searchService.search(q, CurrentUser.id(authentication), CurrentUser.isSystemAdmin(authentication));
    }
}