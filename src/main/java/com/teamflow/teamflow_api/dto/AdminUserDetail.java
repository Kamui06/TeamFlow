package com.teamflow.teamflow_api.dto;

import java.util.List;

public record AdminUserDetail(AdminUserRow user, List<Membership> teams, List<Membership> projects) {

    public record Membership(Integer id, String name, String role) {
    }
}