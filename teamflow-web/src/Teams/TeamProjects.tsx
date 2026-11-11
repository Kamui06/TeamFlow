import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { projectService } from "../services/ProjectService";
import type { Project } from "../services/ProjectService";
import type { Team } from "../services/TeamService";

import "./TeamProjects.css";

type Mode = "due" | "name";

function dateOnly(value: string | null | undefined) {
  return value ? value.slice(0, 10) : null;
}

function formatDate(value: string | null | undefined) {
  const d = dateOnly(value);
  if (!d) return "No due date";
  return new Date(`${d}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface TeamProjectsProps {
  readonly teams: Team[];
}

export default function TeamProjects({ teams }: TeamProjectsProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<Mode>("due");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  useEffect(() => {
    let cancelled = false;
    projectService
      .getProjects()
      .then((list) => {
        if (!cancelled) setProjects(list);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load projects");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const teamNames = useMemo(
    () => new Map<number, string>(teams.map((t): [number, string] => [t.id, t.name])),
    [teams]
  );

  const rangeInvalid = Boolean(start && end && start > end);

  const rows = useMemo(() => {
    if (mode === "name") {
      return [...projects].sort((a, b) => a.name.localeCompare(b.name));
    }
    if (rangeInvalid) return [];

    return projects
      .filter((p) => {
        const d = dateOnly(p.endDate);
        if (start && (!d || d < start)) return false;
        if (end && (!d || d > end)) return false;
        return true;
      })
      .sort((a, b) => {
        const da = dateOnly(a.endDate);
        const db = dateOnly(b.endDate);
        if (da && db) return da.localeCompare(db) || a.name.localeCompare(b.name);
        if (da) return -1;
        if (db) return 1;
        return a.name.localeCompare(b.name);
      });
  }, [projects, mode, start, end, rangeInvalid]);

  const projectContent = (() => {
    if (loading) return <p className="tp-state">Loading projects…</p>;
    if (error) return <p className="tp-alert">{error}</p>;
    if (rows.length === 0) return <p className="tp-state">No projects match.</p>;

    return (
      <ul className="tp-list">
        {rows.map((p) => (
          <li key={p.id} className="tp-row">
            <div className="tp-name">
              <Link to={`/projects/${p.id}`}>{p.name}</Link>
              <small>{teamNames.get(p.teamId) ?? "Unknown team"}</small>
            </div>
            <span className={`tp-status tp-status-${p.status.toLowerCase()}`}>{p.status}</span>
            <span className="tp-progress">
              {p.completedTaskCount}/{p.taskCount} done
            </span>
            <span className="tp-due">{formatDate(p.endDate)}</span>
          </li>
        ))}
      </ul>
    );
  })();

  return (
    <section className="tp-card" aria-labelledby="tp-title">
      <div className="tp-head">
        <div>
          <h2 id="tp-title">Projects across your teams</h2>
          <p className="tp-subtle">{projects.length} projects you can see</p>
        </div>

        <fieldset className="tp-modes" aria-label="Sort projects">
          <button type="button" className={mode === "due" ? "active" : ""} onClick={() => setMode("due")}>
            By due date
          </button>
          <button type="button" className={mode === "name" ? "active" : ""} onClick={() => setMode("name")}>
            By project name
          </button>
        </fieldset>
      </div>

      {mode === "due" && (
        <>
          <div className="tp-range">
            <label>
              From{" "}
              <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </label>
            <label>
              To{" "}
              <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </label>
            <button
              type="button"
              disabled={!start && !end}
              onClick={() => {
                setStart("");
                setEnd("");
              }}
            >
              Clear
            </button>
          </div>
          {rangeInvalid && <p className="tp-alert">The start date is after the end date.</p>}
          {!rangeInvalid && (start || end) && (
            <p className="tp-hint">Projects without a due date are hidden while a range is set.</p>
          )}
        </>
      )}

      {projectContent}
    </section>
  );
}