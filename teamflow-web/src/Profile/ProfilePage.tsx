import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { isAbortError } from "../api/api";
import {
  profileService,
  type ActivityItem,
  type Counts,
  type Overview,
  type Profile,
  type ProjectItem,
  type PublicProfile,
  type TaskItem,
  type TeamRef,
} from "../services/ProfileService";
import EditProfileModal from "./EditProfileModal";
import "./Profile.css";

type Tab = "overview" | "assignments";

/** The data both views render, whether it came from your profile or a public one. */
interface ViewData {
  id: number;
  username: string;
  displayName: string;
  email: string | null;
  bio: string | null;
  role: string;
  joinedAt: string | null;
  teams: TeamRef[];
  tasks: Counts;
  assignedProjects: number;
  overdue: number;
  recentlyCompleted: TaskItem[];
  upcoming: TaskItem[];
  recentActivity: ActivityItem[];
  projects: ProjectItem[];
  assignedTasks: TaskItem[];
}

const AVATAR_TONES = ["pf-tone-blue", "pf-tone-purple", "pf-tone-green", "pf-tone-orange"];

const ROLE_CLASS: Record<string, string> = {
  OWNER: "pf-role-owner",
  ADMIN: "pf-role-admin",
  MEMBER: "pf-role-member",
  VIEWER: "pf-role-viewer",
};

function displayName(first: string | null, last: string | null, username: string) {
  return [first, last].filter(Boolean).join(" ") || username;
}

function initialsOf(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "?"
  );
}

