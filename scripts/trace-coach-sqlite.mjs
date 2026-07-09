import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { performance } from "node:perf_hooks";

let Database;
try {
  ({ default: Database } = await import("better-sqlite3"));
} catch {
  console.error("Missing dependency: run `npm install` before `npm run trace-coach:sqlite`.");
  process.exit(1);
}

const options = parseArgs(process.argv.slice(2));
const dbPath = resolve(options.db ?? process.env.NODETRACE_DB_PATH ?? ".nodetrace/trace-coach.sqlite");
const statePath = resolve(options.state ?? process.env.NODETRACE_STATE_PATH ?? "public/nodetrace-state.json");
const reportPath = resolve(options["json-out"] ?? "docs/eval/nodetrace-trace-coach-sqlite.json");
const captureRoot = resolve(options["capture-root"] ?? process.env.NODETRACE_CAPTURE_ROOT ?? "public/captures");
const sourceRoot = resolve(options["source-root"] ?? process.env.NODETRACE_SOURCE_ROOT ?? "..");
const realCaptureManifestPath = resolve(
  options["real-capture-manifest"] ?? process.env.NODETRACE_REAL_CAPTURE_MANIFEST ?? `${captureRoot}/noderoom-real-capture-manifest.json`,
);
const allowGeneratedCaptures = isTruthy(options["allow-generated-captures"] ?? process.env.NODETRACE_ALLOW_GENERATED_CAPTURES);
const startedAt = new Date();
const startedMs = performance.now();

mkdirSync(dirname(dbPath), { recursive: true });
mkdirSync(dirname(statePath), { recursive: true });
mkdirSync(dirname(reportPath), { recursive: true });
mkdirSync(captureRoot, { recursive: true });

const db = new Database(dbPath);
db.pragma("foreign_keys = ON");
db.pragma("journal_mode = WAL");
const schemaSql = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8");
db.exec(schemaSql);
ensureCoachSchema(db, schemaSql);

const session = {
  id: "trace-coach-noderoom-sqlite",
  title: "Trace Coach: NodeRoom codebase trace",
  status: "verified",
  summary:
    "A local Trace tab sample sourced from the latest full NodeRoom checkout, using real NodeRoom trace records, detail tabs, steps, flow, screenshot boxes, and raw JSON.",
  createdAt: startedAt.toISOString(),
};

const surfaces = [
  {
    id: "workSurface.trace",
    label: "Trace tab",
    proofAvailable: true,
    about: "NodeRoom's master-detail trace tab with Overview, Steps, Flow, Evidence, and Raw JSON.",
  },
  {
    id: "workSurface.traceStrip",
    label: "Room trace strip",
    proofAvailable: true,
    about: "The bottom room activity strip that opens into the full trace surface.",
  },
  {
    id: "workSurface.traceSteps",
    label: "Trace steps",
    proofAvailable: true,
    about: "Grouped, bounded, source-linked steps with screenshot and metric attachments.",
  },
  {
    id: "workSurface.traceFlow",
    label: "Trace flow",
    proofAvailable: true,
    about: "NodeRoom's graph view over the same trace steps.",
  },
  {
    id: "workSurface.traceData",
    label: "Trace data",
    proofAvailable: true,
    about: "The shared TraceRecord and TraceStep data model behind the tabs.",
  },
  {
    id: "workSurface.traceStyle",
    label: "Trace styling",
    proofAvailable: true,
    about: "The NodeRoom visual layer for record lists, tabs, step cards, and screenshot boxes.",
  },
];

const graphNodes = [
  {
    id: "artifact",
    label: "Artifact shell",
    kind: "component",
    filePath: "src/ui/panels/Artifact.tsx",
    layer: "UI entry",
    x: 112,
    y: 250,
    summary: "Entry point that exposes the room trace strip.",
  },
  {
    id: "surface",
    label: "TraceSurface",
    kind: "component",
    filePath: "src/ui/panels/TraceSurface.tsx",
    layer: "Trace UI",
    x: 332,
    y: 176,
    summary: "Master-detail trace tab with records, tabs, and active detail.",
  },
  {
    id: "data",
    label: "traceData",
    kind: "schema",
    filePath: "src/ui/panels/traceData.ts",
    layer: "Data model",
    x: 332,
    y: 382,
    summary: "TraceRecord and TraceStep structures that feed the UI.",
  },
  {
    id: "steps",
    label: "TraceStepRow",
    kind: "component",
    filePath: "src/ui/panels/TraceStepRow.tsx",
    layer: "Evidence UI",
    x: 560,
    y: 286,
    summary: "Step renderer for source-linked rows and screenshot boxes.",
  },
  {
    id: "flow",
    label: "TraceFlow",
    kind: "component",
    filePath: "src/ui/panels/TraceFlow.tsx",
    layer: "Graph UI",
    x: 784,
    y: 190,
    summary: "Graph view over the same ordered trace steps.",
  },
  {
    id: "style",
    label: "Trace CSS",
    kind: "runtime",
    filePath: "src/app/styles.css",
    layer: "Visual system",
    x: 790,
    y: 406,
    summary: "Dark trace surface, tabs, cards, and highlighted boxes.",
  },
];

const graphEdges = [
  { id: "artifact-surface", from: "artifact", to: "surface", label: "opens full trace tab" },
  { id: "surface-data", from: "surface", to: "data", label: "loads records" },
  { id: "surface-steps", from: "surface", to: "steps", label: "renders step list" },
  { id: "surface-flow", from: "surface", to: "flow", label: "renders graph tab" },
  { id: "steps-style", from: "steps", to: "style", label: "uses screenshot box styles" },
  { id: "flow-style", from: "flow", to: "style", label: "uses dark graph shell" },
];

