import { useState, type SubmitEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getApiBaseUrl } from "../api/api";
import AuthLayout, { Field, PasswordField, readJson } from "../auth/AuthLayout";

/** Matches the username rules used on the profile page. Change it here if the backend differs. */
const USERNAME_PATTERN = /^[A-Za-z0-9._-]{3,50}$/;
const MIN_PASSWORD = 8;

interface FormState {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  password: string;
  confirm: string;
}

const EMPTY: FormState = {
  firstName: "",
  lastName: "",
  username: "",
  email: "",
  password: "",
  confirm: "",
};

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const update = (key: keyof FormState) => (value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  // Field-level messages appear as the user types, so problems show before submit.
  const username = form.username.trim();
  const usernameError =
    username && !USERNAME_PATTERN.test(username)
      ? "3–50 characters: letters, numbers, dots, dashes or underscores."
      : undefined;
  const passwordError =
    form.password && form.password.length < MIN_PASSWORD
      ? `Use at least ${MIN_PASSWORD} characters.`
      : undefined;
  const confirmError =
    form.confirm && form.confirm !== form.password ? "Passwords do not match." : undefined;

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (usernameError || passwordError || confirmError) {
      setError("Please fix the highlighted fields.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${getApiBaseUrl()}/users/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          username,
          email: form.email.trim(),
          password: form.password,
        }),
      });

      const data = await readJson(response);

      if (!response.ok) {
        setError(String(data.error ?? data.message ?? `Registration failed (HTTP ${response.status}).`));
        return;
      }

      void navigate("/login", { replace: true, state: { registered: true } });
    } catch (err) {
      setError(
        err instanceof TypeError
          ? "Cannot reach the server. Check that the backend is running."
          : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="Get started"
      title="Create your account"
      subtitle="Bring your team and projects together in one place."
      footer={
        <>
          Already have an account? <Link to="/login">Sign in</Link>
        </>
      }
    >
      {error && (
        <p className="au-alert" role="alert">
          {error}
        </p>
      )}

      <form className="au-form" onSubmit={submit}>
        <div className="au-row">
          <Field id="firstName" label="First name">
            <input
              id="firstName"
              required
              autoComplete="given-name"
              placeholder="First name"
              value={form.firstName}
              onChange={(e) => update("firstName")(e.target.value)}
              disabled={loading}
            />
          </Field>
          <Field id="lastName" label="Last name">
            <input
              id="lastName"
              required
              autoComplete="family-name"
              placeholder="Last name"
              value={form.lastName}
              onChange={(e) => update("lastName")(e.target.value)}
              disabled={loading}
            />
          </Field>
        </div>

        <Field
          id="username"
          label="Username"
          error={usernameError}
          hint={usernameError ? undefined : "Used to find you in teams and projects."}
        >
          <input
            id="username"
            required
            autoComplete="username"
            placeholder="Choose a username"
            value={form.username}
            onChange={(e) => update("username")(e.target.value)}
            disabled={loading}
            aria-invalid={Boolean(usernameError) || undefined}
          />
        </Field>

        <Field id="email" label="Email address">
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            value={form.email}
            onChange={(e) => update("email")(e.target.value)}
            disabled={loading}
          />
        </Field>

        <PasswordField
          id="password"
          label="Password"
          value={form.password}
          onChange={update("password")}
          placeholder={`At least ${MIN_PASSWORD} characters`}
          autoComplete="new-password"
          error={passwordError}
          hint={passwordError ? undefined : `At least ${MIN_PASSWORD} characters.`}
          disabled={loading}
        />

        <PasswordField
          id="confirm"
          label="Confirm password"
          value={form.confirm}
          onChange={update("confirm")}
          placeholder="Enter your password again"
          autoComplete="new-password"
          error={confirmError}
          disabled={loading}
        />

        <button type="submit" className="au-submit" disabled={loading}>
          {loading ? "Creating account…" : "Create account →"}
        </button>
      </form>
    </AuthLayout>
  );
}