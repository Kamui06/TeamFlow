import { useEffect, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

// One controller per page. Created before the first request, replaced only on navigation.
let controller = new AbortController();
let currentPath = typeof window !== "undefined" ? window.location.pathname : "";

// Signal for reads made by the page currently on screen. 
export function pageSignal(): AbortSignal {
  return controller.signal;
}

/*
    Aborts reads from the previous page when the path changes.
    The first render never aborts, so a page reload's requests complete normally.
*/
export function RouteScope({ children }: Readonly<{ children: ReactNode }>) {
  const location = useLocation();

  useEffect(() => {
    if (location.pathname === currentPath) return;
    currentPath = location.pathname;
    controller.abort();
    controller = new AbortController();
  }, [location.pathname]);

  return <>{children}</>;
}