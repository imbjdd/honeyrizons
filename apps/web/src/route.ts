import { useCallback, useEffect, useState } from "react";
import type { AnalyticsDashboardPage } from "@/components/analytics-dashboard/context";

const PATHS: Record<AnalyticsDashboardPage, string> = {
  overview: "/",
  city: "/city",
  services: "/services",
  sessions: "/sessions",
  settings: "/settings",
};

function pageFromPath(pathname: string): AnalyticsDashboardPage {
  const path = pathname.replace(/\/+$/, "") || "/";
  const match = (Object.keys(PATHS) as AnalyticsDashboardPage[]).find((page) => PATHS[page] === path);
  return match ?? "overview";
}

/** Keeps the dashboard page in the URL, so pages can be linked, bookmarked and navigated with back/forward. */
export function usePageRoute() {
  const [page, setPage] = useState(() => pageFromPath(window.location.pathname));

  useEffect(() => {
    // Old links (e.g. /dashboard) land on the page they resolve to, with a canonical URL.
    const canonical = PATHS[pageFromPath(window.location.pathname)];
    if (window.location.pathname !== canonical) window.history.replaceState(null, "", canonical);
    const onPop = () => setPage(pageFromPath(window.location.pathname));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = useCallback((next: AnalyticsDashboardPage) => {
    setPage(next);
    if (window.location.pathname !== PATHS[next]) window.history.pushState(null, "", PATHS[next]);
  }, []);

  return [page, navigate] as const;
}
