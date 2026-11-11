import { apiFetch } from "../api/api";

export interface SearchHit {
  id: number;
  title: string;
  subtitle: string;
  link: string;
}

export interface SearchSection {
  key: "users" | "projects" | "teams" | "tasks";
  label: string;
  items: SearchHit[];
}

export interface SearchResults {
  query: string;
  sections: SearchSection[];
}

export const searchService = {
  search: (q: string, signal?: AbortSignal) =>
    apiFetch<SearchResults>(`/search?q=${encodeURIComponent(q)}`, { signal }),
};