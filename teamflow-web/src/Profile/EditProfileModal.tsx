import { useState, type ChangeEvent, type SyntheticEvent } from "react";
import Dialog from "../Components/Dialog";
import { profileService, type Profile, type ProfileUpdate } from "../services/ProfileService";
import "./EditProfileModal.css";

interface EditProfileModalProps {
  readonly profile: Profile;
  readonly onClose: () => void;
  readonly onSaved: (profile: Profile) => void;
}

const BIO_MAX = 500;

export default function EditProfileModal({ profile, onClose, onSaved }: EditProfileModalProps) {
  const [form, setForm] = useState<ProfileUpdate>({
    username: profile.username,
    email: profile.email,
    firstName: profile.firstName ?? "",
    lastName: profile.lastName ?? "",
    bio: profile.bio ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set =
    (key: keyof ProfileUpdate) =>
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const canSave = form.username.trim().length >= 3 && form.email.trim().length > 0;

  const submit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const saved = await profileService.updateProfile({
        username: form.username.trim(),
        email: form.email.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        bio: form.bio.trim(),
      });
      localStorage.setItem("username", saved.username);
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      eyebrow="Your profile"
      title="Edit profile"
      onClose={onClose}
      locked={saving}
      footer={
        <>
          <button type="button" className="dlg-btn" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            type="submit"
            form="edit-profile-form"
            className="dlg-btn dlg-btn-primary"
            disabled={saving || !canSave}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </>
      }
    >
      <form id="edit-profile-form" className="dlg-form" onSubmit={submit}>
        <div className="dlg-row">
          <label className="dlg-field">
            <span>First name</span>
            <input maxLength={100} value={form.firstName} onChange={set("firstName")} disabled={saving} />
          </label>
          <label className="dlg-field">
            <span>Last name</span>
            <input maxLength={100} value={form.lastName} onChange={set("lastName")} disabled={saving} />
          </label>
        </div>

        <label className="dlg-field">
          <span>Username</span>
          <input
            required
            minLength={3}
            maxLength={50}
            value={form.username}
            onChange={set("username")}
            disabled={saving}
          />
          <small className="dlg-hint">Letters, numbers, dots, dashes and underscores.</small>
        </label>

        <label className="dlg-field">
          <span>Email address</span>
          <input
            required
            type="email"
            maxLength={100}
            value={form.email}
            onChange={set("email")}
            disabled={saving}
          />
        </label>

        <label className="dlg-field">
          <span>Bio</span>
          <textarea
            rows={4}
            maxLength={BIO_MAX}
            value={form.bio}
            onChange={set("bio")}
            placeholder="A line or two about you (optional)"
            disabled={saving}
          />
          <small className="dlg-hint ep-count">
            {form.bio.length}/{BIO_MAX}
          </small>
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