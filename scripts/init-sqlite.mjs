import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { parseArgs } from "node:util";

let Database;
try {
  ({ default: Database } = await import("better-sqlite3"));
} catch {
  console.error("Missing dependency: run `npm install` before `npm run happy-path`.");
  process.exit(1);
}

const { values: options } = parseArgs({
  options: { db: { type: "string" }, state: { type: "string" }, "json-out": { type: "string" } },
});
const dbPath = resolve(options.db ?? process.env.NODETRACE_DB_PATH ?? ".nodetrace/nodetrace.sqlite");
const statePath = resolve(options.state ?? process.env.NODETRACE_STATE_PATH ?? "public/nodetrace-state.json");
const jsonOutPath = options["json-out"] ? resolve(options["json-out"]) : undefined;
const builderCapable = String(process.env.NODETRACE_BUILDER_CAPABLE ?? "false").toLowerCase() === "true";
const startedAt = new Date();
const startedMs = performance.now();

mkdirSync(dirname(dbPath), { recursive: true });
mkdirSync(dirname(statePath), { recursive: true });
if (jsonOutPath) mkdirSync(dirname(jsonOutPath), { recursive: true });

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.exec(readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8"));

const session = {
  id: `nodetrace-${startedAt.toISOString().replace(/[:.]/g, "-")}`,
  title: "NodeTrace local happy path",
  status: "verified",
  summary: "SQLite trace session, proof cards, events, and gated ownership were generated locally.",
  createdAt: startedAt.toISOString(),
};

const surfaces = [
  {
    id: "workSurface.traceStrip",
    label: "Trace strip",
    proofAvailable: true,
    about: "Runtime progress, tool calls, receipts, and verifier status.",
  },
  {
    id: "workSurface.evidenceCarousel",
    label: "Evidence",
    proofAvailable: true,
    about: "Source-backed evidence cards linked to visible artifacts or cells.",
  },
  {
    id: "copilot.agentOperationStream",
    label: "Agent operations",
    proofAvailable: true,
    about: "Bounded stream of agent, worker, tool, and scheduler events.",
  },
  {
    id: "shell.statusStrip",
    label: "Status",
    proofAvailable: true,
    about: "System health, credential state, run status, and review outcome.",
  },
  {
    id: "shell.progressSpine",
    label: "Progress",
    proofAvailable: false,
    about: "End-to-end workflow stages from intake to review.",
  },
];

const proofs = [
  {
    id: `${session.id}-proof-001`,
    surfaceId: "workSurface.evidenceCarousel",
    artifactId: "demo-artifact",
    elementId: "evidence-card-001",
    title: "Portable evidence card",
    status: "verified",
    confidence: 0.98,
    sourceLabel: "db/schema.sql",
    sourceUrl: "",
    detail: "Business proof is stored as app-neutral rows keyed by opaque surface ids.",
    createdAt: startedAt.toISOString(),
  },
  {
    id: `${session.id}-proof-002`,
    surfaceId: "shell.statusStrip",
    title: "No provider lock-in",
    status: "verified",
    confidence: 0.99,
    sourceLabel: "scripts/init-sqlite.mjs",
    sourceUrl: "",
    detail: "The happy path creates local SQLite rows and client state without any model provider or cloud account.",
    createdAt: startedAt.toISOString(),
  },
];

const traces = [
  {
    id: `${session.id}-trace-001`,
    surfaceId: "workSurface.traceStrip",
    phase: "schema",
    actor: "nodetrace",
    status: "ok",
    summary: "Applied generic SQLite trace schema",
    durationMs: 13,
    createdAt: startedAt.toISOString(),
  },
  {
    id: `${session.id}-trace-002`,
    surfaceId: "workSurface.evidenceCarousel",
    artifactId: "demo-artifact",
    elementId: "evidence-card-001",
    phase: "proof",
    actor: "nodetrace",
    status: "ok",
    summary: "Inserted source-backed business proof",
    durationMs: 17,
    createdAt: startedAt.toISOString(),
  },
  {
    id: `${session.id}-trace-003`,
    surfaceId: "copilot.agentOperationStream",
    phase: "events",
    actor: "nodetrace",
    status: "ok",
    summary: "Wrote bounded runtime trace rows",
    durationMs: 8,
    createdAt: startedAt.toISOString(),
  },
  {
    id: `${session.id}-trace-004`,
    surfaceId: "shell.statusStrip",
    phase: "state",
    actor: "nodetrace",
    status: "ok",
    summary: "Published client-safe trace state JSON",
    durationMs: 11,
    createdAt: startedAt.toISOString(),
  },
];

const codeOwnership = [
  {
    id: `${session.id}-owner-001`,
    surfaceId: "workSurface.traceStrip",
    ownerLabel: "Trace platform team",
    componentRef: "server-only/component-ref",
    backendRef: "server-only/backend-ref",
    queryRef: "server-only/query-ref",
    mutationRef: "server-only/mutation-ref",
    skillRef: "server-only/skill-ref",
    testRef: "server-only/test-ref",
    createdAt: startedAt.toISOString(),
  },
];

const insertSession = db.prepare(`
  insert or replace into trace_sessions (id, title, status, summary, created_at)
  values (@id, @title, @status, @summary, @createdAt)
`);
const insertSurface = db.prepare(`
  insert or replace into trace_surfaces (id, label, proof_available, about)
  values (@id, @label, @proofAvailable, @about)
`);
const insertProof = db.prepare(`
  insert or replace into trace_proofs
    (id, session_id, surface_id, artifact_id, element_id, title, status, confidence, source_label, source_url, detail, created_at)
  values
    (@id, @sessionId, @surfaceId, @artifactId, @elementId, @title, @status, @confidence, @sourceLabel, @sourceUrl, @detail, @createdAt)
`);
const insertTrace = db.prepare(`
  insert or replace into trace_events
    (id, session_id, surface_id, artifact_id, element_id, phase, actor, status, summary, duration_ms, created_at)
  values
    (@id, @sessionId, @surfaceId, @artifactId, @elementId, @phase, @actor, @status, @summary, @durationMs, @createdAt)
`);
const insertOwnership = db.prepare(`
  insert or replace into trace_code_ownership
    (id, surface_id, owner_label, component_ref, backend_ref, query_ref, mutation_ref, skill_ref, test_ref, builder_only, created_at)
  values
    (@id, @surfaceId, @ownerLabel, @componentRef, @backendRef, @queryRef, @mutationRef, @skillRef, @testRef, 1, @createdAt)
`);

db.transaction(() => {
  insertSession.run(session);
  for (const surface of surfaces) insertSurface.run({ ...surface, proofAvailable: surface.proofAvailable ? 1 : 0 });
  for (const proof of proofs) {
    insertProof.run({
      ...proof,
      sessionId: session.id,
      artifactId: proof.artifactId ?? null,
      elementId: proof.elementId ?? null,
      sourceUrl: proof.sourceUrl ?? null,
    });
  }
  for (const trace of traces) {
    insertTrace.run({
      ...trace,
      sessionId: session.id,
      artifactId: trace.artifactId ?? null,
      elementId: trace.elementId ?? null,
    });
  }
  for (const owner of codeOwnership) insertOwnership.run(owner);
})();

const clientState = {
  generatedAt: new Date().toISOString(),
  session: {
    id: session.id,
    title: session.title,
    status: session.status,
    summary: session.summary,
  },
  builderCapable,
  surfaces,
  proofs: proofs.map(({ createdAt: _createdAt, ...proof }) => proof),
  traces: traces.map(({ createdAt: _createdAt, ...trace }) => trace),
  codeOwnership: builderCapable
    ? codeOwnership.map(({ createdAt: _createdAt, ...owner }) => owner)
    : [],
};

writeFileSync(statePath, `${JSON.stringify(clientState, null, 2)}\n`);

const report = {
  ok: true,
  startedAt: startedAt.toISOString(),
  completedAt: new Date().toISOString(),
  durationMs: Math.round(performance.now() - startedMs),
  apiKeysRequired: false,
  databasePath: relativePath(dbPath),
  statePath: relativePath(statePath),
  tables: ["trace_sessions", "trace_surfaces", "trace_proofs", "trace_events", "trace_code_ownership"],
  traceRows: traces.length,
  proofRows: proofs.length,
  builderCapable,
};

if (jsonOutPath) writeFileSync(jsonOutPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`nodetrace happy path: PASS ${report.durationMs}ms`);
console.log(`wrote ${report.databasePath}`);
console.log(`wrote ${report.statePath}`);


function relativePath(path) {
  return path.replace(`${process.cwd()}\\`, "").replace(`${process.cwd()}/`, "").replaceAll("\\", "/");
}
