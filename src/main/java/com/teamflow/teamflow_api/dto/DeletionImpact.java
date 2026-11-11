package com.teamflow.teamflow_api.dto;

import java.util.List;

public record DeletionImpact(
        String type,
        Integer id,
        String name,
        List<Line> deleted,
        List<String> kept,
        List<String> projects) {

    public record Line(String label, long count) {
    }
}