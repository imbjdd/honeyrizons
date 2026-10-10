// Lures: services the honeypot does not run until attackers give it a reason to.
//
// Each one is a fixed Beelzebub config in apps/honeypot/config/lures/<id>.yaml. The city planner (apps/api/planner.ts)
// opens one when the traffic it already sees shows demand for it, and closes it when it stops catching anything. Nothing
// attacker-controlled ever reaches a config: the planner only picks from this catalog.
import { serviceKey, type LureCase } from "./chronicle";

export type LureBlueprint = {
  id: string;
  /** What the city calls it. */
  name: string;
  /** As /api/services reports it: uppercase protocol, and the YAML's address and description. */
  protocol: string;
  address: string;
  description: string;
  /** Who it is meant to catch, in one line. */
  pitch: string;
};

export const LURES: LureBlueprint[] = [
  {
    id: "llm-gateway",
    name: "LLM gateway",
    protocol: "HTTP",
    address: ":11434",
    description: "Ollama 0.24.0",
    pitch: "An open self-hosted LLM server, for AI agents and API-key hunters.",
  },
  {
    id: "docker-api",
    name: "Docker socket",
    protocol: "HTTP",
    address: ":2375",
    description: "Docker Engine 27.3.1",
    pitch: "An unauthenticated Docker API, the cryptominers' favourite way in.",
  },
  {
    id: "staging-site",
    name: "Leaky staging site",
    protocol: "HTTP",
    address: ":8081",
    description: "Laravel staging",
    pitch: "A staging app serving its .env and .git, seeded with canary credentials.",
  },
  {
    id: "postgres",
    name: "PostgreSQL",
    protocol: "TCP",
    address: ":5432",
    description: "PostgreSQL 16.4",
    pitch: "A database that asks for a cleartext password, so every guess is kept.",
  },
  {
    id: "kube-api",
    name: "Kubernetes API",
    protocol: "HTTP",
    address: ":8001",
    description: "Kubernetes API 1.31",
    pitch: "A kubectl proxy left open, with fake secrets for cloud-credential thieves.",
  },
  {
    id: "iot-broker",
    name: "MQTT broker",
    protocol: "TCP",
    address: ":1883",
    description: "Mosquitto 2.0.18",
    pitch: "An open MQTT broker, where IoT botnets look for their next devices.",
  },
];

/** GET /api/planner: how close each lure is to being built, from current traffic. */
export type PlannerSnapshot = {
  /** auto: builds lures itself · propose: suggests them for an operator to apply · off. */
  mode: "auto" | "propose" | "off";
  /** Demand a lure needs before the planner builds it. */
  planAt: number;
  capacity: number;
  demand: (LureCase & {
    lure: string;
    /** The planner would build it now: enough demand, and not standing or cooling down. */
    suggested: boolean;
  })[];
};

export const lureById = (id: string) => LURES.find((l) => l.id === id);

export const lureServiceKey = (lure: LureBlueprint) => serviceKey(lure.protocol, lure.description);
