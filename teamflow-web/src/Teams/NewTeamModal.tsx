import { useState, type SyntheticEvent } from "react";
import Dialog from "../Components/Dialog";
import { teamService } from "../services/TeamService";

interface NewTeamModalProps {
  readonly onClose: () => void;
  readonly onCreated: () => void;
}

export default function NewTeamModal({ onClose, onCreated }: NewTeamModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setError("Please enter a team name.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await teamService.createTeam({
        name: cleanName,
        description: description.trim() || undefined,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create the team. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      eyebrow="New team"
      title="Create a team"
      onClose={onClose}
      locked={saving}
      footer={
        <>
          <button type="button" className="dlg-btn" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            type="submit"
            form="new-team-form"
            className="dlg-btn dlg-btn-primary"
            disabled={saving || !name.trim()}
          >
            {saving ? "Creating…" : "Create team"}
          </button>
        </>
      }
    >
      <form id="new-team-form" className="dlg-form" onSubmit={submit}>
        <label className="dlg-field">
          <span>Team name</span>
          <input
            required
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Product & Design"
            disabled={saving}
          />
        </label>

        <label className="dlg-field">
          <span>Description (optional)</span>
          <textarea
            rows={3}
            maxLength={500}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does this team work on?"
            disabled={saving}
          />
        </label>

        {error && (
          <p className="dlg-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </Dialog>
  );
}