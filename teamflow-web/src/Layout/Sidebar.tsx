// import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { logout } from "../api/api";
import { isAdmin } from "../auth/roles";
import { useUnreadCount } from "../hooks/UseUnreadCount";
import { useState } from "react";
import ConfirmDialog from "../Components/ConfirmDialog";

interface NavItem {
  to: string;
  label: string;
  icon: string;
  adminOnly?: boolean;
  badge?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: "" },
  { to: "/projects", label: "Projects", icon: "" },
  { to: "/tasks", label: "Tasks", icon: "" },
  { to: "/teams", label: "Teams", icon: "" },
  { to: "/notifications", label: "Notifications", icon: "", badge: true },
  { to: "/admin", label: "Admin", icon: "", adminOnly: true },
];

interface SidebarProps {
  readonly open: boolean;
  readonly onNavigate: () => void;
}

export default function Sidebar({ open, onNavigate }: SidebarProps) {
  const admin = isAdmin();
  const username = localStorage.getItem("username") ?? "";
  const unread = useUnreadCount();
  const items = NAV_ITEMS.filter((item) => !item.adminOnly || admin);

  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  return (
    <aside className={`sb ${open ? "sb-open" : ""}`} aria-label="Main navigation">
      <NavLink to="/dashboard" className="sb-brand" onClick={onNavigate}>
        <span className="sb-brand-mark">T</span>
        <span className="sb-brand-name">
          team<span>flow</span>
        </span>
      </NavLink>

      <p className="sb-section">Workspace</p>
      <nav className="sb-nav">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={({ isActive }) => `sb-link ${isActive ? "is-active" : ""}`}
          >
            <span className="sb-icon" aria-hidden="true">
              {item.icon}
            </span>
            <span className="sb-label">{item.label}</span>
            {item.badge && unread > 0 && (
              <span className="sb-badge" aria-label={`${unread} unread`}>
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="sb-foot">
        <NavLink to="/profile" className="sb-user" onClick={onNavigate} title="View your profile">
          <span className="sb-avatar" aria-hidden="true">
            {(username.charAt(0) || "?").toUpperCase()}
          </span>
          <span className="sb-user-text">
            <strong>{username || "Signed in"}</strong>
            <small>{admin ? "System admin" : "Member"}</small>
          </span>
        </NavLink>
        <button type="button" className="sb-signout" onClick={() => setConfirmingSignOut(true)}>
          Sign out
        </button>
      </div>
      {confirmingSignOut && (
        <ConfirmDialog
          title="Sign out of TeamFlow?"
          message="You'll need to sign in again to see your teams, projects and tasks."
          confirmLabel="Sign out"
          busy={signingOut}
          onCancel={() => setConfirmingSignOut(false)}
          onConfirm={async () => {
            setSigningOut(true);
            await logout();
          }}
        />
      )}
    </aside>
  );
}