const baseCoachSteps = [
  {
    id: "coach-step-01-artifact-entry",
    order: 1,
    stepLabel: "Step 01",
    group: "Entry",
    title: "Open NodeRoom's Trace tab from the artifact shell",
    narrative:
      "Start from the real artifact panel. NodeRoom exposes a trace tab and a bottom room trace strip, so users can move from live room activity into the full provenance view.",
    surfaceId: "workSurface.traceStrip",
    codeBlock: codeBlock("src/ui/panels/Artifact.tsx", 'data-noderoom-surface="workSurface.traceStrip"', -8, 18),
    uiCapture: {
      selector: '[data-noderoom-surface="workSurface.traceStrip"]',
      rect: { x: 184, y: 1086, width: 700, height: 210 },
      screenshotPath: "captures/noderoom-room-trace-strip.svg",
      alt: "NodeRoom bottom room trace strip with recent room events and trace telemetry.",
    },
    diagram: {
      kind: "mermaid",
      nodeId: "artifact",
      source:
        "flowchart LR\n  Artifact[Artifact shell] --> Strip[Room trace strip]\n  Strip --> TraceTab[Trace tab]\n  TraceTab --> Surface[TraceSurface]",
    },
  },
  {
    id: "coach-step-02-detail-tabs",
    order: 2,
    stepLabel: "Step 02",
    group: "Trace tabs",
    title: "Use the real NodeRoom trace tabs",
    narrative:
      "The sample should follow NodeRoom's detail-tab model instead of a loose walkthrough card: Overview, Steps, Flow, Evidence, and Raw JSON all hang off one selected trace record.",
    surfaceId: "workSurface.trace",
    codeBlock: codeBlock("src/ui/panels/TraceSurface.tsx", "type DetailTab =", 0, 32),
    uiCapture: {
      selector: '[data-testid="trace-surface"] .r-tracevu-tabs',
      rect: { x: 548, y: 118, width: 354, height: 42 },
      screenshotPath: "captures/noderoom-trace-detail-tabs.svg",
      alt: "NodeRoom trace detail tabs for Overview, Steps, Flow, Evidence, and Raw JSON.",
    },
    diagram: {
      kind: "mermaid",
      nodeId: "surface",
      source:
        "flowchart LR\n  Record[Selected trace record] --> Overview\n  Record --> Steps\n  Record --> Flow\n  Record --> Evidence\n  Record --> RawJSON[Raw JSON]",
    },
  },
  {
    id: "coach-step-03-trace-data",
    order: 3,
    stepLabel: "Step 03",
    group: "Data model",
    title: "Seed the app from NodeRoom TraceRecord data",
    narrative:
      "NodeTrace now seeds from the same mental model NodeRoom uses: records contain ordered steps, source metadata, verdicts, attachments, and raw audit payloads.",
    surfaceId: "workSurface.traceData",
    codeBlock: codeBlock("src/ui/panels/traceData.ts", "export interface TraceRecord", -18, 24),
    uiCapture: {
      selector: '[data-testid="trace-record"]',
      rect: { x: 20, y: 160, width: 300, height: 108 },
      screenshotPath: "captures/noderoom-trace-record-list.svg",
      alt: "NodeRoom trace record list showing source, step count, and verdict pills.",
    },
    diagram: {
      kind: "mermaid",
      nodeId: "data",
      source:
        "flowchart TB\n  TraceRecord --> Source\n  TraceRecord --> Verdict\n  TraceRecord --> Steps\n  Steps --> Attachments\n  Attachments --> ScreenshotBox[normalized screenshot box]",
    },
  },
  {
    id: "coach-step-04-step-row",
    order: 4,
    stepLabel: "Step 04",
    group: "Steps",
    title: "Render code and UI evidence like NodeRoom step rows",
    narrative:
      "Each step is an ordered, source-linked unit. Screenshot attachments carry a normalized box so the UI can draw exactly what was clicked or extracted.",
    surfaceId: "workSurface.traceSteps",
    codeBlock: codeBlock("src/ui/panels/TraceStepRow.tsx", "a.box &&", -16, 12),
    uiCapture: {
      selector: '[data-testid="trace-step"] .r-tracevu-shotframe',
      rect: { x: 410, y: 310, width: 454, height: 256 },
      screenshotPath: "captures/noderoom-trace-step-box.svg",
      alt: "NodeRoom trace step screenshot frame with a highlighted bounding box overlay.",
    },
    diagram: {
      kind: "mermaid",
      nodeId: "steps",
      source:
        "flowchart LR\n  Step[TraceStep] --> Label\n  Step --> Detail\n  Step --> Attachments\n  Attachments --> Screenshot\n  Screenshot --> Box[box x y w h]",
    },
  },
  {
    id: "coach-step-05-flow",
    order: 5,
    stepLabel: "Step 05",
    group: "Flow",
    title: "Keep the latest flow tab behavior",
    narrative:
      "NodeRoom's Flow tab derives graph nodes and edges from the same ordered steps. Clicking a node opens the same step renderer, avoiding drift between graph and list.",
    surfaceId: "workSurface.traceFlow",
    codeBlock: codeBlock("src/ui/panels/TraceFlow.tsx", "const { nodes, edges }", -8, 34),
    uiCapture: {
      selector: '[data-testid="trace-flow"]',
      rect: { x: 336, y: 184, width: 760, height: 456 },
      screenshotPath: "captures/noderoom-trace-flow.svg",
      alt: "NodeRoom trace flow graph with grouped phases, animated edges, controls, and minimap.",
    },
    diagram: {
      kind: "mermaid",
      nodeId: "flow",
      source:
        "flowchart LR\n  Steps[Ordered TraceStep list] --> Nodes[ReactFlow nodes]\n  Nodes --> Edges[Sequential edges]\n  Nodes --> Detail[Shared StepRow detail]",
    },
  },
  {
    id: "coach-step-06-style",
    order: 6,
    stepLabel: "Step 06",
    group: "Look and feel",
    title: "Match NodeRoom's dark trace surface",
    narrative:
      "The sample app should look like NodeRoom: dark app chrome, compact tabs, muted metadata, accent verdict pills, step cards, and screenshot highlight boxes.",
    surfaceId: "workSurface.traceStyle",
    codeBlock: codeBlock("src/app/styles.css", ".r-tracevu-tabs", -12, 44),
    uiCapture: {
      selector: ".r-tracevu",
      rect: { x: 170, y: 62, width: 690, height: 888 },
      screenshotPath: "captures/noderoom-trace-surface-style.svg",
      alt: "NodeRoom dark trace surface with record list, detail pane, tabs, and step cards.",
    },
    diagram: {
      kind: "mermaid",
      nodeId: "style",
      source:
        "flowchart TB\n  Tokens[NodeRoom design tokens] --> TraceList\n  Tokens --> DetailTabs\n  Tokens --> StepCards\n  Tokens --> ScreenshotBoxes",
    },
  },
];

