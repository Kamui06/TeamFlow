import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminOverview from "./AdminOverview";
import AdminUsers from "./AdminUsers";
import AdminTeams from "./AdminTeams";
import AdminProjects from "./AdminProjects";
import AdminComments from "./AdminComments";
import "./AdminPage.css";

type Tab = "overview" | "users" | "teams" | "projects" | "comments";

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "users", label: "Users" },
  { key: "teams", label: "Teams" },
  { key: "projects", label: "Projects" },
  { key: "comments", label: "Comments" },
];

export default function AdminPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <main className="admin-page">
      <header className="admin-header">
        <div>
          <p className="admin-eyebrow">System administration</p>
          <h1>Admin</h1>
        </div>
        <button type="button" className="admin-btn admin-btn-secondary" onClick={() => navigate("/dashboard")}>
          Back to dashboard
        </button>
      </header>

      <nav className="admin-tabs" aria-label="Admin sections">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`admin-tab ${tab === t.key ? "active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "overview" && <AdminOverview />}
      {tab === "users" && <AdminUsers />}
      {tab === "teams" && <AdminTeams />}
      {tab === "projects" && <AdminProjects />}
      {tab === "comments" && <AdminComments />}
    </main>
  );
}