import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { isAbortError } from "../api/api";
import UserLink from "../Components/UserLink";
import { projectService, type Project } from "../services/ProjectService";
import { teamService, type Team } from "../services/TeamService";
import AddMemberModal from "./AddMemberModal";
import TeamCommentsModal from "./TeamCommentsModal";
import { EditTeamModal, ManageMembersModal } from "./TeamModals";
import TeamProjects from "./TeamProjects";
import NewTeamModal from "./NewTeamModal";
import "./TeamList.css";
import "./TeamModals.css";

const initialOf = (text: string) => text.trim().charAt(0).toUpperCase() || "T";

interface TeamCardProps {
  readonly team: Team;
  readonly projects: Project[];
  readonly onComment: (team: Team) => void;
  readonly onAdd: (team: Team) => void;
  readonly onEdit: (team: Team) => void;
  readonly onMembers: (team: Team) => void;
  readonly onDelete: (team: Team) => void;
}

function TeamCard({ team, projects, onComment, onAdd, onEdit, onMembers, onDelete }: TeamCardProps) {
  const canManage = team.myRole === "OWNER" || team.myRole === "ADMIN";
  const isOwner = team.myRole === "OWNER";
  const members = team.members ?? [];
  const shownMembers = members.slice(0, 8);

  const tasks = projects.reduce((sum, p) => sum + p.taskCount, 0);
  const done = projects.reduce((sum, p) => sum + p.completedTaskCount, 0);
  const percent = tasks ? Math.round((done * 100) / tasks) : 0;
  const active = projects.filter((p) => p.status === "ACTIVE").length;
  const completed = projects.filter((p) => p.status === "COMPLETED").length;

  return (
    <article className="tl-card">
      <header className="tl-card-head">
        <div className="tl-identity">
          <span className={`tl-avatar tl-tone-${team.id % 4}`} aria-hidden="true">
            {initialOf(team.name)}
          </span>
          <div className="tl-identity-text">
            <h2>{team.name}</h2>
            <p className="tl-owner">
              Owner: <UserLink id={team.ownerId} name={team.ownerUsername} />
            </p>
          </div>
        </div>

        <div className="tl-badges">
          <span className="tl-id">Team #{team.id}</span>
          {team.myRole && <span className={`tl-role tl-role-${team.myRole.toLowerCase()}`}>{team.myRole}</span>}
        </div>
      </header>

      <p className="tl-desc">{team.description?.trim() || "No description yet."}</p>

      <dl className="tl-stats">
        <div>
          <dt>Members</dt>
          <dd>{team.memberCount}</dd>
        </div>
        <div>
          <dt>Projects</dt>
          <dd>{projects.length}</dd>
        </div>
        <div>
          <dt>Active</dt>
          <dd>{active}</dd>
        </div>
        <div>
          <dt>Completed</dt>
          <dd>{completed}</dd>
        </div>
        <div>
          <dt>Tasks done</dt>
          <dd>{percent}%</dd>
        </div>
      </dl>

      <section className="tl-members" aria-label={`Members of ${team.name}`}>
        <h3>Members</h3>
        {shownMembers.length === 0 ? (
          <p className="tl-muted">No members yet.</p>
        ) : (
          <ul className="tl-member-grid">
            {shownMembers.map((m) => (
              <li key={m.userId}>
                <span className="tl-mavatar" aria-hidden="true">
                  {m.username.charAt(0).toUpperCase()}
                </span>
                <span className="tl-mname">
                  <UserLink id={m.userId} name={m.username} />
                </span>
                <span className="tl-mrole">{m.role}</span>
              </li>
            ))}
          </ul>
        )}
        {members.length > shownMembers.length && (
          <p className="tl-muted">+{members.length - shownMembers.length} more members</p>
        )}
      </section>

      <footer className="tl-actions">
        <button type="button" className="team-btn team-btn-secondary" onClick={() => onComment(team)}>
          Comments
        </button>
        {canManage && (
          <button type="button" className="team-btn team-btn-secondary" onClick={() => onAdd(team)}>
            + Add member
          </button>
        )}
        {canManage && (
          <button type="button" className="team-btn team-btn-secondary" onClick={() => onEdit(team)}>
            Edit
          </button>
        )}
        {canManage && (
          <button type="button" className="team-btn team-btn-secondary" onClick={() => onMembers(team)}>
            Members
          </button>
        )}
        {isOwner && (
          <button type="button" className="team-btn team-btn-danger" onClick={() => onDelete(team)}>
            Delete
          </button>
        )}
      </footer>
    </article>
  );
}

