/**
 * Regression probe: the live-graph-rail capture must never photograph a
 * process it did not start.
 *
 * Run from the repo root:  npm run promotion:capture-identity
 *
 * Two phases, because the fix has two layers and a layer nobody watched run is
 * a layer nobody has proved:
 *
 *   1. End to end. An impostor sits on the exact port the capture script uses —
 *      same <title>NodeTrace</title>, same [data-testid="live-graph-rail"], a
 *      fat data-entity-count — and the real `scripts/capture-live-graph-rail.mjs`
 *      is run against it. It must exit nonzero and touch no artifact. The
 *      pre-fix script exited 0, printed `PASS (14 entities, 31 traversal edges)`
 *      and overwrote docs/screenshots/live-graph-rail.png with the impostor.
 *      (If the port is already held by something else — another checkout of
 *      this app, which is how the defect was found — that listener is the
 *      impostor and no new one is started.)
 *
 *   2. The page-identity assertion itself, both directions, in a real browser:
 *      it must throw on the impostor and pass on a server started from this
 *      working tree. Layer 1 normally fires first, so without this the second
 *      layer would ship unobserved.
 *
 * Writes: promotion/evidence/capture-identity-regression.json
 */

import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { createServer as createSocketServer } from "node:net";
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { chromium } from "playwright";
import {
  PORT_ENV,
  assertPageIsThisTree,
  killTree,
  startVite,
  waitForServer,
} from "../../scripts/lib/proof-server.mjs";

const PORT = Number(process.env[PORT_ENV] ?? 5187);
const HOST = "127.0.0.1";
const ARTIFACT = join("docs", "screenshots", "live-graph-rail.png");
const BACKUP = `${ARTIFACT}.regression-backup`;
const REPORT = join("promotion", "evidence", "capture-identity-regression.json");
const IMPOSTOR_ENTITIES = 4242;

const issues = [];
const observed = { port: PORT };

// ---- phase 1: run the real capture script against an impostor ----------------
if (existsSync(ARTIFACT)) copyFileSync(ARTIFACT, BACKUP);
const before = digest(ARTIFACT);
const impostor = await listen(PORT);
observed.impostor = impostor ? "started by this probe" : "a foreign process already held the port";

const run = spawnSync(process.execPath, ["scripts/capture-live-graph-rail.mjs"], {
  cwd: process.cwd(),
  encoding: "utf8",
  timeout: 300_000,
});
const output = [run.stdout, run.stderr].filter(Boolean).join("\n");
const after = digest(ARTIFACT);
observed.exitCode = run.status;
observed.lastLine = output.trim().split(/\r?\n/).filter(Boolean).at(-1) ?? "";
observed.artifactShaBefore = before;
observed.artifactShaAfter = after;
observed.artifactRewritten = before !== after;

if (run.status === 0) issues.push(`capture script exited 0 while a foreign process held port ${PORT}`);
if (/capture: PASS/.test(output)) issues.push("capture script printed PASS against the impostor");
if (observed.artifactRewritten) issues.push(`${ARTIFACT} was rewritten from a page this checkout did not serve`);
if (run.status !== 0 && !/already in use|different public\/nodetrace-state\.json/.test(output)) {
  issues.push(`capture script failed, but not on port ownership or page identity: ${observed.lastLine}`);
}

// A pre-fix tree leaves the impostor's picture behind; do not keep it.
if (observed.artifactRewritten && existsSync(BACKUP)) {
  copyFileSync(BACKUP, ARTIFACT);
  observed.artifactRestored = true;
}
if (existsSync(BACKUP)) rmSync(BACKUP);

// ---- phase 2: the page-identity assertion, both directions -------------------
let vite;
let browser;
try {
  const impostorPort = impostor ? impostor.address().port : await freePort();
  const impostorHere = impostor ?? (await listen(impostorPort));
  const vitePort = await freePort();
  vite = startVite(vitePort);
  await waitForServer(`http://${HOST}:${vitePort}/`, 60_000);

  browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto(`http://${HOST}:${impostorPort}/`, { waitUntil: "load" });
  observed.identityRejectsImpostor = await throws(() => assertPageIsThisTree(page));
  if (!observed.identityRejectsImpostor) {
    issues.push("assertPageIsThisTree accepted an impostor page titled NodeTrace");
  }

  await page.goto(`http://${HOST}:${vitePort}/`, { waitUntil: "load" });
  const rejection = await throws(() => assertPageIsThisTree(page));
  observed.identityAcceptsThisTree = rejection === false;
  if (rejection !== false) issues.push(`assertPageIsThisTree rejected this working tree: ${rejection}`);

  if (impostorHere !== impostor) impostorHere?.close();
} catch (error) {
  issues.push(`identity assertion phase failed to run: ${error.message}`);
} finally {
  if (browser) await browser.close().catch(() => {});
  killTree(vite);
  impostor?.close();
}

const report = {
  ok: issues.length === 0,
  probe: "capture-identity — the capture script must not photograph a foreign process",
  completedAt: new Date().toISOString(),
  observed,
  issues,
};
mkdirSync(dirname(REPORT), { recursive: true });
writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`);

if (issues.length > 0) {
  console.error("capture identity regression: FAIL");
  for (const issue of issues) console.error(`  - ${issue}`);
  process.exit(1);
}
console.log(
  `capture identity regression: PASS (exit ${observed.exitCode}, artifact untouched, impostor rejected, this tree accepted)`,
);

function digest(path) {
  if (!existsSync(path)) return null;
  return createHash("sha256").update(readFileSync(path)).digest("hex").slice(0, 16);
}

/** false when fn resolved; the error message when it threw. */
async function throws(fn) {
  try {
    await fn();
    return false;
  } catch (error) {
    return error.message;
  }
}

async function freePort() {
  return await new Promise((resolve) => {
    const socket = createSocketServer();
    socket.listen(0, HOST, () => {
      const { port } = socket.address();
      socket.close(() => resolve(port));
    });
  });
}

/** An impostor convincing enough that every pre-fix assertion passed on it. */
async function listen(port) {
  const server = createServer((request, response) => {
    if (request.url?.startsWith("/nodetrace-state.json")) {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ generatedAt: "impostor", session: { id: "impostor" } }));
      return;
    }
    response.writeHead(200, { "content-type": "text/html" });
    response.end(`<!doctype html>
<html lang="en"><head><meta charset="UTF-8" /><title>NodeTrace</title></head>
<body style="margin:0;background:#0b1020">
  <div data-testid="live-graph-rail" data-entity-count="${IMPOSTOR_ENTITIES}" data-edge-count="${IMPOSTOR_ENTITIES}"
       style="width:900px;height:420px;background:#132043;color:#7fe3ff;font:600 28px system-ui;display:flex;align-items:center;justify-content:center">
    NOT THIS CHECKOUT — impostor on port ${port}
  </div>
</body></html>
`);
  });
  return await new Promise((resolve) => {
    server.once("error", () => resolve(null)); // EADDRINUSE: something else is the impostor
    server.listen(port, HOST, () => resolve(server));
  });
}