const coachSteps = baseCoachSteps.map((step) => ({
  ...step,
  sourceView: {
    imagePath: capturePath(`${step.id}-ide.svg`),
    repositoryRoot: "HomenShum/noderoom",
    activeFile: step.codeBlock.filePath,
    folderTree: folderTreeFor(step.codeBlock.filePath),
    highlightStartLine: step.codeBlock.startLine,
    highlightEndLine: step.codeBlock.endLine,
  },
  uiCapture: {
    ...step.uiCapture,
    screenshotPath: capturePath(`${step.id}-ui.svg`),
  },
  mapCapture: {
    imagePath: capturePath(`${step.id}-minimap.svg`),
    graphPath: capturePath("noderoom-trace-knowledge-graph.json"),
    model: "Understand-Anything-backed structural minimap",
  },
}));

const realCaptureManifest = loadRealCaptureManifest(realCaptureManifestPath, coachSteps, captureRoot, allowGeneratedCaptures);
if (realCaptureManifest) applyRealCaptureManifest(coachSteps, realCaptureManifest, captureRoot);

const sourceMode = coachSteps.some((step) => step.codeBlock.sourceMode === "snapshot") ? "snapshot" : "live";

const captureGraph = writeCaptureAssets({ captureRoot, coachSteps, graphEdges, graphNodes, sourceMode, realCaptureManifest, allowGeneratedCaptures });

const proofs = coachSteps.map((step) => ({
  id: `${step.id}-proof`,
  sessionId: session.id,
  surfaceId: step.surfaceId,
  artifactId: "noderoom-codebase-trace",
  elementId: step.id,
  title: `${step.stepLabel}: ${step.title}`,
  status: "verified",
  confidence: step.codeBlock.sourceMode === "live" ? 0.97 : 0.88,
  sourceLabel: step.codeBlock.filePath,
  sourceUrl: "https://github.com/HomenShum/noderoom",
  detail: step.narrative,
  createdAt: startedAt.toISOString(),
}));

const traces = coachSteps.map((step) => ({
  id: `${step.id}-trace`,
  sessionId: session.id,
  surfaceId: step.surfaceId,
  artifactId: "noderoom-codebase-trace",
  elementId: step.id,
  phase: step.group?.toLowerCase().replaceAll(" ", "-") ?? `step-${step.order}`,
  actor: "trace-coach",
  status: "ok",
  summary: `${step.stepLabel}: ${step.title}`,
  durationMs: 48 + step.order * 9,
  createdAt: new Date(startedAt.getTime() + step.order * 1000).toISOString(),
}));

db.transaction(() => {
  db.prepare("delete from trace_sessions where id = ?").run(session.id);

  db.prepare(`
    insert into trace_sessions (id, title, status, summary, created_at)
    values (@id, @title, @status, @summary, @createdAt)
  `).run(session);

  const insertSurface = db.prepare(`
    insert or replace into trace_surfaces (id, label, proof_available, about)
    values (@id, @label, @proofAvailable, @about)
  `);
  for (const surface of surfaces) insertSurface.run({ ...surface, proofAvailable: surface.proofAvailable ? 1 : 0 });

  const insertProof = db.prepare(`
    insert into trace_proofs
      (id, session_id, surface_id, artifact_id, element_id, title, status, confidence, source_label, source_url, detail, created_at)
    values
      (@id, @sessionId, @surfaceId, @artifactId, @elementId, @title, @status, @confidence, @sourceLabel, @sourceUrl, @detail, @createdAt)
  `);
  for (const proof of proofs) insertProof.run(proof);

  const insertTrace = db.prepare(`
    insert into trace_events
      (id, session_id, surface_id, artifact_id, element_id, phase, actor, status, summary, duration_ms, created_at)
    values
      (@id, @sessionId, @surfaceId, @artifactId, @elementId, @phase, @actor, @status, @summary, @durationMs, @createdAt)
  `);
  for (const trace of traces) insertTrace.run(trace);

  const insertStep = db.prepare(`
    insert into trace_coach_steps
      (id, session_id, surface_id, step_order, step_label, step_group, title, narrative, code_file_path, code_start_line, code_end_line, code_snippet, ui_selector, ui_rect_json, screenshot_path, screenshot_alt, diagram_kind, diagram_node_id, diagram_source, created_at)
    values
      (@id, @sessionId, @surfaceId, @order, @stepLabel, @group, @title, @narrative, @codeFilePath, @codeStartLine, @codeEndLine, @codeSnippet, @uiSelector, @uiRectJson, @screenshotPath, @screenshotAlt, @diagramKind, @diagramNodeId, @diagramSource, @createdAt)
  `);
  for (const step of coachSteps) {
    insertStep.run({
      id: step.id,
      sessionId: session.id,
      surfaceId: step.surfaceId,
      order: step.order,
      stepLabel: step.stepLabel,
      group: step.group ?? null,
      title: step.title,
      narrative: step.narrative,
      codeFilePath: step.codeBlock.filePath,
      codeStartLine: step.codeBlock.startLine,
      codeEndLine: step.codeBlock.endLine,
      codeSnippet: step.codeBlock.snippet,
      uiSelector: step.uiCapture.selector,
      uiRectJson: JSON.stringify(step.uiCapture.rect),
      screenshotPath: step.uiCapture.screenshotPath,
      screenshotAlt: step.uiCapture.alt,
      diagramKind: step.diagram.kind,
      diagramNodeId: step.diagram.nodeId,
      diagramSource: step.diagram.source,
      createdAt: startedAt.toISOString(),
    });
  }

  const insertNode = db.prepare(`
    insert into trace_coach_graph_nodes (id, session_id, label, kind)
    values (@id, @sessionId, @label, @kind)
  `);
  for (const node of graphNodes) insertNode.run({ ...node, sessionId: session.id });

  const insertEdge = db.prepare(`
    insert into trace_coach_graph_edges (id, session_id, from_node_id, to_node_id, label)
    values (@id, @sessionId, @from, @to, @label)
  `);
  for (const edge of graphEdges) insertEdge.run({ ...edge, sessionId: session.id });
})();

