import { useState, type ReactNode } from "react";
import {
  Area,
  AreaChart,
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
import { apiFetch } from "../api/api";
import { useApi } from "../api/useApi";
import "./AdminOverview.css";

interface Kpi {
  total: number;
  addedLast7Days: number;
}
interface KpiSummary {
  users: Kpi;
  teams: Kpi;
  projects: Kpi;
  tasks: Kpi;
}
interface SignupPoint {
  weekStart: string;
  count: number;
}
interface CategoryCount {
  label: string;
  count: number;
}
interface ProjectTaskBreakdown {
  projectId: number;
  projectName: string;
  completed: number;
  open: number;
}
interface UserWorkload {
  userId: number;
  username: string;
  openTasks: number;
}

type SectionKey = "kpis" | "signups" | "users" | "projects" | "tasks" | "workload" | "completion";

const SECTIONS: { key: SectionKey; label: string }[] = [
  { key: "kpis", label: "KPIs" },
  { key: "signups", label: "Sign-ups" },
  { key: "users", label: "Users: active / inactive" },
  { key: "projects", label: "Projects by status" },
  { key: "tasks", label: "Tasks by priority" },
  { key: "workload", label: "Workload" },
  { key: "completion", label: "Completed vs open" },
];

const ALL_SECTIONS: SectionKey[] = SECTIONS.map((s) => s.key);

const KPI_CARDS: { key: keyof KpiSummary; label: string; tone: string }[] = [
  { key: "users", label: "Users", tone: "blue" },
  { key: "teams", label: "Teams", tone: "purple" },
  { key: "projects", label: "Projects", tone: "green" },
  { key: "tasks", label: "Tasks", tone: "orange" },
];

const RANGES = [4, 12, 26] as const;
const USER_COLORS: Record<string, string> = { Active: "#12b76a", Inactive: "#f04438" };
const STATUS_COLORS: Record<string, string> = { ACTIVE: "#12b76a", COMPLETED: "#7a5af8", ARCHIVED: "#98a2b3" };
const PRIORITY_ORDER = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const PRIORITY_COLORS: Record<string, string> = {
  LOW: "#98a2b3",
  MEDIUM: "#1976d2",
  HIGH: "#f79009",
  URGENT: "#d92d20",
};
const FALLBACK = "#667085";

const weekLabel = (weekStart: string) =>
  new Date(`${weekStart}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });

const shorten = (text: string, max = 16) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

interface CardProps {
  readonly title: string;
  readonly subtitle: string;
  readonly wide?: boolean;
  readonly loading?: boolean;
  readonly error?: string | null;
  readonly empty?: string | null;
  readonly children?: ReactNode;
}

function Card({ title, subtitle, wide = false, loading = false, error = null, empty = null, children }: CardProps) {
  let body: ReactNode = children;
  if (error) body = <div className="ac-alert" role="alert">{error}</div>;
  else if (loading) body = <p className="ac-state">Loading…</p>;
  else if (empty) body = <p className="ac-empty">{empty}</p>;

  return (
    <article className={`ac-card ${wide ? "ac-wide" : ""}`}>
      <div className="ac-head">
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      {body}
    </article>
  );
}

function KpiCards() {
  const { data, error, loading } = useApi(
    (signal) => apiFetch<KpiSummary>("/admin/stats/kpis", { signal }),
    []
  );

  if (error) return <div className="ac-alert" role="alert">{error.message}</div>;
  if (loading || !data) return <p className="ac-state">Loading statistics…</p>;

  return (
    <div className="ao-kpis">
      {KPI_CARDS.map((card) => {
        const kpi = data[card.key];
        return (
          <article key={card.key} className={`ao-kpi ao-${card.tone}`}>
            <span className="ao-kpi-label">{card.label}</span>
            <strong className="ao-kpi-value">{kpi.total.toLocaleString()}</strong>
            <span className="ao-kpi-delta">+{kpi.addedLast7Days.toLocaleString()} in the last 7 days</span>
          </article>
        );
      })}
    </div>
  );
}

function SignupsCard() {
  const [weeks, setWeeks] = useState<number>(12);
  const { data, error, loading } = useApi(
    (signal) => apiFetch<SignupPoint[]>(`/admin/stats/signups?weeks=${weeks}`, { signal }),
    [weeks]
  );
  const chart = (data ?? []).map((p) => ({ label: weekLabel(p.weekStart), count: p.count }));

  return (
    <Card
      title="Sign-ups per week"
      subtitle="New accounts created each week"
      wide
      error={error?.message ?? null}
      loading={loading && !data}
    >
      <div className="ao-range-row">
        <fieldset className="ao-range" aria-label="Time range">
          {RANGES.map((r) => (
            <button key={r} type="button" className={weeks === r ? "active" : ""} onClick={() => setWeeks(r)}>
              {r}w
            </button>
          ))}
        </fieldset>
      </div>
      <div className="ao-chart">
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={chart} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="signupFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1976d2" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#1976d2" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
            <Tooltip />
            <Area type="monotone" dataKey="count" name="Sign-ups" stroke="#1976d2" strokeWidth={2} fill="url(#signupFill)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function DonutCard({
  title,
  subtitle,
  path,
  colors,
}: Readonly<{ title: string; subtitle: string; path: string; colors: Record<string, string> }>) {
  const { data, error, loading } = useApi((signal) => apiFetch<CategoryCount[]>(path, { signal }), [path]);
  const rows = data ?? [];
  const total = rows.reduce((sum, r) => sum + r.count, 0);

  return (
    <Card
      title={title}
      subtitle={subtitle}
      error={error?.message ?? null}
      loading={loading && !data}
      empty={data && total === 0 ? "No data yet" : null}
    >
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={rows.map((r) => ({ name: r.label, value: r.count, fill: colors[r.label] ?? FALLBACK }))}
            dataKey="value"
            nameKey="name"
            innerRadius="55%"
            outerRadius="80%"
            paddingAngle={2}
          />
          <Tooltip />
          <Legend position="bottom" />
        </PieChart>
      </ResponsiveContainer>
    </Card>
  );
}

function PriorityCard() {
  const { data, error, loading } = useApi(
    (signal) => apiFetch<CategoryCount[]>("/admin/stats/tasks-by-priority", { signal }),
    []
  );
  const rows = [...(data ?? [])]
    .sort((a, b) => PRIORITY_ORDER.indexOf(a.label) - PRIORITY_ORDER.indexOf(b.label))
    .map((row) => ({ ...row, fill: PRIORITY_COLORS[row.label] ?? FALLBACK }));

  return (
    <Card
      title="Tasks by priority"
      subtitle="Volume of work at each priority"
      error={error?.message ?? null}
      loading={loading && !data}
      empty={data && rows.length === 0 ? "No tasks yet" : null}
    >
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
          <Tooltip />
          <Bar dataKey="count" name="Tasks" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

function WorkloadCard() {
  const { data, error, loading } = useApi(
    (signal) => apiFetch<UserWorkload[]>("/admin/stats/workload?limit=10", { signal }),
    []
  );
  const rows = data ?? [];

  return (
    <Card
      title="Workload by person"
      subtitle="Open tasks assigned to each user, busiest first"
      error={error?.message ?? null}
      loading={loading && !data}
      empty={data && rows.length === 0 ? "No open tasks are assigned" : null}
    >
      <ResponsiveContainer width="100%" height={Math.max(240, rows.length * 36 + 40)}>
        <BarChart data={rows} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" horizontal={false} />
          <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="username" width={120} tickLine={false} axisLine={false} />
          <Tooltip />
          <Bar dataKey="openTasks" name="Open tasks" fill="#1976d2" radius={[0, 6, 6, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

function CompletionCard() {
  const { data, error, loading } = useApi(
    (signal) => apiFetch<ProjectTaskBreakdown[]>("/admin/stats/project-breakdown?limit=10", { signal }),
    []
  );
  const rows = data ?? [];

  return (
    <Card
      title="Completed vs. open tasks by project"
      subtitle="The ten projects with the most tasks"
      wide
      error={error?.message ?? null}
      loading={loading && !data}
      empty={data && rows.length === 0 ? "No tasks yet" : null}
    >
      <ResponsiveContainer width="100%" height={Math.max(220, rows.length * 36 + 60)}>
        <BarChart data={rows} layout="vertical" margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#667085" }} tickLine={false} axisLine={false} />
          <YAxis
            type="category"
            dataKey="projectName"
            width={110}
            interval={0}
            tick={{ fontSize: 11, fill: "#475467" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value: string) => shorten(value)}
          />
          <Tooltip />
          <Legend />
          <Bar dataKey="completed" name="Completed" stackId="p" fill="#12b76a" />
          <Bar dataKey="open" name="Open" stackId="p" fill="#1976d2" radius={[0, 6, 6, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

export default function AdminOverview() {
  const [shown, setShown] = useState<SectionKey[]>(ALL_SECTIONS);

  const isShown = (key: SectionKey) => shown.includes(key);

  const toggle = (key: SectionKey) =>
    setShown((current) => (current.includes(key) ? current.filter((k) => k !== key) : [...current, key]));

  return (
    <section className="ao-wrap">
      <fieldset className="ao-filters" aria-label="Choose which charts to show">
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            type="button"
            className={`ao-chip ${isShown(s.key) ? "active" : ""}`}
            aria-pressed={isShown(s.key)}
            onClick={() => toggle(s.key)}
          >
            {s.label}
          </button>
        ))}
        <button type="button" className="ao-chip ao-chip-all" onClick={() => setShown(ALL_SECTIONS)}>
          Show all
        </button>
        <button type="button" className="ao-chip ao-chip-all" onClick={() => setShown([])}>
          Hide all
        </button>
      </fieldset>

      {isShown("kpis") && <KpiCards />}

      <div className="ac-grid">
        {isShown("signups") && <SignupsCard />}
        {isShown("users") && (
          <DonutCard
            title="Users: active and inactive"
            subtitle="Accounts that can and cannot sign in"
            path="/admin/stats/users-by-status"
            colors={USER_COLORS}
          />
        )}
        {isShown("projects") && (
          <DonutCard
            title="Projects by status"
            subtitle="How many projects are in each state"
            path="/admin/stats/projects-by-status"
            colors={STATUS_COLORS}
          />
        )}
        {isShown("tasks") && <PriorityCard />}
        {isShown("workload") && <WorkloadCard />}
        {isShown("completion") && <CompletionCard />}
      </div>
    </section>
  );
}