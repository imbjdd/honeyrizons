import { useCallback, useEffect, useState } from "react";
import { lureById, type PlannerSnapshot } from "@honeyrizons/shared";
import { formatCount } from "@/components/analytics-dashboard/ui";
import type { BuildingId } from "./explore";
import { buildingForAddress } from "./model";
import type { LureSite } from "./useCityActivity";

const POLL_MS = 20_000;

/** The planner's current suggestions. */
function usePlanner(version: string) {
  const [snapshot, setSnapshot] = useState<PlannerSnapshot | null>(null);
  const load = useCallback(
    () =>
      fetch("/api/planner")
        .then((r) => (r.ok ? r.json() : null))
        .then((s: PlannerSnapshot | null) => setSnapshot(s))
        .catch(() => {}),
    [],
  );
  // A lure opening or closing changes what is suggested, so reload on every change as well as on a timer.
  useEffect(() => {
    void load();
    const timer = window.setInterval(load, POLL_MS);
    return () => window.clearInterval(timer);
  }, [version, load]);
  return { snapshot, reload: load };
}

/** "Logins as postgres from 54 addresses" → "Logins as postgres · 54 IPs". */
const short = (d: PlannerSnapshot["demand"][number]) => `${d.signals[0]} · ${d.ips} IP${d.ips === 1 ? "" : "s"}`;

/**
 * What the planner suggests building, with an Apply button each, and the lures standing with what they caught. In
 * propose mode the operator can close a standing lure too.
 */
export function CityPlanner({
  lures,
  focus,
  announce,
}: {
  lures: LureSite[];
  focus: (building: BuildingId) => void;
  announce: (text: string) => void;
}) {
  const standing = lures.filter((l) => l.state.status !== "retired");
  const { snapshot, reload } = usePlanner(standing.map((l) => `${l.blueprint.id}:${l.state.status}`).join());
  const [busy, setBusy] = useState<string | null>(null);

  const propose = snapshot?.mode === "propose";
  const suggested = propose ? snapshot.demand.filter((d) => d.suggested) : [];
  const capacity = snapshot?.capacity ?? 4;
  if (suggested.length === 0 && standing.length === 0) return null;

  const act = async (action: "apply" | "close", lure: string) => {
    setBusy(lure);
    try {
      const res = await fetch(`/api/planner/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lure }),
      });
      const result = (await res.json()) as { error?: string };
      if (result.error) announce(result.error);
      const building = buildingForAddress(lureById(lure)?.address ?? "");
      if (res.ok && building) focus(building);
    } catch {
      announce("Could not reach the planner.");
    } finally {
      setBusy(null);
      void reload();
    }
  };

  return (
    <section className="city-panel city-planner" aria-label="City planner">
      <header className="city-planner-head">
        <span className="ai-label">City planner</span>
        <span>
          {standing.length}/{capacity} lures
        </span>
      </header>

      <ol>
        {suggested.map((d) => (
          <li key={d.lure} className="city-planner-row">
            <button type="button" className="city-planner-text" onClick={() => focusLure(d.lure, focus)}>
              <span>{lureById(d.lure)?.name}</span>
              <small>{short(d)}</small>
            </button>
            <button
              type="button"
              className="btn btn-primary press city-planner-apply"
              disabled={standing.length >= capacity || busy !== null}
              onClick={() => void act("apply", d.lure)}
            >
              {busy === d.lure ? "…" : "Apply"}
            </button>
          </li>
        ))}
        {standing.map(({ blueprint, building, state, caught }) => (
          <li key={blueprint.id} className="city-planner-row" data-status={state.status}>
            <button type="button" className="city-planner-text" onClick={() => focus(building)}>
              <span>
                <i aria-hidden="true" />
                {blueprint.name}
              </span>
              <small>{state.status === "planned" ? "Building…" : `${formatCount(caught)} caught`}</small>
            </button>
            {propose && (
              <button
                type="button"
                className="btn press city-planner-apply"
                disabled={busy !== null}
                onClick={() => void act("close", blueprint.id)}
              >
                {busy === blueprint.id ? "…" : "Close"}
              </button>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

function focusLure(id: string, focus: (building: BuildingId) => void) {
  const building = buildingForAddress(lureById(id)?.address ?? "");
  if (building) focus(building);
}
