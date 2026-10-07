/**
 * Regression probe: no capture script may write an artifact of a graph canvas
 * that never painted.
 *
 * Run from the repo root:  npm run promotion:capture-paint
 *
 * The defect, observed: the rail's `data-entity-count` is React state and stays
 * correct through a dead canvas. On 2026-08-13 one of three capture runs wrote
 * docs/screenshots/live-graph-rail.png with the labels drawn, no node rings and
 * Chromium's broken-image placeholder over the canvas box, and printed
 * `PASS (10 entities, 15 traversal edges)`. The committed
 * promotion/evidence/capture-identity-before-foreign-checkout.png is the same
 * emptiness. Reading an attribute and then sleeping 1500ms for the force layout
 * cannot tell a settled graph from an empty one; only the pixels can.
 *
 * Three phases:
 *
 *   1. Who photographs the rail — FOUND, not listed. Every .mjs under scripts/
 *      and promotion/probes/ that both names the rail and writes a screenshot
 *      file or a video must call `waitForPaintedGraph`. A hand-maintained list
 *      of callers cannot see the one nobody remembered; this found
 *      promotion/probes/j4-installed-target-proof.mjs, which had the same
 *      attribute-read-then-sleep(1500) and photographs the rail inside an
 *      installed Next app.
 *
 *   2. Hollow: the real, unmodified scripts/capture-live-graph-rail.mjs run
 *      against a browser whose WebGL contexts initialise and then draw nothing
 *      (promotion/probes/lose-webgl-context.mjs). It must exit nonzero, name the
 *      paint gate, and leave the artifact byte-identical. Before this fix that
 *      same command exited 0, printed
 *      `PASS (10 entities, 15 traversal edges)`, and overwrote the artifact with
 *      an empty picture (0 coloured pixels).
 *
 *   3. Real: the same script, same port, no fault injected. It must exit 0 and
 *      report painted node rings — a gate that only ever fails is not a gate.
 *
 * Writes: promotion/evidence/capture-paint-regression.json
 */

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, posix, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ARTIFACT = join("docs", "screenshots", "live-graph-rail.png");
const BACKUP = `${ARTIFACT}.paint-regression-backup`;
const REPORT = join("promotion", "evidence", "capture-paint-regression.json");
const CAPTURE = join("scripts", "capture-live-graph-rail.mjs");
const INJECTOR = join("promotion", "probes", "lose-webgl-context.mjs");
const GATE = "waitForPaintedGraph";

const issues = [];
const observed = {};

// ---- phase 1: find every script that photographs the rail --------------------
const photographers = [...walk("scripts"), ...walk(join("promotion", "probes"))]
  .filter((file) => resolve(file) !== fileURLToPath(import.meta.url)) // the scanner is not a caller
  .filter((file) => {
    const source = readFileSync(file, "utf8");
    const showsTheRail = /live-graph-rail|nodegraph-canvas|GRAPH_CANVAS/.test(source);
    // Writes a file, rather than reading pixels into a buffer: the gate itself
    // screenshots the canvas, and it is the gate, not a caller of it.
    const writesAnArtifact = /screenshot\([^)]*path:|recordVideo/s.test(source);
    return showsTheRail && writesAnArtifact;
  })
  .map((file) => file.split(sep).join(posix.sep));

observed.railPhotographers = photographers;
observed.ungated = photographers.filter(
  (file) => !new RegExp(`${GATE}\\(`).test(readFileSync(file, "utf8")),
);
if (photographers.length === 0) {
  issues.push("found no scripts that photograph the rail — the discovery scan is broken, not the repo");
}
for (const file of observed.ungated) {
  issues.push(`${file} writes an artifact of the graph canvas without calling ${GATE}`);
}

// ---- phase 2: the real capture script, against a canvas that cannot paint ----
const before = digest(ARTIFACT);
if (existsSync(ARTIFACT)) copyFileSync(ARTIFACT, BACKUP); // a pre-fix tree leaves an empty picture behind
const hollow = runCapture({
  NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --import=${pathToFileURL(join(process.cwd(), INJECTOR)).href}`.trim(),
});
observed.hollow = {
  exitCode: hollow.status,
  lastLine: hollow.lastLine,
  artifactRewritten: digest(ARTIFACT) !== before,
};
if (hollow.status === 0) issues.push("capture script exited 0 with a graph canvas that painted nothing");
if (/capture: PASS/.test(hollow.output)) issues.push("capture script printed PASS over an empty canvas");
if (observed.hollow.artifactRewritten) issues.push(`${ARTIFACT} was rewritten from a canvas that painted nothing`);
if (hollow.status !== 0 && !/painted 0 node rings/.test(hollow.output)) {
  issues.push(`capture script failed, but not on the paint gate: ${hollow.lastLine}`);
}
if (observed.hollow.artifactRewritten && existsSync(BACKUP)) {
  copyFileSync(BACKUP, ARTIFACT);
  observed.hollow.artifactRestored = true;
}
if (existsSync(BACKUP)) rmSync(BACKUP);

// ---- phase 3: the same script with nothing injected -------------------------
const real = runCapture({});
observed.real = {
  exitCode: real.status,
  lastLine: real.lastLine,
  artifactRewritten: digest(ARTIFACT) !== before,
};
observed.real.paintedNodes = Number(/(\d+) node rings painted/.exec(real.output)?.[1] ?? 0);
if (real.status !== 0) issues.push(`capture script failed on a healthy canvas: ${real.lastLine}`);
if (!(observed.real.paintedNodes > 0)) {
  issues.push("capture script passed without reporting any painted node rings");
}

const report = {
  ok: issues.length === 0,
  probe: "capture-paint — no artifact may be written of a graph canvas that never painted",
  completedAt: new Date().toISOString(),
  observed,
  issues,
};
mkdirSync(dirname(REPORT), { recursive: true });
writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`);

if (issues.length > 0) {
  console.error("capture paint regression: FAIL");
  for (const issue of issues) console.error(`  - ${issue}`);
  process.exit(1);
}
console.log(
  `capture paint regression: PASS (${photographers.length} rail photographers, all gated; ` +
    `hollow run exit ${observed.hollow.exitCode} artifact untouched; ` +
    `real run ${observed.real.paintedNodes} rings painted)`,
);

function runCapture(env) {
  const run = spawnSync(process.execPath, [CAPTURE], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, ...env },
    timeout: 300_000,
  });
  const output = [run.stdout, run.stderr].filter(Boolean).join("\n");
  return {
    status: run.status,
    output,
    lastLine: output.trim().split(/\r?\n/).filter(Boolean).at(-1) ?? "",
  };
}

function walk(dir) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...walk(path));
    else if (entry.name.endsWith(".mjs")) found.push(path);
  }
  return found;
}

function digest(path) {
  if (!existsSync(path)) return null;
  return createHash("sha256").update(readFileSync(path)).digest("hex").slice(0, 16);
}
