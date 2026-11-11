import { useState, type SyntheticEvent } from "react";
import Dialog from "../Components/Dialog";
import { projectService } from "../services/ProjectService";
import type { Team } from "../services/TeamService";
import ProjectDateFields from "./ProjectDateFields";
import { dueDateError, todayKey } from "./ProjectDates";

interface NewProjectModalProps {
  readonly teams: Team[];
  readonly onClose: () => void;
  readonly onCreated: (name: string) => void;
}

export default function NewProjectModal({ teams, onClose, onCreated }: NewProjectModalProps) {
  const [teamId, setTeamId] = useState(teams.length === 1 ? String(teams[0].id) : "");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!teamId) return setError("Choose a team.");
    if (!cleanName) return setError("Enter a project name.");

    // The start date is today, so the due date only needs to be today or later.
    const dateProblem = dueDateError(dueDate, todayKey());
    if (dateProblem) return setError(dateProblem);

    setSaving(true);
    setError("");
    try {
      await projectService.createProject({
        name: cleanName,
        description: description.trim() || undefined,
        teamId: Number(teamId),
        endDate: dueDate || undefined,
      });
      onCreated(cleanName);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create project");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      eyebrow="New project"
      title="Start a project"
      onClose={onClose}
      locked={saving}
      footer={
        <>
          <button type="button" className="dlg-btn" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="new-project-form" className="dlg-btn dlg-btn-primary" disabled={saving}>
            {saving ? "Creating…" : "Create project"}
          </button>
        </>
      }
    >
      <form id="new-project-form" className="dlg-form" onSubmit={submit}>
        <label className="dlg-field">
          <span>Team</span>
          <select value={teamId} onChange={(e) => setTeamId(e.target.value)} disabled={saving}>
            <option value="">Select a team</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>

        <label className="dlg-field">
          <span>Name</span>
          <input
            required
            maxLength={150}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Website redesign"
            disabled={saving}
          />
        </label>

        <label className="dlg-field">
          <span>Description</span>
          <textarea
            rows={3}
            maxLength={500}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this project about? (optional)"
            disabled={saving}
          />
        </label>

        <ProjectDateFields
          isNew
          startDate={null}
          dueDate={dueDate}
          onDueChange={setDueDate}
          disabled={saving}
        />

        {error && (
          <p className="dlg-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </Dialog>
  );
}