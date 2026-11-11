import { useState, type SubmitEvent } from "react";
import Dialog from "../Components/Dialog";
import {
  teamService,
  type AssignableTeamRole,
  type Team,
  type TeamMember,
} from "../services/TeamService";
import "./TeamModals.css";

const ROLES: AssignableTeamRole[] = ["ADMIN", "MEMBER", "VIEWER"];

const fullName = (m: TeamMember) => [m.firstName, m.lastName].filter(Boolean).join(" ");
const initialOf = (text: string) => text.trim().charAt(0).toUpperCase() || "?";

// ---------- Edit team ----------

interface EditTeamModalProps {
  readonly team: Team;
  readonly onClose: () => void;
  readonly onSaved: () => void;
}

export function EditTeamModal({ team, onClose, onSaved }: EditTeamModalProps) {
  const [name, setName] = useState(team.name);
  const [description, setDescription] = useState(team.description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) return setError("Team name is required.");

    setSaving(true);
    setError("");
    try {
      await teamService.updateTeam(team.id, { name: cleanName, description: description.trim() });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the team.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      eyebrow="Edit team"
      title={team.name}
      onClose={onClose}
      locked={saving}
      footer={
        <>
          <button type="button" className="dlg-btn" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            type="submit"
            form="edit-team-form"
            className="dlg-btn dlg-btn-primary"
            disabled={saving || !name.trim()}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </>
      }
    >
      <form id="edit-team-form" className="dlg-form" onSubmit={submit}>
        <label className="dlg-field">
          <span>Team name</span>
          <input
            required
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={saving}
          />
        </label>

        <label className="dlg-field">
          <span>Description</span>
          <textarea
            rows={4}
            maxLength={500}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does this team work on? (optional)"
            disabled={saving}
          />
          <small className="dlg-hint">{description.length}/500</small>
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

// ---------- Manage members ----------

interface ManageMembersModalProps {
  readonly team: Team;
  readonly onClose: () => void;
  readonly onChanged: () => void;
}

export function ManageMembersModal({ team, onClose, onChanged }: ManageMembersModalProps) {
  const [members, setMembers] = useState<TeamMember[]>(team.members ?? []);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Reload from the server after each change so the list matches the database.
  const reload = async () => {
    const fresh = await teamService.getTeamById(team.id);
    setMembers(fresh.members ?? []);
    onChanged();
  };

  const run = async (userId: number, action: () => Promise<unknown>, success: string) => {
    setBusyId(userId);
    setError("");
    setNotice("");
    try {
      await action();
      await reload();
      setNotice(success);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That change could not be saved.");
    } finally {
      setBusyId(null);
    }
  };

  const changeRole = (m: TeamMember, role: AssignableTeamRole) =>
    run(m.userId, () => teamService.changeMemberRole(team.id, m.userId, role), `${m.username} is now ${role}.`);

  const removeMember = (m: TeamMember) => {
    if (!window.confirm(`Remove ${m.username} from ${team.name}?`)) return;
    void run(m.userId, () => teamService.removeMember(team.id, m.userId), `${m.username} was removed.`);
  };

  return (
    <Dialog
      eyebrow={`${members.length} ${members.length === 1 ? "member" : "members"}`}
      title={`Members of ${team.name}`}
      onClose={onClose}
      locked={busyId !== null}
      footer={
        <button type="button" className="dlg-btn dlg-btn-primary" onClick={onClose}>
          Done
        </button>
      }
    >
      {notice && (
        <output className="tm-notice">{notice}</output>
      )}
      {error && (
        <p className="dlg-error" role="alert">
          {error}
        </p>
      )}

      <ul className="tm-list">
        {members.map((m) => {
          const busy = busyId === m.userId;
          const isOwner = m.role === "OWNER";

          return (
            <li key={m.userId} className="tm-row">
              <div className="tm-person">
                <span className="tm-avatar" aria-hidden="true">
                  {initialOf(m.username)}
                </span>
                <div className="tm-person-text">
                  <strong>{m.username}</strong>
                  {fullName(m) && <span>{fullName(m)}</span>}
                </div>
              </div>

              <div className="tm-controls">
                {isOwner ? (
                  <span className="tm-owner">Owner</span>
                ) : (
                  <>
                    <select
                      className="tm-select"
                      aria-label={`Role for ${m.username}`}
                      value={m.role}
                      disabled={busy}
                      onChange={(e) => void changeRole(m, e.target.value as AssignableTeamRole)}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r.charAt(0) + r.slice(1).toLowerCase()}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="tm-remove"
                      disabled={busy}
                      onClick={() => removeMember(m)}
                    >
                      Remove
                    </button>
                  </>
                )}
              </div>
            </li>
          );
        })}

        {members.length === 0 && <li className="tm-empty">No members yet.</li>}
      </ul>
    </Dialog>
  );
}