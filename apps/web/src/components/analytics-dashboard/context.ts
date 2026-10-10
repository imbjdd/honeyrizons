import { createContext, useContext } from "react";
import type { IntelSnapshot } from "@honeyrizons/shared";
import type { AnalyticsDashboardData } from "./data";

export type AnalyticsDashboardPage = "overview" | "city" | "services" | "sessions" | "settings";

export type AnalyticsDashboardAccent = "blue" | "violet" | "teal" | "amber";

export const ACCENTS: Record<AnalyticsDashboardAccent, { label: string; ui: string }> = {
  blue: { label: "Blue", ui: "#4c9bff" },
  violet: { label: "Violet", ui: "#9d8df5" },
  teal: { label: "Teal", ui: "#2fd0b5" },
  amber: { label: "Amber", ui: "#f2b54a" },
};

export type AnalyticsDashboardStatus = {
  connected: boolean;
  logPath?: string;
  totalEvents: number;
  /** Where the honeypot sits on the map. */
  home: { lat: number; lon: number };
};

type DashboardState = {
  data: AnalyticsDashboardData;
  status: AnalyticsDashboardStatus;
  /** Automatic triage results from the analyst agent, keyed by session. */
  intel: IntelSnapshot;
  now: number;
  /** Prefix for element ids, unique per dashboard instance. */
  uid: string;
  selected: string | null;
  openSession: (key: string) => void;
  navigate: (page: AnalyticsDashboardPage) => void;
  accent: AnalyticsDashboardAccent;
  setAccent: (accent: AnalyticsDashboardAccent) => void;
};

export const DashboardContext = createContext<DashboardState | null>(null);

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboard must be used inside <AnalyticsDashboard>");
  return ctx;
}
