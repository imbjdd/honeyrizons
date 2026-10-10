import { type HoneypotEvent, type HoneypotService, protocolColor, sourceIp } from "@honeyrizons/shared";

export type AnalyticsRange = { id: RangeId; label: string; caption: string };

export type RangeId = "hour" | "day" | "week";

export type AnalyticsKpiIcon = "events" | "attackers" | "sessions" | "creds";

export type AnalyticsKpi = {
  id: string;
  label: string;
  icon: AnalyticsKpiIcon;
  value: string;
  /** Percent change against the previous period of the same length. */
  delta: number;
  spark: number[];
};

export type AnalyticsProtocol = { id: string; color: string };

export type AnalyticsActivity = {
  labels: string[];
  /** Events per label, keyed by protocol. */
  series: Record<string, number[]>;
};

export type AnalyticsAttacker = {
  ip: string;
  color: string;
  events: number;
  sessions: number;
  creds: number;
  commands: number;
};

export type AnalyticsService = HoneypotService & {
  events: number;
  ips: number;
  lastSeen: number | null;
  /** Events per hour over the last 24 hours, oldest first. */
  activity: number[];
};

export type AnalyticsSessionStatus = { kind: "merged" | "review" | "open"; label: string };

export type AnalyticsInteraction = { input: string; output: string; time: number };

export type AnalyticsSession = {
  key: string;
  protocol: string;
  service: string;
  ip: string;
  user: string;
  client: string;
  start: number;
  end: number;
  status: AnalyticsSessionStatus;
  creds: { user: string; password: string }[];
  interactions: AnalyticsInteraction[];
  events: HoneypotEvent[];
};

export type AnalyticsDashboardData = {
  ranges: AnalyticsRange[];
  kpis: Record<RangeId, AnalyticsKpi[]>;
  activity: Record<RangeId, AnalyticsActivity>;
  attackers: Record<RangeId, AnalyticsAttacker[]>;
  protocols: AnalyticsProtocol[];
  services: AnalyticsService[];
  /** Newest first. */
  sessions: AnalyticsSession[];
};

const HOUR = 3_600_000;

const RANGE_SPECS: Record<RangeId, { label: string; span: number; buckets: number; sparkBuckets: number }> = {
  hour: { label: "1h", span: HOUR, buckets: 6, sparkBuckets: 12 },
  day: { label: "24h", span: 24 * HOUR, buckets: 6, sparkBuckets: 12 },
  week: { label: "7 jours", span: 7 * 24 * HOUR, buckets: 7, sparkBuckets: 14 },
};

const ATTACKER_COLORS = ["#f08a3c", "#9d8df5", "#2fd06f", "#4c9bff", "#f2b54a", "#e5484d", "#2fd0b5", "#d67ad8"];

export function attackerColor(ip: string) {
  let h = 0;
  for (const c of ip) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return ATTACKER_COLORS[h % ATTACKER_COLORS.length];
}

const time = (e: HoneypotEvent) => Date.parse(e.DateTime);

/** Stateless events (HTTP requests, SSH password attempts) each get their own ID, so group them per attacker and service. */
function sessionKey(e: HoneypotEvent) {
  return e.Status === "Stateless" ? `${e.Protocol}|${sourceIp(e)}|${e.Description}` : e.ID;
}

function buildSessions(events: HoneypotEvent[], now: number): AnalyticsSession[] {
  const map = new Map<string, AnalyticsSession>();
  for (const e of events) {
    const key = sessionKey(e);
    const t = time(e);
    let s = map.get(key);
    if (!s) {
      s = {
        key,
        protocol: e.Protocol,
        service: e.Description,
        ip: sourceIp(e),
        user: e.User,
        client: e.UserAgent || e.Client,
        start: t,
        end: t,
        status: { kind: "review", label: "" },
        creds: [],
        interactions: [],
        events: [],
      };
      map.set(key, s);
    }
    s.events.push(e);
    s.end = Math.max(s.end, t);
    s.service ||= e.Description;
    s.ip ||= sourceIp(e);
    s.user ||= e.User;
    s.client ||= e.UserAgent || e.Client;
    if (e.Password) s.creds.push({ user: e.User, password: e.Password });
    if (e.Status === "Interaction" || e.Status === "Stateless") {
      const input = e.Protocol === "HTTP" ? `${e.HTTPMethod} ${e.RequestURI}` : e.Command;
      if (input) s.interactions.push({ input, output: e.CommandOutput, time: t });
    }
  }

  for (const s of map.values()) {
    const stateless = s.events.every((e) => e.Status === "Stateless");
    const ended = s.events.some((e) => e.Status === "End");
    if (stateless) {
      s.status = s.protocol === "HTTP" ? { kind: "review", label: "Scan" } : { kind: "review", label: "Brute force" };
    } else if (ended || now - s.end > 10 * 60_000) {
      s.status = { kind: "merged", label: "Terminée" };
    } else {
      s.status = { kind: "open", label: "Active" };
    }
  }

  return [...map.values()].sort((a, b) => b.end - a.end);
}

function bucketize(events: HoneypotEvent[], from: number, to: number, n: number) {
  const out = new Array(n).fill(0);
  const width = (to - from) / n;
  for (const e of events) {
    const t = time(e);
    if (t < from || t >= to) continue;
    out[Math.min(n - 1, Math.floor((t - from) / width))]++;
  }
  return out;
}

function percentDelta(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / previous) * 100);
}

function countBy<T>(items: T[], key: (t: T) => string) {
  return new Set(items.map(key).filter(Boolean)).size;
}

