import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

const startedAt = new Date();
const tempDir = mkdtempSync(join(tmpdir(), "nodetrace-smoke-"));
const dbPath = join(tempDir, "nodetrace.sqlite");
const statePath = join(tempDir, "nodetrace-state.json");
const reportPath = join(tempDir, "happy-path.json");
const result = spawnSync(process.execPath, ["scripts/init-sqlite.mjs", "--db", dbPath, "--state", statePath, "--json-out", reportPath], {
  cwd: process.cwd(),
  encoding: "utf8",
});

const issues = [];
if (result.status !== 0) issues.push(`happy path failed: ${[result.stdout, result.stderr].join("\n").slice(-1200)}`);
for (const file of [dbPath, statePath, reportPath]) {
  if (!existsSync(file)) issues.push(`missing ${file}`);
}

if (issues.length === 0) {
  const state = JSON.parse(readFileSync(statePath, "utf8"));
  const provider = readFileSync("src/trace/TraceLensProvider.tsx", "utf8");
  const panel = readFileSync("src/trace/TraceLensPanel.tsx", "utf8");
  const schema = readFileSync("db/schema.sql", "utf8");
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  const readme = readFileSync("README.md", "utf8");
  const walkthrough = readFileSync("docs/WALKTHROUGH.md", "utf8");
  const porting = readFileSync("docs/PORTING.md", "utf8");
  const agentNotes = readFileSync("AGENTS.md", "utf8");
  const coachGraph = JSON.parse(readFileSync("public/captures/noderoom-trace-knowledge-graph.json", "utf8"));
  const realCaptureManifest = JSON.parse(readFileSync("public/captures/noderoom-real-capture-manifest.json", "utf8"));
  const coachReport = JSON.parse(readFileSync("docs/eval/nodetrace-trace-coach-sqlite.json", "utf8"));
  for (const required of ["surfaces", "proofs", "traces", "builderCapable"]) {
    if (!(required in state)) issues.push(`state missing ${required}`);
  }
  for (const required of ["data-nodetrace-surface", "data-noderoom-surface", "resolveTraceHit"]) {
    if (!provider.includes(required)) issues.push(`TraceLensProvider missing ${required}`);
  }
  for (const required of ["Business proof", "Runtime trace", "Code ownership", "Builder", "Review", "Query", "Mutation", "Skill"]) {
    if (!panel.includes(required)) issues.push(`TraceLensPanel missing ${required}`);
  }
  for (const table of ["trace_sessions", "trace_surfaces", "trace_proofs", "trace_events", "trace_code_ownership", "trace_coach_steps", "trace_coach_graph_nodes", "trace_coach_graph_edges"]) {
    if (!schema.includes(table)) issues.push(`schema missing ${table}`);
  }
  for (const column of ["query_ref", "mutation_ref", "skill_ref", "step_label", "step_group"]) {
    if (!schema.includes(column)) issues.push(`schema missing ${column}`);
  }
  for (const required of [
    "docs/AGENT_TRACE_ADOPTION.md",
    "docs/WALKTHROUGH.md",
    "nodetrace-dashboard.png",
    "nodetrace-trace-lens.png",
    "nodetrace-walkthrough.gif",
    "nodetrace-walkthrough.mp4",
    "github:HomenShum/NodeTrace",
    "@homenshum/nodetrace",
    "--framework next",
    "npm run installer:next:e2e",
    "npm run agent:scale:smoke",
    "npm run understand:noderoom",
    "npm run capture:noderoom:real",
    "npm run trace-coach:sqlite",
    "docs/eval/nodetrace-understand-anything-noderoom.json",
    "125-step QA-agent trace",
    "examples/trace-coach-sqlite/README.md",
    "docs/eval/nodetrace-trace-coach-sqlite.png",
    "docs/eval/nodetrace-trace-coach-minimap.png",
    "public/captures/noderoom-trace-knowledge-graph.json",
    "public/captures/noderoom-real-capture-manifest.json",
    "NodeRoom codebase Trace Coach",
    ".claude/skills/real-codebase-captures/SKILL.md",
    "examples/real-codebase-capture/noderoom.capture.json",
    "nodetrace capture --plan",
    "nodetrace-capture",
    "nodetrace-mcp",
    "actual source screenshots",
    "actual running-app screenshots",
  ]) {
    if (!readme.includes(required)) issues.push(`README.md missing ${required}`);
  }
  if (!Array.isArray(pkg.files) || !pkg.files.includes(".claude/")) issues.push("package.json files list must include .claude/");
  for (const bin of ["nodetrace", "nodetrace-capture", "nodetrace-mcp"]) {
    if (!pkg.bin?.[bin]) issues.push(`package.json bin missing ${bin}`);
  }
  if (!pkg.scripts?.["capture:plan:smoke"]) issues.push("package.json scripts missing capture:plan:smoke");
  if (!pkg.scripts?.["mcp:smoke"]) issues.push("package.json scripts missing mcp:smoke");
  for (const required of ["NodeRoom trace records", "coachPanel", "evidenceShot", "Minimap", "r-tracevu-tabs", "stepLabel"]) {
    const dashboard = readFileSync("src/DemoDashboard.tsx", "utf8");
    const styles = readFileSync("src/styles.css", "utf8");
    if (!dashboard.includes(required) && !styles.includes(required)) issues.push(`coach UI missing ${required}`);
  }
  const dashboard = readFileSync("src/DemoDashboard.tsx", "utf8");
  const styles = readFileSync("src/styles.css", "utf8");
  for (const forbidden of ["Inspectable surfaces", "surfaceBand", "surfaceGrid", "railProof", "className=\"rail\"", "tracePreview", "statusGrid", "Recent agent-readable rows"]) {
    if (dashboard.includes(forbidden) || styles.includes(forbidden)) issues.push(`noninteractive surface grid still present: ${forbidden}`);
  }
  for (const required of ["--bg-app: #f5f7fb", "coachPanel", "r-tracevu-tabs"]) {
    if (!dashboard.includes(required) && !styles.includes(required)) issues.push(`light/readable trace UI missing ${required}`);
  }
  for (const required of ["npm run understand:noderoom", "npm run capture:plan:smoke", "npm run capture:noderoom:real", "docs/eval/nodetrace-understand-anything-noderoom.json", "not a hand-modeled graph", "actual code-browser source screenshots", "actual running NodeRoom screenshots", "nodetrace capture --plan", "nodetrace-mcp"]) {
    if (!agentNotes.includes(required)) issues.push(`AGENTS.md missing ${required}`);
  }
  const coachScript = readFileSync("scripts/trace-coach-sqlite.mjs", "utf8");
  for (const required of ["HomenShum/noderoom", "ordered steps only", "stepLabel", "data-noderoom-surface", "loadRealCaptureManifest", "applyRealCaptureManifest", "allowGeneratedCaptures", "renderIdeSvg", "renderUiTargetSvg", "renderMinimapSvg", "Understand-Anything-backed", "loadUnderstandAnythingGraph"]) {
    if (!coachScript.includes(required)) issues.push(`trace-coach script missing ${required}`);
  }
  const understandScript = readFileSync("scripts/understand-anything-noderoom.mjs", "utf8");
  for (const required of ["scan-project.mjs", "extract-import-map.mjs", "extract-structure.mjs", "UNDERSTAND_ANYTHING_PLUGIN_ROOT", "Understand-Anything.git", ".nodetrace/understand-anything", "Understand-Anything deterministic scripts"]) {
    if (!understandScript.includes(required)) issues.push(`understand-anything script missing ${required}`);
  }
  if (coachScript.includes("timestampLabel")) issues.push("trace-coach script still uses timestampLabel");
  if (!String(coachGraph.generator ?? "").includes("Understand-Anything")) {
    issues.push("trace coach graph is not backed by Understand-Anything output");
  }
  if (!String(coachReport.knowledgeGraphGenerator ?? "").includes("Understand-Anything")) {
    issues.push("trace coach report is not backed by Understand-Anything output");
  }
  if (!String(realCaptureManifest.captureModel ?? "").includes("actual code-browser") || !String(realCaptureManifest.captureModel ?? "").includes("actual running NodeRoom")) {
    issues.push("real capture manifest is not backed by actual code-browser and running NodeRoom captures");
  }
  if (!String(coachReport.captureModel ?? "").includes("actual code-browser") || !String(coachReport.captureModel ?? "").includes("actual running NodeRoom")) {
    issues.push("trace coach report is not backed by actual code-browser and running NodeRoom captures");
  }
  if (coachReport.realCaptureSteps !== 6 || !Array.isArray(realCaptureManifest.steps) || realCaptureManifest.steps.length !== 6) {
    issues.push("trace coach real capture manifest must cover all 6 coach steps");
  }
  for (const step of realCaptureManifest.steps ?? []) {
    if (!String(step.sourceView?.captureKind ?? "").startsWith("actual-")) issues.push(`real capture source is not actual: ${step.id}`);
    if (!String(step.uiCapture?.captureKind ?? "").startsWith("actual-")) issues.push(`real capture UI is not actual: ${step.id}`);
  }
  for (const required of [
    "Visual Walkthrough",
    "nodetrace-walkthrough.gif",
    "nodetrace-walkthrough.mp4",
    "nodetrace-dashboard.png",
    "nodetrace-trace-lens.png",
    "npx github:HomenShum/NodeTrace add",
    "--framework next",
    "npx @homenshum/nodetrace add",
    "npm run installer:next:e2e",
    "npm run agent:scale:smoke",
    "npm run understand:noderoom",
    "npm run capture:plan:smoke",
    "npm run capture:noderoom:real",
    "nodetrace-mcp",
    "setup-receipt.json",
  ]) {
    if (!walkthrough.includes(required)) issues.push(`docs/WALKTHROUGH.md missing ${required}`);
  }
  for (const required of ["Builder Access Route", "NODETRACE_BUILDER_TOKEN", "examples/builder-access/server-route.mjs", "npm run builder:smoke", "npm run installer:next:e2e", "npm run agent:scale:smoke", "npm run capture:plan:smoke", "npm run capture:noderoom:real", "nodetrace capture --plan", "nodetrace-mcp", "125-step QA-agent trace"]) {
    if (!porting.includes(required)) issues.push(`docs/PORTING.md missing ${required}`);
  }
  for (const file of [
    "docs/screenshots/nodetrace-dashboard.png",
    "docs/screenshots/nodetrace-trace-lens.png",
    "docs/walkthroughs/nodetrace-walkthrough.mp4",
    "docs/walkthroughs/nodetrace-walkthrough.gif",
    "examples/builder-access/server-route.mjs",
    "examples/qa-agent/README.md",
    "docs/AGENT_TRACE_ADOPTION.md",
    "scripts/builder-access-smoke.mjs",
    "scripts/agent-trace-scale-smoke.mjs",
    "scripts/understand-anything-noderoom.mjs",
    "scripts/trace-coach-sqlite.mjs",
    "scripts/mcp-smoke.mjs",
    "src/capture/codebaseCapture.mjs",
    "bin/nodetrace-capture.mjs",
    "bin/nodetrace-mcp.mjs",
    "examples/trace-coach-sqlite/README.md",
    "examples/real-codebase-capture/README.md",
    "examples/real-codebase-capture/noderoom.capture.json",
    ".claude/skills/real-codebase-captures/SKILL.md",
    ".claude/skills/real-codebase-captures/agents/openai.yaml",
    "docs/eval/nodetrace-understand-anything-noderoom.json",
    "docs/eval/nodetrace-trace-coach-sqlite.png",
    "docs/eval/nodetrace-trace-coach-minimap.png",
    "public/captures/coach-step-01-artifact-entry-ide.png",
    "public/captures/coach-step-01-artifact-entry-ui.png",
    "public/captures/coach-step-01-artifact-entry-minimap.svg",
    "public/captures/noderoom-real-capture-manifest.json",
    "public/captures/noderoom-trace-knowledge-graph.json",
  ]) {
    if (!existsSync(file)) issues.push(`missing ${file}`);
  }
}

const report = {
  ok: issues.length === 0,
  startedAt: startedAt.toISOString(),
  completedAt: new Date().toISOString(),
  apiKeysRequired: false,
  issues,
};

writeJson("docs/eval/nodetrace-smoke.json", report);
if (issues.length === 0) {
  console.log("nodetrace smoke: PASS");
} else {
  console.error("nodetrace smoke: FAIL");
  for (const issue of issues) console.error(`  - ${issue}`);
  process.exitCode = 1;
}

if (tempDir.startsWith(tmpdir())) rmSync(tempDir, { recursive: true, force: true });

function writeJson(path, value) {
  const parent = dirname(path);
  if (parent && parent !== "." && !existsSync(parent)) mkdirSync(parent, { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}
