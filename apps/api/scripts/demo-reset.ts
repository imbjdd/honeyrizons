// Takes the city back to before the planner touched it, so a demo can start from no lures and replay its growth.
// Removes lure decisions and the lure services' own lines from the chronicle, and empties the annex. Everything else
// (the city's history, the analyst's verdicts, the traffic) stays. Run it with the API stopped: it rewrites its store.
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { LURES, lureServiceKey, type ChronicleEvent } from "@honeyrizons/shared";

const LOG_PATH = resolve(process.env.LOG_PATH ?? join(import.meta.dir, "../../../logs/beelzebub.log"));
const INTEL_PATH = resolve(process.env.INTEL_PATH ?? join(dirname(LOG_PATH), "intel.json"));
const CHRONICLE_PATH = resolve(process.env.CHRONICLE_PATH ?? join(dirname(INTEL_PATH), "chronicle.json"));
const ANNEX_DIR = resolve(process.env.ANNEX_DIR ?? join(import.meta.dir, "../../honeypot/config/annex"));

const lureKeys = new Set(LURES.map(lureServiceKey));
const isLure = (e: ChronicleEvent) =>
  e.type.startsWith("lure.") || ("key" in e && typeof e.key === "string" && lureKeys.has(e.key));

if (existsSync(CHRONICLE_PATH)) {
  const store = JSON.parse(readFileSync(CHRONICLE_PATH, "utf8")) as { version: number; events: ChronicleEvent[] };
  const before = store.events.length;
  store.events = store.events.filter((e) => !isLure(e));
  writeFileSync(CHRONICLE_PATH, JSON.stringify(store));
  console.log(`chronicle: removed ${before - store.events.length} lure events from ${CHRONICLE_PATH}`);
}
if (existsSync(ANNEX_DIR)) {
  const files = readdirSync(ANNEX_DIR).filter((f) => /\.ya?ml$/.test(f));
  for (const f of files) rmSync(join(ANNEX_DIR, f));
  console.log(`annex: removed ${files.length} lure configs from ${ANNEX_DIR}`);
}
