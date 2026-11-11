import { lazy, Suspense, useEffect, type ReactNode } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { startSessionKeepAlive } from "./api/api";
import { RouteScope } from "./api/routeScope";
import { isAdmin } from "./auth/roles";
import AppLayout from "./Layout/AppLayout";
import AdminDeleteConfirm from "./Admin/AdminDeleteConfirm";
import Login from "./Login/Login";
import Register from "./Register/Register";

const Dashboard = lazy(() => import("./Dashboard/Dashboard"));
const ProjectsList = lazy(() => import("./Projects/ProjectList"));
const ProjectDetail = lazy(() => import("./Projects/ProjectDetails"));
const TeamList = lazy(() => import("./Teams/TeamList"));
const TaskPage = lazy(() => import("./Tasks/TaskPage"));
const TaskDetail = lazy(() => import("./Tasks/TaskDetails"));
const ProfilePage = lazy(() => import("./Profile/ProfilePage"));
const NotificationPage = lazy(() => import("./Notifications/NotificationPage"));
const AdminPage = lazy(() => import("./Admin/AdminPage"));
const AdminUserDetail = lazy(() => import("./Admin/AdminUserDetail"));
const AdminTeamDetail = lazy(() => import("./Admin/AdminTeamDetail"));
const AdminProjectDetail = lazy(() => import("./Admin/AdminProjectDetail"));

/** Shows a light message while a page's code is downloaded. The sidebar stays visible. */
function Page({ children }: Readonly<{ children: ReactNode }>) {
  return <Suspense fallback={<p className="app-loading">Loading…</p>}>{children}</Suspense>;
}

function RequireAdmin({ children }: Readonly<{ children: ReactNode }>) {
  return isAdmin() ? <>{children}</> : <Navigate to="/dashboard" replace />;
}

function App() {
  useEffect(() => startSessionKeepAlive(), []);

  return (
    <BrowserRouter>
      <RouteScope>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<Page><Dashboard /></Page>} />

            <Route path="/projects" element={<Page><ProjectsList /></Page>} />
            <Route path="/projects/:projectId" element={<Page><ProjectDetail /></Page>} />
            <Route path="/projects/:projectId/tasks" element={<Page><TaskPage /></Page>} />

            <Route path="/tasks" element={<Page><TaskPage /></Page>} />
            <Route path="/tasks/:taskId" element={<Page><TaskDetail /></Page>} />

            <Route path="/teams" element={<Page><TeamList /></Page>} />
            <Route path="/notifications" element={<Page><NotificationPage /></Page>} />
            <Route path="/profile" element={<Page><ProfilePage /></Page>} />
            <Route path="/users/:userId" element={<Page><ProfilePage /></Page>} />

            <Route
              path="/admin"
              element={<Page><RequireAdmin><AdminPage /></RequireAdmin></Page>}
            />
            <Route path="/admin/users" element={<Navigate to="/admin" replace />} />
            <Route
              path="/admin/users/:userId"
              element={<Page><RequireAdmin><AdminUserDetail /></RequireAdmin></Page>}
            />
            <Route
              path="/admin/teams/:teamId"
              element={<Page><RequireAdmin><AdminTeamDetail /></RequireAdmin></Page>}
            />
            <Route
              path="/admin/projects/:projectId"
              element={<Page><RequireAdmin><AdminProjectDetail /></RequireAdmin></Page>}
            />

            <Route
              path="/admin/teams/:teamId/delete"
              element={
                <Page>
                  <RequireAdmin>
                    <AdminDeleteConfirm kind="team" />
                  </RequireAdmin>
                </Page>
              }
            />
            <Route
              path="/admin/projects/:projectId/delete"
              element={
                <Page>
                  <RequireAdmin>
                    <AdminDeleteConfirm kind="project" />
                  </RequireAdmin>
                </Page>
              }
            />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </RouteScope>
    </BrowserRouter>
  );
}

export default App;