const clientState = {
  generatedAt: new Date().toISOString(),
  session: {
    id: session.id,
    title: session.title,
    status: session.status,
    summary: session.summary,
  },
  builderCapable: false,
  surfaces,
  proofs: proofs.map(({ sessionId: _sessionId, createdAt: _createdAt, ...proof }) => proof),
  traces: traces.map(({ sessionId: _sessionId, createdAt: _createdAt, ...trace }) => trace),
  codeOwnership: [],
  coach: {
    mode: "campaign",
    activeStepId: coachSteps[0].id,
    sourceRepo: "HomenShum/noderoom",
    sourceMode,
    steps: coachSteps.map(({ codeBlock: block, ...step }) => ({
      ...step,
      codeBlock: {
        filePath: block.filePath,
        startLine: block.startLine,
        endLine: block.endLine,
        snippet: block.snippet,
      },
    })),
    graphNodes,
    graphEdges,
  },
};

writeJson(statePath, clientState);
const report = {
  ok: true,
  startedAt: startedAt.toISOString(),
  completedAt: new Date().toISOString(),
  durationMs: Math.round(performance.now() - startedMs),
  apiKeysRequired: false,
  sourceRepo: "HomenShum/noderoom",
  sourceRoot: relativePath(sourceRoot),
  sourceMode,
  databasePath: relativePath(dbPath),
  statePath: relativePath(statePath),
  coachSteps: coachSteps.length,
  graphNodes: graphNodes.length,
  graphEdges: graphEdges.length,
  knowledgeGraphGenerator: captureGraph.generator,
  knowledgeGraphNodes: Array.isArray(captureGraph.nodes) ? captureGraph.nodes.length : graphNodes.length,
  knowledgeGraphEdges: Array.isArray(captureGraph.edges) ? captureGraph.edges.length : graphEdges.length,
  realCaptureManifest: relativePath(realCaptureManifestPath),
  realCaptureSteps: realCaptureManifest ? realCaptureManifest.steps.length : 0,
  captureModel: realCaptureManifest
    ? `${realCaptureManifest.captureModel ?? "actual source screenshots + actual running app screenshots"} + data-noderoom selector + DOMRect + screenshotPath`
    : "explicit generated fallback requested with --allow-generated-captures",
  onboardingModel: "ordered steps only; no video timestamps stored",
  visualModel: "NodeRoom trace-tab look and feel with Understand-Anything-backed minimap",
  captureAssets: coachSteps.length * 3 + 1,
};
writeJson(reportPath, report);
db.close();

console.log(`nodetrace trace coach sqlite: PASS ${coachSteps.length} NodeRoom codebase steps (${sourceMode})`);
console.log(`wrote ${report.databasePath}`);
console.log(`wrote ${report.statePath}`);

function codeBlock(filePath, anchor, before, after) {
  const { source, mode } = readNodeRoomSource(filePath);
  const lines = source.split(/\r?\n/);
  const index = lines.findIndex((line) => line.includes(anchor));
  if (index < 0) throw new Error(`anchor not found in ${filePath}: ${anchor}`);
  const start = Math.max(0, index + before);
  const end = Math.min(lines.length - 1, index + after);
  return {
    filePath,
    startLine: start + 1,
    endLine: end + 1,
    snippet: lines.slice(start, end + 1).join("\n"),
    sourceMode: mode,
  };
}

function readNodeRoomSource(filePath) {
  const livePath = resolve(sourceRoot, filePath);
  if (existsSync(livePath)) {
    return { source: readFileSync(livePath, "utf8"), mode: "live" };
  }
  const snapshot = nodeRoomSourceSnapshots()[filePath];
  if (snapshot) return { source: snapshot, mode: "snapshot" };
  throw new Error(`NodeRoom source file not found: ${livePath}`);
}

function ensureCoachSchema(database, schema) {
  const columns = database.prepare("pragma table_info(trace_coach_steps)").all();
  if (columns.some((column) => column.name === "step_label")) return;
  database.exec(`
    drop table if exists trace_coach_graph_edges;
    drop table if exists trace_coach_graph_nodes;
    drop table if exists trace_coach_steps;
  `);
  database.exec(schema);
}

function parseArgs(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) continue;
    const [key, inlineValue] = arg.slice(2).split("=", 2);
    if (inlineValue !== undefined) {
      parsed[key] = inlineValue;
      continue;
    }
    const next = args[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = "true";
    } else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

function isTruthy(value) {
  return ["1", "true", "yes", "on"].includes(String(value ?? "").toLowerCase());
}

