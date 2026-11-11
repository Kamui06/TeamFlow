import type { ReactElement, ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CHART,
  plural,
  type ActivityStats,
  type ProjectStats,
  type TaskStats,
  type TeamStats,
} from "./DashboardData";

const CHART_HEIGHT = 230;
const TICK = { fontSize: 11, fill: "#667085" };
const SMALL_TICK = { fontSize: 10, fill: "#667085" };

const shorten = (value: string) => (value.length > 14 ? `${value.slice(0, 13)}…` : value);

interface Fact {
  label: string;
  value: string | number;
}

function Facts({ items }: Readonly<{ items: Fact[] }>) {
  return (
    <dl className="db-facts">
      {items.map((f) => (
        <div key={f.label}>
          <dt>{f.label}</dt>
          <dd>{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ChartBox({
  title,
  hasData,
  children,
}: Readonly<{ title: string; hasData: boolean; children: ReactElement }>) {
  return (
    <figure className="db-chart">
      <figcaption>{title}</figcaption>
      {hasData ? (
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          {children}
        </ResponsiveContainer>
      ) : (
        <p className="db-empty">No data yet</p>
      )}
    </figure>
  );
}

function PanelState({
  title,
  error,
  loaded,
  children,
}: Readonly<{ title: string; error: string | null; loaded: boolean; children: ReactNode }>) {
  if (error) {
    return (
      <div className="db-alert" role="alert">
        <strong>{title}:</strong> {error}
      </div>
    );
  }
  if (!loaded) {
    return <p className="db-state">Loading {title.toLowerCase()}…</p>;
  }
  return <>{children}</>;
}

// ---------- Tasks ----------

export function TasksPanel({ stats, error }: Readonly<{ stats: TaskStats | null; error: string | null }>) {
  return (
    <PanelState title="Tasks" error={error} loaded={stats !== null}>
      {stats && (
        <div className="db-panel">
          <div className="db-text">
            <h2>Tasks</h2>
            <p className="db-lead">
              {plural(stats.total, "task")} in your workspace: {stats.completed} completed and {stats.open} open.
            </p>
            <Facts
              items={[
                { label: "Overdue", value: stats.overdue },
                { label: "Due today", value: stats.dueToday },
                { label: "Due in 1–7 days", value: stats.dueSoon },
                { label: "Open, no assignee", value: stats.unassignedOpen },
              ]}
            />
            <p className="db-note">
              Open by priority:{" "}
              {stats.openByPriority.map((p) => `${p.label.toLowerCase()} ${p.count}`).join(" · ")}
            </p>
            <Link to="/tasks" className="db-link">
              Open tasks →
            </Link>
          </div>

          <div className="db-charts">
            <ChartBox title="Open tasks by due date" hasData={stats.dueBuckets.some((b) => b.count > 0)}>
              <BarChart data={stats.dueBuckets} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" vertical={false} />
                <XAxis dataKey="label" tick={TICK} tickLine={false} axisLine={false} interval={0} />
                <YAxis allowDecimals={false} tick={TICK} tickLine={false} axisLine={false} width={28} />
                <Tooltip />
                <Bar dataKey="count" name="Tasks" fill={CHART.blue} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ChartBox>

            <ChartBox title="Completed vs open by project" hasData={stats.byProject.length > 0}>
              <BarChart data={stats.byProject} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
                <XAxis type="number" allowDecimals={false} tick={TICK} tickLine={false} axisLine={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={110}
                  tick={TICK}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={shorten}
                />
                <Tooltip />
                <Legend />
                <Bar dataKey="completed" name="Completed" stackId="p" fill={CHART.green} />
                <Bar dataKey="open" name="Open" stackId="p" fill={CHART.blue} radius={[0, 6, 6, 0]} />
              </BarChart>
            </ChartBox>
          </div>
        </div>
      )}
    </PanelState>
  );
}

// ---------- Projects ----------

export function ProjectsPanel({ stats, error }: Readonly<{ stats: ProjectStats | null; error: string | null }>) {
  return (
    <PanelState title="Projects" error={error} loaded={stats !== null}>
      {stats && (
        <div className="db-panel">
          <div className="db-text">
            <h2>Projects</h2>
            <p className="db-lead">
              {plural(stats.total, "project")} visible to you. Average progress across them is{" "}
              {stats.averageProgress}%.
            </p>
            <Facts
              items={[
                { label: "Active", value: stats.active },
                { label: "Completed", value: stats.completed },
                { label: "Archived", value: stats.archived },
                { label: "You manage", value: stats.managed },
              ]}
            />
            <p className="db-note">
              You are a member of {stats.memberOf} and a viewer of {stats.viewerOf}.
            </p>
            <Link to="/projects" className="db-link">
              Open projects →
            </Link>
          </div>

          <div className="db-charts">
            <ChartBox title="Projects by status" hasData={stats.total > 0}>
              <PieChart>
                <Pie
                  data={stats.statusRows.map((row) => ({ ...row, fill: row.color }))}
                  dataKey="count"
                  nameKey="label"
                  innerRadius="55%"
                  outerRadius="80%"
                  paddingAngle={2}
                />
                <Tooltip />
                <Legend />
              </PieChart>
            </ChartBox>

            <ChartBox title="Progress by project" hasData={stats.progressRows.length > 0}>
              <BarChart data={stats.progressRows} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
                <XAxis type="number" domain={[0, 100]} unit="%" tick={TICK} tickLine={false} axisLine={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={110}
                  tick={TICK}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={shorten}
                />
                <Tooltip />
                <Bar dataKey="percent" name="Progress" fill={CHART.green} radius={[0, 6, 6, 0]} />
              </BarChart>
            </ChartBox>
          </div>
        </div>
      )}
    </PanelState>
  );
}

// ---------- Teams ----------

export function TeamsPanel({ stats, error }: Readonly<{ stats: TeamStats | null; error: string | null }>) {
  return (
    <PanelState title="Teams" error={error} loaded={stats !== null}>
      {stats && (
        <div className="db-panel">
          <div className="db-text">
            <h2>Teams</h2>
            <p className="db-lead">
              You belong to {plural(stats.total, "team")} with {stats.memberships} memberships in total, about{" "}
              {stats.averageSize} people per team.
            </p>
            <Facts
              items={[
                { label: "You own", value: stats.owned },
                { label: "You administer", value: stats.admin },
                { label: "Member of", value: stats.member },
                { label: "Viewer of", value: stats.viewer },
              ]}
            />
            <Link to="/teams" className="db-link">
              Open teams →
            </Link>
          </div>

          <div className="db-charts">
            <ChartBox title="Your role in each team" hasData={stats.total > 0}>
              <PieChart>
                <Pie
                  data={stats.roleRows.map((row) => ({ ...row, fill: row.color }))}
                  dataKey="count"
                  nameKey="label"
                  innerRadius="55%"
                  outerRadius="80%"
                  paddingAngle={2}
                />
                <Tooltip />
                <Legend />
              </PieChart>
            </ChartBox>

            <ChartBox title="Members per team" hasData={stats.sizeRows.length > 0}>
              <BarChart data={stats.sizeRows} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
                <XAxis type="number" allowDecimals={false} tick={TICK} tickLine={false} axisLine={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={110}
                  tick={TICK}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={shorten}
                />
                <Tooltip />
                <Bar dataKey="members" name="Members" fill={CHART.purple} radius={[0, 6, 6, 0]} />
              </BarChart>
            </ChartBox>
          </div>
        </div>
      )}
    </PanelState>
  );
}

// ---------- Activity ----------

function categoryRows(stats: ActivityStats) {
  return [
    { label: "Tasks", count: stats.last7ByCategory.tasks, color: CHART.blue },
    { label: "Projects", count: stats.last7ByCategory.projects, color: CHART.green },
    { label: "Teams", count: stats.last7ByCategory.teams, color: CHART.orange },
    { label: "Comments", count: stats.last7ByCategory.comments, color: CHART.purple },
  ];
}

export function ActivityPanel({ stats, error }: Readonly<{ stats: ActivityStats | null; error: string | null }>) {
  return (
    <PanelState title="Activity" error={error} loaded={stats !== null}>
      {stats && (
        <div className="db-panel">
          <div className="db-text">
            <h2>Activity</h2>
            <p className="db-lead">
              {plural(stats.last7, "notification")} in the last 7 days about tasks, projects, teams and comments.
            </p>
            <Facts
              items={[
                { label: "Tasks", value: stats.last7ByCategory.tasks },
                { label: "Projects", value: stats.last7ByCategory.projects },
                { label: "Teams", value: stats.last7ByCategory.teams },
                { label: "Comments", value: stats.last7ByCategory.comments },
                { label: "Unread", value: stats.unread },
              ]}
            />
            {stats.latest && <p className="db-note">Most recent: {stats.latest.message}</p>}
            <Link to="/notifications" className="db-link">
              Open notifications →
            </Link>
          </div>

          <div className="db-charts">
            <ChartBox
              title="Last 14 days"
              hasData={stats.days.some((d) => d.tasks + d.projects + d.teams + d.comments > 0)}
            >
              <BarChart data={stats.days} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" vertical={false} />
                <XAxis dataKey="label" tick={SMALL_TICK} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} tick={TICK} tickLine={false} axisLine={false} width={28} />
                <Tooltip />
                <Legend />
                <Bar dataKey="tasks" name="Tasks" stackId="a" fill={CHART.blue} />
                <Bar dataKey="projects" name="Projects" stackId="a" fill={CHART.green} />
                <Bar dataKey="teams" name="Teams" stackId="a" fill={CHART.orange} />
                <Bar dataKey="comments" name="Comments" stackId="a" fill={CHART.purple} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ChartBox>

            <ChartBox title="Last 7 days by type" hasData={stats.last7 > 0}>
              <PieChart>
                <Pie
                  data={categoryRows(stats).map((row) => ({ ...row, fill: row.color }))}
                  dataKey="count"
                  nameKey="label"
                  innerRadius="55%"
                  outerRadius="80%"
                  paddingAngle={2}
                />
                <Tooltip />
                <Legend />
              </PieChart>
            </ChartBox>
          </div>
        </div>
      )}
    </PanelState>
  );
}