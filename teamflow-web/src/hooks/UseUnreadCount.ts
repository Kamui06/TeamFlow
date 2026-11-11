import { useEffect, useState } from "react";
import { isAbortError } from "../api/api";
import { NOTIFICATIONS_CHANGED, notificationService } from "../services/NotificationService";

const POLL_MS = 60_000;
const MIN_GAP_MS = 5_000;

// Unread notification count for the sidebar. Polls once a minute while the tab is visible. 
export function useUnreadCount(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let lastStarted = 0;
    let current: AbortController | null = null;
    let timer: number | undefined;

    const load = (force: boolean) => {
      if (document.visibilityState !== "visible") return;
      if (current) return;

      const now = Date.now();
      if (!force && now - lastStarted < MIN_GAP_MS) return;
      lastStarted = now;

      const controller = new AbortController();
      current = controller;

      notificationService
        .unreadCount(controller.signal)
        .then((result) => setCount(result.count))
        .catch((err: unknown) => {
          // Keep the last known count. The next poll tries again.
          if (!isAbortError(err)) return;
        })
        .finally(() => {
          if (current === controller) current = null;
        });
    };

    const startPolling = () => {
      window.clearInterval(timer);
      timer = window.setInterval(() => load(false), POLL_MS);
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        load(true);
        startPolling();
      } else {
        window.clearInterval(timer);
      }
    };

    const onChanged = () => load(true);

    load(true);
    startPolling();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener(NOTIFICATIONS_CHANGED, onChanged);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener(NOTIFICATIONS_CHANGED, onChanged);
      current?.abort();
    };
  }, []);

  return count;
}