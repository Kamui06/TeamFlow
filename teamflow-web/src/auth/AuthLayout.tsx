import { useState, type ReactNode } from "react";
import "./Auth.css";

const FEATURES = [
  { title: "Projects and tasks", text: "Plan work, assign people and follow progress in one place." },
  { title: "Clear roles", text: "Owners, admins, members and viewers each see what they need." },
  { title: "Stay informed", text: "Get notified about assignments, deadlines and comments." },
];

/** Reads a response body as an object, whether it is JSON or plain text. */
export async function readJson(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  if (!text.trim()) return {};
  try {
    const parsed: unknown = JSON.parse(text);
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : { message: text };
  } catch {
    return { message: text };
  }
}

export function BrandMark() {
  return (
    <span className="au-logo-mark" aria-hidden="true">
      T
    </span>
  );
}

interface FieldProps {
  readonly id: string;
  readonly label: string;
  readonly hint?: string;
  readonly error?: string;
  readonly children: ReactNode;
}

export function Field({ id, label, hint, error, children }: FieldProps) {
  let helperText: ReactNode = null;
  if (error) {
    helperText = <small className="au-hint is-error">{error}</small>;
  } else if (hint) {
    helperText = <small className="au-hint">{hint}</small>;
  }

  return (
    <div className="au-field">
      <label htmlFor={id}>{label}</label>
      {children}
      {helperText}
    </div>
  );
}

interface PasswordFieldProps {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly placeholder: string;
  readonly autoComplete: string;
  readonly hint?: string;
  readonly error?: string;
  readonly disabled?: boolean;
}

export function PasswordField({
  id,
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
  hint,
  error,
  disabled,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <Field id={id} label={label} hint={hint} error={error}>
      <div className="au-input-wrap">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required
          disabled={disabled}
          aria-invalid={Boolean(error) || undefined}
        />
        <button
          type="button"
          className="au-toggle"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          disabled={disabled}
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
    </Field>
  );
}

interface AuthLayoutProps {
  readonly eyebrow: string;
  readonly title: string;
  readonly subtitle: string;
  readonly footer: ReactNode;
  readonly children: ReactNode;
}

export default function AuthLayout({ eyebrow, title, subtitle, footer, children }: AuthLayoutProps) {
  return (
    <div className="au-shell">
      <aside className="au-brand">
        <div className="au-logo">
          <BrandMark />
          <span>teamflow</span>
        </div>

        <div>
          <h2>
            Plan together.
            <br />
            Deliver on time.
          </h2>
          <p className="au-lead">One workspace for your teams, projects and tasks.</p>
        </div>

        <ul className="au-features">
          {FEATURES.map((f) => (
            <li key={f.title}>
              <span className="au-feature-text">
                <strong>{f.title}</strong>
                <span>{f.text}</span>
              </span>
            </li>
          ))}
        </ul>
      </aside>

      <main className="au-main">
        <div className="au-card">
          <div className="au-mobile-logo">
            <BrandMark />
            <span>teamflow</span>
          </div>

          <p className="au-eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="au-subtitle">{subtitle}</p>

          {children}

          <p className="au-footer">{footer}</p>
        </div>
      </main>
    </div>
  );
}