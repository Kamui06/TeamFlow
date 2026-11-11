import { useEffect, useState } from "react";
import { teamService } from "../services/TeamService";
import type { AssignableTeamRole, Team, UserSummary } from "../services/TeamService";
import { isAbortError } from "../api/api";
import "./AddMemberModal.css";

interface AddMemberModalProps {
  readonly team: Team;
  readonly onClose: () => void;
  readonly onAdded: () => void;
}

const messageOf = (err: unknown) =>
  err instanceof Error ? err.message : "Something went wrong. Please try again.";

export default function AddMemberModal({ team, onClose, onAdded }: AddMemberModalProps) {
  const canGrantAdmin = team.myRole === "OWNER";

  const [query, setQuery] = useState("");
  const [role, setRole] = useState<AssignableTeamRole>("MEMBER");
  const [results, setResults] = useState<UserSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [addedNames, setAddedNames] = useState<string[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  // Debounced search. Runs on open (empty query) and whenever the query or a successful add changes.
  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setSearching(true);
      teamService
        .getAddableUsers(team.id, query.trim())
        .then((users) => {
          if (!cancelled) setResults(users);
        })
        .catch((err: unknown) => {
          if (!cancelled) setError(messageOf(err));
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [team.id, query, refreshKey]);

  const add = async (user: UserSummary) => {
    setBusyId(user.id);
    setError("");
    try {
      await teamService.addMember(team.id, user.id, role);
      setAddedNames((names) => [...names, user.username]);
      setRefreshKey((k) => k + 1);
      onAdded();
    } catch (err) {
      if (isAbortError(err)) return;
      setError(err instanceof Error ? err.message : "Unable to load");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="add-member-backdrop">
      <dialog open className="add-member-modal" aria-labelledby="add-member-title">
        <h2 id="add-member-title">Add member to {team.name}</h2>
        <p className="add-member-subtle">
          Search by username. Only users who are not yet in this team appear.
        </p>

        <label className="add-member-field">
          <span>Role for new members</span>
          <select value={role} onChange={(e) => setRole(e.target.value as AssignableTeamRole)}>
            <option value="MEMBER">Member: can view and create tasks</option>
            <option value="VIEWER">Viewer: read-only</option>
            {canGrantAdmin && <option value="ADMIN">Admin: can assign tasks and manage members</option>}
          </select>
        </label>

        <label className="add-member-field">
          <span>Search users</span>
          <input
            type="search"
            autoFocus
            placeholder="Type a username…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>

        {error && (
          <p className="add-member-error" role="alert">
            {error}
          </p>
        )}

        {addedNames.length > 0 && (
          <output className="add-member-added">
            Added: {addedNames.join(", ")}
          </output>
        )}

        <ul className="add-member-list" aria-busy={searching}>
          {!searching && results.length === 0 && (
            <li className="add-member-empty">
              {query.trim() ? "No matching users outside this team." : "Everyone is already in this team."}
            </li>
          )}

          {results.map((user) => (
            <li key={user.id} className="add-member-row">
              <div className="add-member-name">
                <strong>{user.username}</strong>
                {(user.firstName || user.lastName) && (
                  <small>{[user.firstName, user.lastName].filter(Boolean).join(" ")}</small>
                )}
              </div>
              <button
                type="button"
                className="team-btn team-btn-primary"
                disabled={busyId !== null}
                onClick={() => void add(user)}
              >
                {busyId === user.id ? "Adding…" : "Add"}
              </button>
            </li>
          ))}
        </ul>

        <div className="add-member-actions">
          <button type="button" className="team-btn team-btn-secondary" onClick={onClose}>
            Done
          </button>
        </div>
      </dialog>
    </div>
  );
}