function bucketLabel(t: number, range: RangeId) {
  const d = new Date(t);
  if (range === "week") return d.toLocaleDateString("fr-FR", { weekday: "short" });
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function caption(range: RangeId, now: number) {
  const from = new Date(now - RANGE_SPECS[range].span);
  const fmt = (d: Date) =>
    range === "week"
      ? d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })
      : d.toLocaleString("fr-FR", { weekday: "short", hour: "2-digit", minute: "2-digit" });
  return `${fmt(from)} – ${fmt(new Date(now))}`;
}

export function buildDashboardData(events: HoneypotEvent[], services: HoneypotService[], now: number): AnalyticsDashboardData {
  const sessions = buildSessions(events, now);
  const protocols = [...new Set([...services.map((s) => s.protocol), ...events.map((e) => e.Protocol)])]
    .filter(Boolean)
    .map((id) => ({ id, color: protocolColor(id) }));

  const ranges = (Object.keys(RANGE_SPECS) as RangeId[]).map((id) => ({ id, label: RANGE_SPECS[id].label, caption: caption(id, now) }));
  const kpis = {} as AnalyticsDashboardData["kpis"];
  const activity = {} as AnalyticsDashboardData["activity"];
  const attackers = {} as AnalyticsDashboardData["attackers"];

  for (const { id } of ranges) {
    const { span, buckets, sparkBuckets } = RANGE_SPECS[id];
    const from = now - span;
    const cur = events.filter((e) => time(e) >= from);
    const prev = events.filter((e) => time(e) >= from - span && time(e) < from);
    const curSessions = sessions.filter((s) => s.end >= from);
    const prevSessions = sessions.filter((s) => s.end >= from - span && s.end < from);
    const sparkOf = (list: HoneypotEvent[]) => bucketize(list, from, now, sparkBuckets);
    const credEvents = (list: HoneypotEvent[]) => list.filter((e) => e.Password);

    kpis[id] = [
      { id: "events", label: "Events", icon: "events", value: String(cur.length), delta: percentDelta(cur.length, prev.length), spark: sparkOf(cur) },
      {
        id: "attackers",
        label: "Attaquants uniques",
        icon: "attackers",
        value: String(countBy(cur, sourceIp)),
        delta: percentDelta(countBy(cur, sourceIp), countBy(prev, sourceIp)),
        spark: sparkOf(cur.filter((e, i, all) => all.findIndex((x) => sourceIp(x) === sourceIp(e)) === i)),
      },
      {
        id: "sessions",
        label: "Sessions",
        icon: "sessions",
        value: String(curSessions.length),
        delta: percentDelta(curSessions.length, prevSessions.length),
        spark: sparkOf(cur.filter((e) => e.Status === "Start" || e.Status === "Stateless")),
      },
      {
        id: "creds",
        label: "Credentials testés",
        icon: "creds",
        value: String(credEvents(cur).length),
        delta: percentDelta(credEvents(cur).length, credEvents(prev).length),
        spark: sparkOf(credEvents(cur)),
      },
    ];

    const width = span / buckets;
    activity[id] = {
      labels: Array.from({ length: buckets }, (_, i) => bucketLabel(from + width * (i + 1), id)),
      series: Object.fromEntries(
        protocols.map((p) => [
          p.id,
          bucketize(
            cur.filter((e) => e.Protocol === p.id),
            from,
            now,
            buckets,
          ),
        ]),
      ),
    };

    const byIp = new Map<string, AnalyticsAttacker>();
    for (const e of cur) {
      const ip = sourceIp(e);
      if (!ip) continue;
      const a = byIp.get(ip) ?? { ip, color: attackerColor(ip), events: 0, sessions: 0, creds: 0, commands: 0 };
      a.events++;
      if (e.Password) a.creds++;
      if (e.Status === "Interaction") a.commands++;
      byIp.set(ip, a);
    }
    for (const s of curSessions) {
      const a = byIp.get(s.ip);
      if (a) a.sessions++;
    }
    attackers[id] = [...byIp.values()].sort((a, b) => b.events - a.events).slice(0, 6);
  }

  const dayAgo = now - 24 * HOUR;
  const analyticsServices = services.map((svc) => {
    const hits = events.filter((e) => e.Description === svc.description && e.Protocol === svc.protocol);
    return {
      ...svc,
      events: hits.length,
      ips: countBy(hits, sourceIp),
      lastSeen: hits.length ? Math.max(...hits.map(time)) : null,
      activity: bucketize(hits, dayAgo, now, 24),
    };
  });

  return { ranges, kpis, activity, attackers, protocols, services: analyticsServices, sessions };
}

export function sessionTitle(s: AnalyticsSession) {
  const user = s.user || s.creds.at(-1)?.user;
  const n = s.interactions.length;
  if (s.protocol === "HTTP") return `${n} requête${n > 1 ? "s" : ""} HTTP sur ${s.service}`;
  if (s.status.label === "Brute force") return `${s.creds.length} tentative${s.creds.length > 1 ? "s" : ""} de login sur ${s.service}`;
  if (n === 0) return `Connexion ${s.protocol}${user ? ` en tant que ${user}` : ""} sans commande`;
  const first = s.interactions[0].input;
  return `${user ? `${user}@` : ""}${s.protocol.toLowerCase()} · ${first}${n > 1 ? ` +${n - 1}` : ""}`;
}

export function relativeTime(t: number, now = Date.now()) {
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}min`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}j`;
}

export function formatDuration(ms: number) {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}min ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}min`;
}
