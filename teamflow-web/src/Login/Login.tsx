import { useState, type SubmitEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getApiBaseUrl, saveSession } from "../api/api";
import AuthLayout, { Field, PasswordField, readJson } from "../auth/AuthLayout";

interface LocationState {
  readonly registered?: boolean;
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const justRegistered = Boolean((location.state as LocationState | null)?.registered);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${getApiBaseUrl()}/users/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await readJson(response);

      if (!response.ok) {
        const errorMessage =
          (typeof data.error === "string" && data.error) ||
          (typeof data.message === "string" && data.message) ||
          `Sign-in failed (HTTP ${response.status}).`;
        setError(errorMessage);
        return;
      }

      const token = typeof data.accessToken === "string" ? data.accessToken : null;
      if (!token) {
        setError("Signed in, but no session was returned. Please try again.");
        return;
      }

      saveSession({
        accessToken: token,
        role: typeof data.role === "string" ? data.role : undefined,
        username: typeof data.username === "string" ? data.username : undefined,
      });

      void navigate("/dashboard", { replace: true });
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
      eyebrow="Welcome back"
      title="Sign in to your workspace"
      subtitle="Pick up where you left off with your teams and projects."
      footer={
        <>
          New to TeamFlow? <Link to="/register">Create an account</Link>
        </>
      }
    >
      {justRegistered && !error && (
        <output className="au-notice">
          Account created. Sign in to continue.
        </output>
      )}

      {error && (
        <p className="au-alert" role="alert">
          {error}
        </p>
      )}

      <form className="au-form" onSubmit={submit}>
        <Field id="email" label="Email address">
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          />
        </Field>

        <PasswordField
          id="password"
          label="Password"
          value={password}
          onChange={setPassword}
          placeholder="Enter your password"
          autoComplete="current-password"
          disabled={loading}
        />

        <button type="submit" className="au-submit" disabled={loading}>
          {loading ? "Signing in…" : "Sign in →"}
        </button>
      </form>
    </AuthLayout>
  );
}