export default function TeamList() {
  const navigate = useNavigate();
  const [teams, setTeams] = useState<Team[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [addingTo, setAddingTo] = useState<Team | null>(null);
  const [editing, setEditing] = useState<Team | null>(null);
  const [managing, setManaging] = useState<Team | null>(null);
  const [commenting, setCommenting] = useState<Team | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");

    Promise.all([teamService.getUserTeams(controller.signal), projectService.getProjects(controller.signal)])
      .then(([teamList, projectList]) => {
        if (controller.signal.aborted) return;
        setTeams(teamList);
        setProjects(projectList);
      })
      .catch((err: unknown) => {
        if (!isAbortError(err)) setError(err instanceof Error ? err.message : "Unable to load teams.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [reloadKey]);

  const refresh = () => setReloadKey((k) => k + 1);

  const projectsByTeam = useMemo(() => {
    const map = new Map<number, Project[]>();
    for (const p of projects) {
      const list = map.get(p.teamId) ?? [];
      list.push(p);
      map.set(p.teamId, list);
    }
    return map;
  }, [projects]);

  const totals = useMemo(
    () => ({
      teams: teams.length,
      memberships: teams.reduce((sum, t) => sum + t.memberCount, 0),
      owned: teams.filter((t) => t.myRole === "OWNER").length,
      projects: projects.length,
    }),
    [teams, projects]
  );

  const query = search.trim().toLowerCase();

  const visibleTeams = useMemo(() => {
    if (!query) return teams;

    return teams.filter((t) => {
      if (t.name.toLowerCase().includes(query)) return true;

      return (t.members ?? []).some((m) => {
        const fullName = [m.firstName, m.lastName].filter(Boolean).join(" ").toLowerCase();
        return m.username.toLowerCase().includes(query) || fullName.includes(query);
      });
    });
  }, [teams, query]);

  const removeTeam = async (team: Team) => {
    if (!window.confirm(`Delete "${team.name}"? Its projects may be affected. This cannot be undone.`)) return;
    setError("");
    setNotice("");
    try {
      await teamService.deleteTeam(team.id);
      setNotice(`"${team.name}" deleted`);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete this team.");
    }
  };

  return (
    <main className="tl-page">
      <header className="tl-head">
        <div>
          <p className="tl-eyebrow">Workspace</p>
          <h1>Teams</h1>
          <p className="tl-sub">Bring people together and organize work in one place.</p>
        </div>
        <div className="tl-head-actions">
          <button type="button" className="team-btn team-btn-secondary" onClick={() => navigate("/dashboard")}>
            Back to dashboard
          </button>
          <button type="button" className="team-btn team-btn-primary" onClick={() => setShowCreate(true)}>
            + Create team
          </button>
        </div>
      </header>

      {notice && <output className="tl-notice">{notice}</output>}
      {error && (
        <div className="tl-alert" role="alert">
          <span>{error}</span>
          <button type="button" className="team-btn team-btn-secondary" onClick={refresh}>
            Try again
          </button>
        </div>
      )}

      {loading && teams.length === 0 && <p className="tl-state">Loading your teams…</p>}

      {!loading && teams.length === 0 && !error && (
        <section className="tl-empty">
          <h2>No teams yet</h2>
          <p>Create your first team to start organizing projects and collaborating.</p>
          <button type="button" className="team-btn team-btn-primary" onClick={() => setShowCreate(true)}>
            Create your first team
          </button>
        </section>
      )}

      {teams.length > 0 && (
        <>
          <section className="tl-summary" aria-label="Team totals">
            <div className="tl-stat">
              <span>Teams</span>
              <strong>{totals.teams}</strong>
            </div>
            <div className="tl-stat is-purple">
              <span>Memberships</span>
              <strong>{totals.memberships}</strong>
            </div>
            <div className="tl-stat is-green">
              <span>Projects</span>
              <strong>{totals.projects}</strong>
            </div>
            <div className="tl-stat is-orange">
              <span>You own</span>
              <strong>{totals.owned}</strong>
            </div>
          </section>

          <section className="tl-section" aria-labelledby="tl-your-teams">
            <div className="tl-section-head">
              <h2 id="tl-your-teams">Your teams</h2>
              <span>
                {visibleTeams.length} of {teams.length} {teams.length === 1 ? "team" : "teams"}
              </span>
            </div>

            <div className="tl-search">
              <input
                type="search"
                aria-label="Search teams by team name or member name"
                placeholder="Search by team name or member name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="tl-list">
              {visibleTeams.map((team) => (
                <TeamCard
                  key={team.id}
                  team={team}
                  projects={projectsByTeam.get(team.id) ?? []}
                  onComment={(t) => setCommenting(t)}
                  onAdd={(t) => setAddingTo(t)}
                  onEdit={(t) => setEditing(t)}
                  onMembers={(t) => setManaging(t)}
                  onDelete={(t) => void removeTeam(t)}
                />
              ))}

              {visibleTeams.length === 0 && (
                <p className="tl-state">No teams match “{search.trim()}”.</p>
              )}
            </div>
          </section>

          <TeamProjects teams={teams} />
        </>
      )}

      {showCreate && (
        <NewTeamModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            setNotice("Team created");
            refresh();
          }}
        />
      )}

      {addingTo && (
        <AddMemberModal team={addingTo} onClose={() => setAddingTo(null)} onAdded={() => refresh()} />
      )}

      {editing && (
        <EditTeamModal
          team={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}

      {managing && (
        <ManageMembersModal team={managing} onClose={() => setManaging(null)} onChanged={() => refresh()} />
      )}

      {commenting && (
        <TeamCommentsModal
          teamId={commenting.id}
          teamName={commenting.name}
          onClose={() => setCommenting(null)}
        />
      )}
    </main>
  );
}