function writeJson(path, value) {
  const parent = dirname(path);
  if (parent && parent !== "." && !existsSync(parent)) mkdirSync(parent, { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function relativePath(path) {
  return relative(process.cwd(), path).replaceAll("\\", "/");
}

function capturePath(name) {
  return `captures/${name}`;
}

function folderTreeFor(filePath) {
  const parts = filePath.split("/");
  return parts.map((part, index) => `${"  ".repeat(index)}${index === 0 ? "" : "- "}${part}`);
}

function loadRealCaptureManifest(path, coachSteps, captureRoot, allowGenerated) {
  if (!existsSync(path)) {
    if (allowGenerated) return null;
    throw new Error(
      `Real capture manifest missing: ${path}. Run \`npm run capture:noderoom:real\` against the latest NodeRoom checkout, then rerun \`npm run trace-coach:sqlite\`.`,
    );
  }
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`Real capture manifest is not valid JSON: ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
  const entries = Array.isArray(manifest.steps) ? manifest.steps : [];
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const issues = [];
  for (const step of coachSteps) {
    const entry = byId.get(step.id);
    if (!entry) {
      issues.push(`${step.id}: missing manifest step`);
      continue;
    }
    const sourceKind = String(entry.sourceView?.captureKind ?? "");
    const uiKind = String(entry.uiCapture?.captureKind ?? "");
    if (!sourceKind.startsWith("actual-")) issues.push(`${step.id}: sourceView.captureKind must be actual-*`);
    if (!uiKind.startsWith("actual-")) issues.push(`${step.id}: uiCapture.captureKind must be actual-*`);
    if (!entry.sourceView?.imagePath) issues.push(`${step.id}: missing sourceView.imagePath`);
    if (!entry.uiCapture?.screenshotPath) issues.push(`${step.id}: missing uiCapture.screenshotPath`);
    if (entry.sourceView?.imagePath && !existsSync(resolveCaptureAsset(captureRoot, entry.sourceView.imagePath))) {
      issues.push(`${step.id}: source capture file missing ${entry.sourceView.imagePath}`);
    }
    if (entry.uiCapture?.screenshotPath && !existsSync(resolveCaptureAsset(captureRoot, entry.uiCapture.screenshotPath))) {
      issues.push(`${step.id}: UI capture file missing ${entry.uiCapture.screenshotPath}`);
    }
    const rect = entry.uiCapture?.rect;
    if (!rect || !Number.isFinite(rect.x) || !Number.isFinite(rect.y) || !Number.isFinite(rect.width) || !Number.isFinite(rect.height) || rect.width <= 0 || rect.height <= 0) {
      issues.push(`${step.id}: uiCapture.rect must be a measured DOMRect`);
    }
  }
  if (issues.length > 0) {
    throw new Error(`Real capture manifest is incomplete:\n- ${issues.join("\n- ")}\nRun \`npm run capture:noderoom:real\` and commit the refreshed PNGs + manifest.`);
  }
  return { ...manifest, steps: entries };
}

function applyRealCaptureManifest(coachSteps, manifest) {
  const byId = new Map(manifest.steps.map((entry) => [entry.id, entry]));
  for (const step of coachSteps) {
    const entry = byId.get(step.id);
    step.sourceView = {
      ...step.sourceView,
      imagePath: entry.sourceView.imagePath,
      captureKind: entry.sourceView.captureKind,
    };
    step.uiCapture = {
      ...step.uiCapture,
      rect: entry.uiCapture.rect,
      screenshotPath: entry.uiCapture.screenshotPath,
      captureKind: entry.uiCapture.captureKind,
    };
  }
}

function resolveCaptureAsset(captureRoot, assetPath) {
  const normalized = String(assetPath).replaceAll("\\", "/");
  const relativeAsset = normalized.startsWith("captures/") ? normalized.slice("captures/".length) : normalized;
  return resolve(captureRoot, relativeAsset);
}

function writeCaptureAssets({ captureRoot, coachSteps, graphEdges, graphNodes, sourceMode, realCaptureManifest, allowGeneratedCaptures }) {
  const graphPath = resolve(captureRoot, "noderoom-trace-knowledge-graph.json");
  const fallbackGraph = {
    generator: "nodetrace trace-coach:sqlite",
    sourceRepo: "HomenShum/noderoom",
    sourceMode,
    model: "NodeTrace fallback codebase minimap",
    note: "Portable fallback subset of the NodeRoom trace UI graph. Run npm run understand:noderoom to refresh this file from Understand-Anything deterministic scripts.",
    nodes: graphNodes,
    edges: graphEdges,
    guidedTour: coachSteps.map((step) => ({
      id: step.id,
      label: step.stepLabel,
      nodeId: step.diagram.nodeId,
      filePath: step.codeBlock.filePath,
      selector: step.uiCapture.selector,
      summary: step.title,
    })),
  };
  const graph = loadUnderstandAnythingGraph(graphPath) ?? fallbackGraph;
  writeJson(graphPath, graph);
  const minimapNodes = normalizeGraphNodes(graph.nodes, graphNodes);
  const minimapEdges = normalizeGraphEdges(graph.edges, graphEdges, minimapNodes);
  for (const step of coachSteps) {
    if (!realCaptureManifest && allowGeneratedCaptures) {
      writeFileSync(resolve(captureRoot, `${step.id}-ide.svg`), renderIdeSvg(step));
      writeFileSync(resolve(captureRoot, `${step.id}-ui.svg`), renderUiTargetSvg(step));
    } else {
      for (const assetPath of [step.sourceView.imagePath, step.uiCapture.screenshotPath]) {
        const resolved = resolveCaptureAsset(captureRoot, assetPath);
        if (!existsSync(resolved)) throw new Error(`real capture asset missing: ${resolved}`);
      }
    }
    writeFileSync(resolve(captureRoot, `${step.id}-minimap.svg`), renderMinimapSvg(step, minimapNodes, minimapEdges, graph));
  }
  return graph;
}

function loadUnderstandAnythingGraph(path) {
  if (!existsSync(path)) return null;
  try {
    const graph = JSON.parse(readFileSync(path, "utf8"));
    if (String(graph.generator ?? "").includes("Understand-Anything")) return graph;
  } catch {
    return null;
  }
  return null;
}

function normalizeGraphNodes(nodes, fallbackNodes) {
  const fallbackById = new Map(fallbackNodes.map((node) => [node.id, node]));
  const sourceNodes = Array.isArray(nodes) && nodes.length > 0 ? nodes : fallbackNodes;
  return sourceNodes
    .filter((node) => node && typeof node.id === "string")
    .map((node, index) => {
      const fallback = fallbackById.get(node.id);
      return {
        ...fallback,
        ...node,
        x: typeof node.x === "number" ? node.x : fallback?.x ?? 96 + (index % 4) * 218,
        y: typeof node.y === "number" ? node.y : fallback?.y ?? 180 + Math.floor(index / 4) * 154,
      };
    });
}

function normalizeGraphEdges(edges, fallbackEdges, nodes) {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const sourceEdges = Array.isArray(edges) && edges.length > 0 ? edges : fallbackEdges;
  return sourceEdges
    .filter((edge) => edge && nodeIds.has(edge.from) && nodeIds.has(edge.to))
    .map((edge, index) => ({
      id: edge.id ?? `edge-${index}`,
      from: edge.from,
      to: edge.to,
      label: edge.label ?? "related",
      source: edge.source,
    }));
}

function renderIdeSvg(step) {
  const codeLines = step.codeBlock.snippet.split(/\r?\n/).slice(0, 24);
  const treeLines = step.sourceView.folderTree;
  const activeName = step.codeBlock.filePath.split("/").at(-1);
  const lineHeight = 18;
  const codeY = 116;
  const code = codeLines
    .map((line, index) => {
      const y = codeY + index * lineHeight;
      const number = String(step.codeBlock.startLine + index).padStart(4, " ");
      const escaped = escapeXml(line.slice(0, 98));
      const isHot = index >= 0 && index <= Math.min(6, codeLines.length - 1);
      return `${isHot ? `<rect x="344" y="${y - 13}" width="806" height="18" rx="4" fill="rgba(232,120,85,0.16)"/>` : ""}<text x="292" y="${y}" fill="#76808c" font-size="12">${number}</text><text x="352" y="${y}" fill="#e5eaf0" font-size="12">${escaped || " "}</text>`;
    })
    .join("\n");
  const tree = treeLines
    .map((line, index) => {
      const y = 128 + index * 24;
      const active = line.trim().endsWith(activeName);
      return `${active ? `<rect x="36" y="${y - 17}" width="210" height="24" rx="6" fill="rgba(232,120,85,0.18)" stroke="rgba(232,120,85,0.48)"/>` : ""}<text x="48" y="${y}" fill="${active ? "#ffb195" : "#aab3be"}" font-size="12">${escapeXml(line)}</text>`;
    })
    .join("\n");
  return svgFrame(`
    <rect width="1200" height="720" rx="24" fill="#0b0f14"/>
    <rect x="24" y="24" width="1152" height="672" rx="18" fill="#101317" stroke="#2b333d"/>
    <rect x="24" y="24" width="1152" height="46" rx="18" fill="#171b21"/>
    <circle cx="52" cy="47" r="6" fill="#e87855"/><circle cx="72" cy="47" r="6" fill="#e5b567"/><circle cx="92" cy="47" r="6" fill="#78d39f"/>
    <text x="120" y="52" fill="#f2f4f7" font-size="14" font-weight="700">Generated source fallback - ${escapeXml(step.sourceView.repositoryRoot)}</text>
    <rect x="24" y="70" width="244" height="626" fill="#0d1014"/>
    <text x="42" y="100" fill="#ffb195" font-size="12" font-weight="800">EXPLORER</text>
    ${tree}
    <rect x="268" y="70" width="908" height="626" fill="#0d1117"/>
    <rect x="288" y="88" width="360" height="28" rx="8" fill="#171b21" stroke="#333b46"/>
    <text x="304" y="107" fill="#f2f4f7" font-size="12" font-weight="700">${escapeXml(step.codeBlock.filePath)}</text>
    <text x="982" y="107" fill="#99a3ae" font-size="11">lines ${step.codeBlock.startLine}-${step.codeBlock.endLine}</text>
    <rect x="284" y="128" width="34" height="520" fill="#0b0f14"/>
    <rect x="340" y="128" width="2" height="520" fill="#252b33"/>
    ${code}
    <rect x="1060" y="142" width="68" height="360" rx="6" fill="#111820" stroke="#252b33"/>
    <rect x="1072" y="162" width="44" height="112" rx="4" fill="rgba(232,120,85,0.32)"/>
    <text x="292" y="676" fill="#7cc7ff" font-size="12">Exact source slice from ${escapeXml(step.codeBlock.filePath)}. Generated by NodeTrace; no editor automation required.</text>
  `);
}

function renderUiTargetSvg(step) {
  const normalized = normalizeRect(step.uiCapture.rect);
  return svgFrame(`
    <rect width="1200" height="720" rx="24" fill="#080a0d"/>
    <rect x="34" y="34" width="1132" height="652" rx="20" fill="#101317" stroke="#2b333d"/>
    <rect x="34" y="34" width="1132" height="54" rx="20" fill="#171b21"/>
    <text x="60" y="68" fill="#f2f4f7" font-size="15" font-weight="800">NodeRoom UI target recomposition</text>
    <text x="910" y="68" fill="#99a3ae" font-size="12">selector: ${escapeXml(step.uiCapture.selector)}</text>
    <rect x="60" y="114" width="252" height="532" rx="14" fill="#0d1014" stroke="#252b33"/>
    <text x="84" y="148" fill="#ffb195" font-size="12" font-weight="800">TRACE RECORDS</text>
    ${uiRecordRows(step)}
    <rect x="336" y="114" width="796" height="532" rx="14" fill="#0d1117" stroke="#252b33"/>
    <text x="362" y="154" fill="#f2f4f7" font-size="20" font-weight="800">${escapeXml(step.title)}</text>
    <text x="362" y="184" fill="#99a3ae" font-size="13">${escapeXml(step.narrative.slice(0, 112))}</text>
    <rect x="362" y="214" width="74" height="32" rx="8" fill="rgba(232,120,85,0.16)" stroke="rgba(232,120,85,0.46)"/>
    <text x="384" y="235" fill="#ffb195" font-size="12" font-weight="800">Overview</text>
    <rect x="448" y="214" width="58" height="32" rx="8" fill="#171b21"/><text x="466" y="235" fill="#c6ccd4" font-size="12">Steps</text>
    <rect x="516" y="214" width="78" height="32" rx="8" fill="#171b21"/><text x="536" y="235" fill="#c6ccd4" font-size="12">Minimap</text>
    <rect x="604" y="214" width="78" height="32" rx="8" fill="#171b21"/><text x="622" y="235" fill="#c6ccd4" font-size="12">Raw JSON</text>
    <rect x="362" y="276" width="344" height="300" rx="12" fill="#171b21" stroke="#252b33"/>
    <text x="384" y="314" fill="#f2f4f7" font-size="14" font-weight="800">Code evidence</text>
    <text x="384" y="346" fill="#99a3ae" font-size="12">${escapeXml(step.codeBlock.filePath)}</text>
    <rect x="734" y="276" width="370" height="300" rx="12" fill="#10151b" stroke="#252b33"/>
    <text x="756" y="314" fill="#f2f4f7" font-size="14" font-weight="800">UI evidence</text>
    <rect x="${normalized.x}" y="${normalized.y}" width="${normalized.width}" height="${normalized.height}" rx="8" fill="rgba(232,120,85,0.2)" stroke="#e87855" stroke-width="3"/>
    <path d="M${normalized.x + normalized.width} ${normalized.y + 18} L1038 164" stroke="#e87855" stroke-width="2" fill="none"/>
    <rect x="892" y="126" width="230" height="54" rx="10" fill="#271711" stroke="#e87855"/>
    <text x="908" y="150" fill="#ffb195" font-size="12" font-weight="800">DOMRect target</text>
    <text x="908" y="168" fill="#e5eaf0" font-size="11">x${step.uiCapture.rect.x} y${step.uiCapture.rect.y} w${step.uiCapture.rect.width} h${step.uiCapture.rect.height}</text>
    <text x="60" y="674" fill="#7cc7ff" font-size="12">${escapeXml(step.uiCapture.alt)}</text>
  `);
}

function renderMinimapSvg(step, graphNodes, graphEdges, graph) {
  const backedByUnderstandAnything = String(graph?.generator ?? "").includes("Understand-Anything");
  const graphLabel = backedByUnderstandAnything ? "Understand-Anything-backed graph" : "NodeTrace fallback graph";
  const nodeById = new Map(graphNodes.map((node) => [node.id, node]));
  const edges = graphEdges
    .map((edge) => {
      const from = nodeById.get(edge.from);
      const to = nodeById.get(edge.to);
      if (!from || !to) return "";
      return `<path d="M${from.x + 116} ${from.y + 34} C${from.x + 170} ${from.y + 34}, ${to.x - 38} ${to.y + 34}, ${to.x} ${to.y + 34}" stroke="#3d4652" stroke-width="3" fill="none"/><text x="${(from.x + to.x) / 2 + 36}" y="${(from.y + to.y) / 2 + 24}" fill="#7f8994" font-size="10">${escapeXml(edge.label.slice(0, 28))}</text>`;
    })
    .join("\n");
  const nodes = graphNodes
    .map((node) => {
      const active = node.id === step.diagram.nodeId;
      return `<g>
        <rect x="${node.x}" y="${node.y}" width="156" height="70" rx="14" fill="${active ? "rgba(232,120,85,0.22)" : "#171b21"}" stroke="${active ? "#e87855" : "#333b46"}" stroke-width="${active ? 3 : 1}"/>
        <text x="${node.x + 14}" y="${node.y + 24}" fill="${active ? "#ffb195" : "#f2f4f7"}" font-size="13" font-weight="800">${escapeXml(node.label)}</text>
        <text x="${node.x + 14}" y="${node.y + 44}" fill="#99a3ae" font-size="10">${escapeXml(node.layer)}</text>
        <text x="${node.x + 14}" y="${node.y + 60}" fill="#7cc7ff" font-size="9">${escapeXml(node.filePath)}</text>
      </g>`;
    })
    .join("\n");
  return svgFrame(`
    <rect width="1200" height="720" rx="24" fill="#080a0d"/>
    <rect x="32" y="32" width="1136" height="656" rx="22" fill="#101317" stroke="#2b333d"/>
    <text x="62" y="74" fill="#f2f4f7" font-size="18" font-weight="800">NodeRoom trace knowledge minimap</text>
    <text x="62" y="98" fill="#99a3ae" font-size="12">${escapeXml(graphLabel)}: layers, files, guided tour node, and current trace focus.</text>
    <rect x="60" y="126" width="884" height="492" rx="18" fill="#0d1117" stroke="#252b33"/>
    ${edges}
    ${nodes}
    <rect x="972" y="126" width="150" height="492" rx="16" fill="#0d1014" stroke="#252b33"/>
    <text x="992" y="160" fill="#ffb195" font-size="12" font-weight="800">MINIMAP</text>
    <rect x="996" y="186" width="102" height="250" rx="10" fill="#111820" stroke="#333b46"/>
    ${graphNodes.map((node) => `<circle cx="${1008 + node.x / 10}" cy="${198 + node.y / 10}" r="${node.id === step.diagram.nodeId ? 6 : 4}" fill="${node.id === step.diagram.nodeId ? "#e87855" : "#7cc7ff"}"/>`).join("\n")}
    <rect x="1000" y="210" width="78" height="86" rx="7" fill="rgba(232,120,85,0.12)" stroke="#e87855"/>
    <text x="992" y="472" fill="#f2f4f7" font-size="12" font-weight="800">Active node</text>
    <text x="992" y="494" fill="#ffb195" font-size="12">${escapeXml(step.diagram.nodeId)}</text>
    <text x="62" y="654" fill="#7cc7ff" font-size="12">Graph JSON: ${escapeXml(step.mapCapture.graphPath)}. Refresh with npm run understand:noderoom.</text>
  `);
}

function uiRecordRows(step) {
  const rows = ["Artifact entry", "Trace tabs", "Trace data", "Step evidence", "Flow graph", "Trace styling"];
  return rows
    .map((row, index) => {
      const y = 174 + index * 70;
      const active = step.order === index + 1;
      return `<rect x="82" y="${y}" width="206" height="54" rx="10" fill="${active ? "rgba(232,120,85,0.18)" : "#171b21"}" stroke="${active ? "#e87855" : "#252b33"}"/><text x="100" y="${y + 24}" fill="${active ? "#ffb195" : "#f2f4f7"}" font-size="12" font-weight="800">${row}</text><text x="100" y="${y + 42}" fill="#99a3ae" font-size="10">Step ${String(index + 1).padStart(2, "0")}</text>`;
    })
    .join("\n");
}

