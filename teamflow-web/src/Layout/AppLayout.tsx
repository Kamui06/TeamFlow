import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import "./AppLayout.css";

const TITLES: [prefix: string, title: string][] = [
  ["/admin", "Administration"],
  ["/projects", "Projects"],
  ["/tasks", "Tasks"],
  ["/teams", "Teams"],
  ["/notifications", "Notifications"],
  ["/dashboard", "Dashboard"],
  ["/profile", "My profile"],
];

function titleFor(pathname: string) {
  return TITLES.find(([prefix]) => pathname.startsWith(prefix))?.[1] ?? "TeamFlow";
}

export default function AppLayout() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  // Close the mobile menu whenever the page changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="app-shell">
      <Sidebar open={open} onNavigate={() => setOpen(false)} />
      <div
        className={`app-scrim ${open ? "is-visible" : ""}`}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
      <Navbar title={titleFor(pathname)} onMenu={() => setOpen((o) => !o)} />
      <div className="app-content">
        <Outlet />
      </div>
    </div>
  );
}