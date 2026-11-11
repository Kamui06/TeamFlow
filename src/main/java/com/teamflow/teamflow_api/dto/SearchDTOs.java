package com.teamflow.teamflow_api.dto;

import java.util.List;

public final class SearchDTOs {

    private SearchDTOs() {
    }

    public record Hit(Integer id, String title, String subtitle, String link) {
    }

    public record Section(String key, String label, List<Hit> items) {
    }

    public record Results(String query, List<Section> sections) {
    }
}