/** Today's date in local time, as yyyy-mm-dd, so it compares with due dates. */
function localToday() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function dateText(value: string | null) {
  if (!value) return "—";
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function dateTimeText(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function TaskList({ tasks, today, empty }: Readonly<{ tasks: TaskItem[]; today: string; empty: string }>) {
  if (tasks.length === 0) return <p className="pf-empty">{empty}</p>;

  return (
    <ul className="pf-tasks">
      {tasks.map((t) => {
        const overdue = !t.completed && !!t.dueDate && t.dueDate < today;
        return (
          <li key={t.id}>
            <div className="pf-task-main">
              <Link to={`/tasks/${t.id}`}>{t.title}</Link>
              <span>{t.projectName}</span>
            </div>
            <div className="pf-task-side">
              <span className={`pf-chip ${t.completed ? "done" : "open"}`}>
                {t.completed ? "Completed" : t.status ?? "Open"}
              </span>
              <span className={overdue ? "pf-overdue" : ""}>{dateText(t.dueDate)}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function ProjectsTable({ projects }: Readonly<{ projects: ProjectItem[] }>) {
  if (projects.length === 0) return <p className="pf-empty">No projects to show.</p>;

  return (
    <div className="pf-table" role="table">
      <div className="pf-row pf-row-head" role="row">
        <span role="columnheader">Project</span>
        <span role="columnheader">Team</span>
        <span role="columnheader">Status</span>
        <span role="columnheader">Role</span>
        <span role="columnheader">Tasks</span>
      </div>
      {projects.map((p) => (
        <div className="pf-row" role="row" key={p.id}>
          <span role="cell">
            <Link to={`/projects/${p.id}`}>{p.name}</Link>
          </span>
          <span role="cell">{p.teamName}</span>
          <span role="cell">{p.status}</span>
          <span role="cell">{p.myRole}</span>
          <span role="cell">
            {p.myCompleted}/{p.myTasks}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Shared layout for both profile views. Your own view adds the email and the edit button. */
function ProfileBody({
  data,
  tab,
  onTab,
  today,
  headerActions,
  notice,
  error,
  showEmail,
}: Readonly<{
  data: ViewData;
  tab: Tab;
  onTab: (t: Tab) => void;
  today: string;
  headerActions: React.ReactNode;
  notice?: string;
  error?: string;
  showEmail: boolean;
}>) {
  const percent = data.tasks.total ? Math.round((data.tasks.completed * 100) / data.tasks.total) : 0;

  return (
    <>
      <section className="pf-hero">
        <div className="pf-hero-main">
          <div className={`pf-avatar ${AVATAR_TONES[data.id % AVATAR_TONES.length]}`} aria-hidden="true">
            {initialsOf(data.displayName)}
          </div>

          <div className="pf-identity">
            <div className="pf-name-row">
              <h1>{data.displayName}</h1>
              {data.role === "ADMIN" && <span className="pf-badge">System admin</span>}
            </div>
            <p className="pf-username">@{data.username}</p>
            {showEmail && data.email && <p className="pf-email">{data.email}</p>}
            <p className="pf-bio">{data.bio || "No bio yet."}</p>

            <div className="pf-meta">
              <span>Joined {dateText(data.joinedAt)}</span>
            </div>

            <div className="pf-teams">
              {data.teams.length === 0 && <span className="pf-muted">Not in any team</span>}
              {data.teams.map((t) => (
                <Link key={t.id} to="/teams" className={`pf-team ${ROLE_CLASS[t.role] ?? ""}`}>
                  <span>{t.name}</span>
                  <small>{t.role}</small>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {headerActions}
      </section>

      {notice && <output className="pf-notice">{notice}</output>}
      {error && (
        <div className="pf-alert" role="alert">
          {error}
        </div>
      )}

        <nav className="pf-tabs" role="tablist" aria-label="Profile sections">
            <TabButton current={tab} value="overview" label="Overview" onSelect={onTab} />
            <TabButton current={tab} value="assignments" label="Assignments" onSelect={onTab} />
        </nav>

      {tab === "overview" && (
        <>
          <section className="pf-stats">
            <article className="pf-stat pf-stat-blue">
              <span>Assigned projects</span>
              <strong>{data.assignedProjects}</strong>
              <small>Projects they're a member of</small>
            </article>

            <article className="pf-stat pf-stat-green">
              <span>Assigned tasks</span>
              <strong>
                {data.tasks.completed}/{data.tasks.total}
              </strong>
              <div className="pf-progress" aria-label={`${percent}% complete`}>
                <div style={{ width: `${percent}%` }} />
              </div>
              <small>
                {data.tasks.completed} complete · {data.tasks.incomplete} incomplete
              </small>
            </article>

            <article className="pf-stat pf-stat-orange">
              <span>Overdue</span>
              <strong>{data.overdue}</strong>
              <small>Open tasks past their due date</small>
            </article>
          </section>

          <section className="pf-card pf-card-wide">
            <h2>Recent activity</h2>
            {data.recentActivity.length === 0 ? (
              <p className="pf-empty">No activity yet.</p>
            ) : (
              <ul className="pf-activity pf-activity-rows">
                {data.recentActivity.map((a, i) => (
                  <li key={`${a.link}-${i}`}>
                    <Link to={a.link}>{a.text}</Link>
                    <span>{dateTimeText(a.at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="pf-card pf-card-wide">
            <h2>Recently completed</h2>
            <TaskList tasks={data.recentlyCompleted} today={today} empty="No completed tasks yet." />
          </section>

          <section className="pf-card pf-card-wide">
            <h2>Upcoming deadlines</h2>
            <p className="pf-hint">Open tasks due in the next 14 days, including overdue ones</p>
            <TaskList tasks={data.upcoming} today={today} empty="Nothing due soon." />
          </section>
        </>
      )}

      {tab === "assignments" && (
        <section className="pf-panels pf-panels-wide">
          <article className="pf-card">
            <h2>Projects</h2>
            <ProjectsTable projects={data.projects} />
          </article>

          <article className="pf-card">
            <h2>Tasks assigned</h2>
            <TaskList tasks={data.assignedTasks} today={today} empty="No tasks assigned." />
          </article>
        </section>
      )}
    </>
  );
}

function TabButton({
  current,
  value,
  label,
  onSelect,
}: Readonly<{ current: Tab; value: Tab; label: string; onSelect: (t: Tab) => void }>) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={current === value}
      className={current === value ? "active" : ""}
      onClick={() => onSelect(value)}
    >
      {label}
    </button>
  );
}

export default function ProfilePage() {
  const { userId } = useParams();
  const viewingOther = userId !== undefined;
  const otherId = viewingOther ? Number(userId) : null;

  const [tab, setTab] = useState<Tab>("overview");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [other, setOther] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [assignmentsForOwn, setAssignmentsForOwn] = useState<{ projects: ProjectItem[]; tasks: TaskItem[] } | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Load your own profile and overview, or another user's public profile.
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");

    if (viewingOther && otherId !== null) {
      profileService
        .getPublicProfile(otherId, controller.signal)
        .then((p) => {
          if (!controller.signal.aborted) setOther(p);
        })
        .catch((err: unknown) => {
          if (!isAbortError(err)) setError(err instanceof Error ? err.message : "Could not load profile");
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    } else {
      Promise.all([profileService.getProfile(controller.signal), profileService.getOverview(controller.signal)])
        .then(([p, o]) => {
          if (controller.signal.aborted) return;
          setProfile(p);
          setOverview(o);
        })
        .catch((err: unknown) => {
          if (!isAbortError(err)) setError(err instanceof Error ? err.message : "Could not load profile");
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }

    return () => controller.abort();
  }, [reloadKey, otherId, viewingOther]);

  // Own profile: the assignments tab loads its data on demand.
  useEffect(() => {
    if (tab !== "assignments" || viewingOther) return;
    const controller = new AbortController();

    profileService
      .getAssignments(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setAssignmentsForOwn(data);
      })
      .catch((err: unknown) => {
        if (!isAbortError(err)) setError(err instanceof Error ? err.message : "Could not load assignments");
      });

    return () => controller.abort();
  }, [tab, reloadKey, viewingOther]);

  const today = localToday();

  // ---------- Another user's profile ----------

  if (viewingOther) {
    if (loading && !other) {
      return (
        <main className="pf-page">
          <p className="pf-state">Loading profile…</p>
        </main>
      );
    }

    if (!other) {
      return (
        <main className="pf-page">
          <div className="pf-alert" role="alert">
            {error || "User not found"}
          </div>
        </main>
      );
    }

    const name = displayName(other.firstName, other.lastName, other.username);
    const data: ViewData = {
      id: other.id,
      username: other.username,
      displayName: name,
      email: null,
      bio: other.bio,
      role: other.role,
      joinedAt: other.joinedAt,
      teams: other.teams,
      tasks: other.tasks,
      assignedProjects: other.assignedProjects,
      overdue: other.overdue,
      recentlyCompleted: other.recentlyCompleted,
      upcoming: other.upcoming,
      recentActivity: other.recentActivity,
      projects: other.projects,
      assignedTasks: other.assignedTasks,
    };

    return (
      <main className="pf-page">
        <ProfileBody
          data={data}
          tab={tab}
          onTab={setTab}
          today={today}
          showEmail={false}
          error={error}
          headerActions={
            <Link to="/teams" className="pf-btn pf-btn-secondary">
              Back to teams
            </Link>
          }
        />
      </main>
    );
  }

  // ---------- Your own profile ----------

  if (loading && !profile) {
    return (
      <main className="pf-page">
        <p className="pf-state">Loading profile…</p>
      </main>
    );
  }

  if (!profile || !overview) {
    return (
      <main className="pf-page">
        <div className="pf-alert" role="alert">
          {error || "Profile not found"}
        </div>
      </main>
    );
  }

  const ownName = displayName(profile.firstName, profile.lastName, profile.username);
  const ownData: ViewData = {
    id: profile.id,
    username: profile.username,
    displayName: ownName,
    email: profile.email,
    bio: profile.bio,
    role: profile.role,
    joinedAt: profile.joinedAt,
    teams: profile.teams,
    tasks: overview.tasks,
    assignedProjects: overview.assignedProjects,
    overdue: overview.overdue,
    recentlyCompleted: overview.recentlyCompleted,
    upcoming: overview.upcoming,
    recentActivity: overview.recentActivity.map((a) => ({ text: a.text, link: a.link, at: a.at })),
    projects: assignmentsForOwn?.projects ?? [],
    assignedTasks: assignmentsForOwn?.tasks ?? [],
  };

  return (
    <main className="pf-page">
      <ProfileBody
        data={ownData}
        tab={tab}
        onTab={setTab}
        today={today}
        showEmail
        notice={notice}
        error={error}
        headerActions={
          <button type="button" className="pf-btn pf-btn-primary" onClick={() => setEditing(true)}>
            Edit profile
          </button>
        }
      />

      {editing && (
        <EditProfileModal
          profile={profile}
          onClose={() => setEditing(false)}
          onSaved={(saved) => {
            setEditing(false);
            setProfile(saved);
            setNotice("Profile updated");
            setReloadKey((k) => k + 1);
          }}
        />
      )}
    </main>
  );
}