import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import CommentsPanel from "../Comments/CommentsPanel";
import {
  buildOverview,
  computeActivity,
  computeProjectStats,
  computeTaskStats,
  computeTeamStats,
  loadSnapshot,
  localDateKey,
  type Snapshot,
} from "./DashboardData";
import { ActivityPanel, ProjectsPanel, TasksPanel, TeamsPanel } from "./DashboardSection";
import "./Dashboard.css";

type TabKey = "overview" | "tasks" | "projects" | "teams" | "activity" | "comments";

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "tasks", label: "Tasks" },
  { key: "projects", label: "Projects" },
  { key: "teams", label: "Teams" },
  { key: "activity", label: "Activity" },
  { key: "comments", label: "Comments" },
];

export default function Dashboard() {
  const [tab, setTab] = useState<TabKey>("overview");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    loadSnapshot(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setSnapshot(data);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          console.error("Failed to load dashboard data", error);
        }
      });

    return () => controller.abort();
  }, [refreshKey]);

  const stats = useMemo(() => {
    if (!snapshot) return null;
    const now = new Date();
    const today = localDateKey(now);

    const tasks = computeTaskStats(snapshot.tasks.data, today);
    const projects = computeProjectStats(snapshot.projects.data);
    const teams = computeTeamStats(snapshot.teams.data);
    const activity = computeActivity(snapshot.notifications.data, now);

    return {
      tasks,
      projects,
      teams,
      activity,
      overview: buildOverview({ tasks, projects, teams, activity }),
    };
  }, [snapshot]);

  const errorFor = (key: keyof Snapshot) => snapshot?.[key].error ?? null;

  const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  // The Overview tab shows every section. Other tabs show only their own section.
  const isOverview = tab === "overview";

  return (
    <main className="db-page">
      <header className="db-header">
        <div>
          <p className="db-eyebrow">{todayLabel}</p>
          <h1>Workspace overview</h1>
          <p className="db-sub">Live figures from your teams, projects, tasks and notifications.</p>
        </div>
        <button
          type="button"
          className="db-btn"
          onClick={() => setRefreshKey((k) => k + 1)}
          disabled={loading}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      <nav className="db-tabs" role="tablist" aria-label="Dashboard sections">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            id={`db-tab-${t.key}`}
            aria-selected={tab === t.key}
            aria-controls="db-panel"
            className="db-tab"
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <section id="db-panel" role="tabpanel" aria-labelledby={`db-tab-${tab}`} className="db-content">
        {(isOverview || tab === "tasks") && (
          <TasksPanel stats={stats?.tasks ?? null} error={errorFor("tasks")} />
        )}

        {(isOverview || tab === "projects") && (
          <ProjectsPanel stats={stats?.projects ?? null} error={errorFor("projects")} />
        )}

        {(isOverview || tab === "teams") && (
          <TeamsPanel stats={stats?.teams ?? null} error={errorFor("teams")} />
        )}

        {(isOverview || tab === "activity") && (
          <ActivityPanel stats={stats?.activity ?? null} error={errorFor("notifications")} />
        )}

        {isOverview && (
          <div className="db-card">
            <h2 className="db-card-title">Summary</h2>
            {stats ? (
              <ul className="db-overview">
                {stats.overview.map((line, i) => (
                  <li key={`${line.area}-${i}`}>
                    <span className="db-overview-area">{line.area}</span>
                    <p>{line.text}</p>
                    <Link to={line.to}>Open →</Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="db-state">Loading summary…</p>
            )}
          </div>
        )}

        {(isOverview || tab === "comments") && <CommentsPanel />}
      </section>
    </main>
  );
}