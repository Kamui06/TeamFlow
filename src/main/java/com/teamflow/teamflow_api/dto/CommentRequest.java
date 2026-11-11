package com.teamflow.teamflow_api.dto;

import lombok.Data;

@Data
public class CommentRequest {
    private String scope;
    private Integer targetId;
    private String content;
}