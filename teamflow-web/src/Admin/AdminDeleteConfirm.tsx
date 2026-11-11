import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { isAbortError } from "../api/api";
import { adminDeletion, type DeletionImpact } from "./AdminDeletion";
import "./AdminDeleteConfirm.css";

interface AdminDeleteConfirmProps {
  readonly kind: "team" | "project";
}

const errorText = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);

export default function AdminDeleteConfirm({ kind }: Readonly<AdminDeleteConfirmProps>) {
  const params = useParams();
  const id = Number(kind === "team" ? params.teamId : params.projectId);
  const noun = kind === "team" ? "team" : "project";

  const [impact, setImpact] = useState<DeletionImpact | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");

    const request =
      kind === "team"
        ? adminDeletion.teamImpact(id, controller.signal)
        : adminDeletion.projectImpact(id, controller.signal);

    request
      .then((data) => {
        if (!controller.signal.aborted) setImpact(data);
      })
      .catch((err: unknown) => {
        if (!isAbortError(err)) setError(errorText(err, "Could not load what would be deleted."));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [kind, id]);

  const confirmed = impact !== null && typed === impact.name;

  const remove = async () => {
    if (!impact || !confirmed) return;
    setDeleting(true);
    setError("");
    try {
      if (kind === "team") await adminDeletion.deleteTeam(id);
      else await adminDeletion.deleteProject(id);
      setDeleted(true);
    } catch (err) {
      // The server runs the delete in one transaction, so a failure removes nothing.
      setError(errorText(err, "Could not delete. Nothing was removed."));
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <main className="adc-page">
        <p className="adc-state">Checking what would be deleted…</p>
      </main>
    );
  }

  if (!impact) {
    return (
      <main className="adc-page">
        <div className="adc-alert" role="alert">
          {error || "Not found."}
        </div>
        <Link to="/admin" className="adc-back">
          ← Back to admin
        </Link>
      </main>
    );
  }

  if (deleted) {
    return (
      <main className="adc-page">
        <section className="adc-card adc-success">
          <p className="adc-eyebrow">Deleted</p>
          <h1>
            {noun === "team" ? "Team" : "Project"} “{impact.name}” was deleted
          </h1>
          <p className="adc-sub">The items listed as deleted have been removed. Items listed as kept remain.</p>
          <Link to="/admin" className="adc-btn adc-btn-primary">
            Back to admin
          </Link>
        </section>
      </main>
    );
  }

  const deletedLines = impact.deleted.filter((line) => line.count > 0);

  return (
    <main className="adc-page">
      <Link to="/admin" className="adc-back">
        ← Back to admin
      </Link>

      <header className="adc-head">
        <p className="adc-eyebrow">Permanent deletion</p>
        <h1>
          Delete {noun} “{impact.name}”
        </h1>
      </header>

      <div className="adc-warning" role="alert">
        <strong>This cannot be undone.</strong> Deleting this {noun} removes everything in the first list below.
      </div>

      {error && (
        <div className="adc-alert" role="alert">
          {error}
        </div>
      )}

      <div className="adc-grid">
        <section className="adc-card">
          <h2>Will be permanently deleted</h2>
          {deletedLines.length === 0 ? (
            <p className="adc-muted">Only the {noun} itself.</p>
          ) : (
            <ul className="adc-lines">
              {deletedLines.map((line) => (
                <li key={line.label}>
                  <span>{line.label}</span>
                  <strong>{line.count.toLocaleString()}</strong>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="adc-card">
          <h2>Will be kept</h2>
          <ul className="adc-kept">
            {impact.kept.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </section>
      </div>

      {impact.projects.length > 0 && (
        <section className="adc-card">
          <h2>Projects that will be deleted ({impact.projects.length})</h2>
          <ul className="adc-chips">
            {impact.projects.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="adc-card adc-confirm">
        <label htmlFor="adc-confirm">
          Type <strong>{impact.name}</strong> to confirm
        </label>
        <input
          id="adc-confirm"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          disabled={deleting}
        />
        <div className="adc-actions">
          <Link to="/admin" className="adc-btn">
            Cancel
          </Link>
          <button
            type="button"
            className="adc-btn adc-btn-danger"
            disabled={!confirmed || deleting}
            onClick={() => void remove()}
          >
            {deleting ? "Deleting…" : `Delete ${noun} and everything listed`}
          </button>
        </div>
      </section>
    </main>
  );
}