function normalizeRect(rect) {
  const width = Math.max(60, Math.min(270, Math.round((rect.width / 1080) * 370)));
  const height = Math.max(34, Math.min(180, Math.round((rect.height / 620) * 300)));
  const x = 734 + Math.max(16, Math.min(336 - width, Math.round((rect.x / 1080) * 330)));
  const y = 276 + Math.max(42, Math.min(264 - height, Math.round((rect.y / 1180) * 250)));
  return { x, y, width, height };
}

function svgFrame(body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="720" viewBox="0 0 1200 720" role="img">\n<style>text{font-family:Inter,Segoe UI,Arial,sans-serif}.mono{font-family:Consolas,Menlo,monospace}</style>\n${body}\n</svg>\n`;
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function nodeRoomSourceSnapshots() {
  return {
  "src/ui/panels/Artifact.tsx": `
function TraceStrip({ roomId }: { roomId: string }) {
  return (
    <div className="r-trace" data-testid="room-trace" data-open={String(open)} data-noderoom-surface="workSurface.traceStrip">
      <div className="r-trace-head">
        <button type="button" className="r-trace-toggle" onClick={() => setOpen((v) => !v)}>
          <ChevronRight size={13} className="r-trace-chev" />
          <span className="h-title">Room trace</span>
        </button>
      </div>
      {open && <div className="r-trace-list" aria-live="polite" aria-label="Room activity log" />}
    </div>
  );
}
`,
  "src/ui/panels/TraceSurface.tsx": `
type DetailTab = "overview" | "steps" | "flow" | "evidence" | "raw";

export function TraceSurface({ roomId, onOpenSource }) {
  const records = buildRecords(roomId);
  const [selectedId, setSelectedId] = useState(records[0]?.id);
  const [tab, setTab] = useState<DetailTab>("overview");
  const record = records.find((r) => r.id === selectedId) ?? records[0];
  const detailTabs = (["overview", "steps", "flow", "evidence", "raw"] as DetailTab[])
    .filter((t) => t !== "evidence" || (record.evidenceCards?.length ?? 0) > 0);
  return (
    <div className="r-art-body r-tracevu" data-testid="trace-surface" data-noderoom-surface="workSurface.trace">
      <aside className="r-tracevu-list" aria-label="Trace records" />
      <div className="r-tracevu-detail">
        <header className="r-tracevu-detail-head">
          <div className="r-tracevu-tabs" role="tablist" aria-label="Trace detail" />
        </header>
      </div>
    </div>
  );
}
`,
  "src/ui/panels/traceData.ts": `
export interface TraceStep {
  idx: number;
  label: string;
  detail?: string;
  status: TraceTone;
  group?: string;
  targetArtifactId?: string;
  targetElementId?: string;
  screenshotUrl?: string;
  metrics?: { label: string; value: string }[];
  attachments?: TraceAttachment[];
}

export interface TraceRecord {
  id: string;
  kind: "agent" | "qa";
  title: string;
  subtitle: string;
  ts: string;
  source: { tool: string; version?: string; env?: string; model?: string };
  verdict?: { label: string; tone: TraceTone };
  attribution?: { ai: number; mixed: number; human: number };
  steps: TraceStep[];
  evidenceCards?: EvidenceCardArtifact[];
  raw: unknown;
}
`,
  "src/ui/panels/TraceStepRow.tsx": `
export function StepRow({ s, onOpenSource }) {
  return (
    <div className="r-tracevu-step" data-testid="trace-step" data-tone={s.status}>
      <span className="r-tracevu-step-idx">{s.idx}</span>
      <span className="r-tracevu-step-body">
        <span className="r-tracevu-step-label">{s.label}</span>
        {shots.map((a, i) => (
          <a key={i} className="r-tracevu-shotlink" href={a.url}>
            <span className="r-tracevu-shotframe">
              <img className="r-tracevu-shot" src={a.url} alt={a.label ?? s.label} loading="lazy" />
              {a.box && <span className="r-tracevu-box" style={{ left: \`\${a.box.x * 100}%\`, top: \`\${a.box.y * 100}%\`, width: \`\${a.box.w * 100}%\`, height: \`\${a.box.h * 100}%\` }} aria-hidden="true" />}
            </span>
          </a>
        ))}
      </span>
    </div>
  );
}
`,
  "src/ui/panels/TraceFlow.tsx": `
export function TraceFlow({ record, onOpenSource }) {
  const phases = useMemo(() => {
    const seen: string[] = [];
    for (const s of record.steps) { const g = s.group ?? "Steps"; if (!seen.includes(g)) seen.push(g); }
    return seen;
  }, [record]);
  const { nodes, edges } = useMemo(() => {
    const COL = 248, ROW = 88;
    const nodes = record.steps.map((s) => ({
      id: String(s.idx),
      position: { x: phases.indexOf(s.group ?? "Steps") * COL, y: s.idx * ROW },
      data: { label: \`\${s.idx}. \${s.label}\` },
    }));
    const edges = [];
    for (let i = 0; i < record.steps.length - 1; i++) edges.push({ id: \`f\${i}\`, source: String(record.steps[i].idx), target: String(record.steps[i + 1].idx) });
    return { nodes, edges };
  }, [record, phases]);
  return <div className="r-tracevu-flow" data-testid="trace-flow" />;
}
`,
  "src/app/styles.css": `
.r-tracevu-tabs { display: flex; gap: 2px; }
.r-tracevu-tabs button { padding: 6px 11px; border: 0; border-bottom: 2px solid transparent; background: transparent; color: var(--text-muted); font-size: 12px; font-weight: 600; cursor: pointer; }
.r-tracevu-tabs button[data-on="true"] { color: var(--accent-ink); border-bottom-color: var(--accent-primary); }
.r-tracevu-detail-body { flex: 1; min-height: 0; overflow-y: auto; padding: 16px; }
.r-tracevu-steps { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.r-tracevu-step { width: 100%; display: flex; gap: 11px; text-align: left; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--line); background: var(--bg-secondary); color: var(--text-secondary); }
.r-tracevu-step-idx { flex: none; width: 22px; height: 22px; display: grid; place-items: center; border-radius: 6px; background: var(--bg-primary); color: var(--text-muted); font-size: 11px; font-weight: 700; font-family: var(--font-mono); }
.r-tracevu-shotframe { position: relative; display: inline-block; line-height: 0; }
.r-tracevu-box { position: absolute; border: 2px solid var(--accent-primary); border-radius: 3px; background: color-mix(in srgb, var(--accent-primary) 16%, transparent); box-shadow: 0 0 0 1px var(--bg-primary); pointer-events: none; }
`,
  };
}
