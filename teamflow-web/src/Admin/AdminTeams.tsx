import { memo, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch, isAbortError } from "../api/api";
import "./AdminTeams.css";

interface TeamRow {
  id: number;
  name: string;
  ownerUsername: string;
  memberCount: number;
  projectCount: number;
  memberNames: string[];
  projectNames: string[];
}

type SearchBy = "team" | "project" | "owner" | "member";

const SEARCH_OPTIONS: { key: SearchBy; label: string; placeholder: string }[] = [
  { key: "team", label: "Team name", placeholder: "Search by team name…" },
  { key: "project", label: "Project name", placeholder: "Search by project name…" },
  { key: "owner", label: "Owner name", placeholder: "Search by owner name…" },
  { key: "member", label: "Member name", placeholder: "Search by member name…" },
];

const TONES = ["atm-tone-blue", "atm-tone-purple", "atm-tone-green", "atm-tone-orange"];
const toneFor = (seed: number) => TONES[Math.abs(seed) % TONES.length];
const initial = (text: string) => text.trim().charAt(0).toUpperCase() || "?";

function matchesTeam(team: TeamRow, by: SearchBy, q: string): boolean {
  if (!q) return true;
  const hit = (value: string) => value.toLowerCase().includes(q);

  switch (by) {
    case "team":
      return hit(team.name);
    case "owner":
      return hit(team.ownerUsername);
    case "project":
      return team.projectNames.some(hit);
    case "member":
      return team.memberNames.some(hit);
  }
}

/** A count button that opens its own name list. Inline on phones, a popover on desktop. */
function CountDropdown({
  label,
  count,
  names,
  emptyText,
}: Readonly<{ label: string; count: number; names: string[]; emptyText: string }>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="atm-dropdown" ref={ref}>
      <button
        type="button"
        className="atm-count"
        aria-expanded={open}
        aria-label={`${count} ${label.toLowerCase()}`}
        onClick={() => setOpen((o) => !o)}
      >
        <strong>{count}</strong>
        <span className="atm-caret" aria-hidden="true">
          {open ? "▴" : "▾"}
        </span>
      </button>

      {open && (
        <div className="atm-menu">
          <div className="atm-menu-head">
            {label} · {count}
          </div>
          {names.length === 0 ? (
            <p className="atm-menu-empty">{emptyText}</p>
          ) : (
            <ul>
              {names.map((name, i) => (
                <li key={`${name}-${i}`}>{name}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone = "" }: Readonly<{ label: string; value: number; tone?: string }>) {
  return (
    <div className={`atm-stat ${tone}`}>
      <span className="atm-stat-label">{label}</span>
      <strong className="atm-stat-value">{value.toLocaleString()}</strong>
    </div>
  );
}

const TeamItem = memo(function TeamItem({ team: t }: Readonly<{ team: TeamRow }>) {
  return (
    <li className="atm-row">
      <div className="atm-cell atm-team">
        <span className={`atm-avatar ${toneFor(t.id)}`} aria-hidden="true">
          {initial(t.name)}
        </span>
        <div className="atm-team-text">
          <Link to={`/admin/teams/${t.id}`} className="atm-team-name">
            {t.name}
          </Link>
          <span className="atm-team-id">Team #{t.id}</span>
        </div>
      </div>

      <div className="atm-cell atm-owner" data-label="Owner">
        <span className={`atm-avatar atm-avatar-sm ${toneFor(t.ownerUsername.length)}`} aria-hidden="true">
          {initial(t.ownerUsername)}
        </span>
        <span className="atm-owner-name">{t.ownerUsername}</span>
      </div>

      <div className="atm-cell atm-count-cell atm-members" data-label="Members">
        <CountDropdown label="Members" count={t.memberCount} names={t.memberNames} emptyText="No members in this team." />
      </div>

      <div className="atm-cell atm-count-cell atm-projects" data-label="Projects">
        <CountDropdown
          label="Projects"
          count={t.projectCount}
          names={t.projectNames}
          emptyText="This team has no projects yet."
        />
      </div>

      <div className="atm-cell atm-actions">
        <Link className="atm-delete" to={`/admin/teams/${t.id}/delete`}>
          Delete
        </Link>
      </div>
    </li>
  );
});

export default function AdminTeams() {
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [by, setBy] = useState<SearchBy>("team");
  const [search, setSearch] = useState("");

  // Typing stays responsive while the list filters behind it.
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");

    apiFetch<TeamRow[]>("/admin/teams", { signal: controller.signal })
      .then(setTeams)
      .catch((err: unknown) => {
        if (!isAbortError(err)) setError(err instanceof Error ? err.message : "Could not load teams");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, []);

  const active = SEARCH_OPTIONS.find((o) => o.key === by) ?? SEARCH_OPTIONS[0];
  const q = deferredSearch.trim().toLowerCase();

  const rows = useMemo(() => teams.filter((t) => matchesTeam(t, by, q)), [teams, by, q]);

  const totals = useMemo(
    () => ({
      teams: teams.length,
      members: teams.reduce((sum, t) => sum + t.memberCount, 0),
      projects: teams.reduce((sum, t) => sum + t.projectCount, 0),
      withoutProjects: teams.filter((t) => t.projectCount === 0).length,
    }),
    [teams]
  );

  return (
    <section className="atm-wrap">
      <div className="atm-stats">
        <Stat label="Teams" value={totals.teams} />
        <Stat label="Memberships" value={totals.members} tone="is-purple" />
        <Stat label="Projects" value={totals.projects} tone="is-green" />
        <Stat label="Without projects" value={totals.withoutProjects} tone="is-orange" />
      </div>

      <div className="atm-toolbar">
        <div className="atm-segment" role="radiogroup" aria-label="Search teams by">
          {SEARCH_OPTIONS.map((o) => (
            <button key={o.key} type="button" role="radio" aria-checked={by === o.key} onClick={() => setBy(o.key)}>
              {o.label}
            </button>
          ))}
        </div>

        <div className="atm-search">
          <span className="atm-search-icon" aria-hidden="true">
            ⌕
          </span>
          <input
            type="search"
            aria-label="Search teams"
            placeholder={active.placeholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <div className="atm-alert" role="alert">
          {error}
        </div>
      )}

      <div className="atm-card">
        <div className="atm-head" aria-hidden="true">
          <span>Team</span>
          <span>Owner</span>
          <span>Members</span>
          <span>Projects</span>
          <span>Actions</span>
        </div>

        {loading && <p className="atm-state">Loading teams…</p>}

        {!loading && rows.length === 0 && <p className="atm-state">No teams match your search.</p>}

        {!loading && rows.length > 0 && (
          <ul className="atm-list">
            {rows.map((t) => (
              <TeamItem key={t.id} team={t} />
            ))}
          </ul>
        )}

        {!loading && (
          <div className="atm-footer">
            <span>
              {rows.length} of {teams.length} teams
            </span>
            <span>Tap a count to see names</span>
          </div>
        )}
      </div>
    </section>
  );
}