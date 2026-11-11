package com.teamflow.teamflow_api.dto;

import java.time.LocalDateTime;
import java.util.List;

public record CommentDTO(
        Integer id,
        String scope,
        Integer targetId,
        String targetName,
        Integer authorId,
        String authorUsername,
        String content,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        boolean canEdit,
        boolean canDelete) {

    // A comment list plus whether the caller may post to it. 
    public record Thread(boolean canPost, List<CommentDTO> comments) {
    }
}