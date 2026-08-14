/**
 * Capture proof for the live graph rail: run the real happy path (SQLite ->
 * public/nodetrace-state.json), start the dev server on a port this process
 * owns, prove the page in front of the camera is this working tree, require the
 * rail to report >0 entities ingested from those real trace events, and require
 * the graph canvas to have actually painted node rings before taking the
 * screenshot. A busy port, a foreign page, an empty rail or an unpainted canvas
 * exits nonzero — no capture, no claim.
 */

import { mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { chromium } from "playwright";
import {
  PORT_ENV,
  assertPageIsThisTree,
  assertPortFree,
  killTree,
  startVite,
  waitForPaintedGraph,
  waitForServer,
} from "./lib/proof-server.mjs";

const PORT = Number(process.env[PORT_ENV] ?? 5187);
const URL = `http://127.0.0.1:${PORT}/`;
const SCREENSHOT = "docs/screenshots/live-graph-rail.png";
const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

try {
  await assertPortFree(PORT);
} catch (error) {
  console.error(`live graph rail capture: FAIL (${error.message})`);
  process.exit(1);
}

const happy = spawnSync(npmCmd, ["run", "happy-path"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});
if (happy.status !== 0) {
  console.error("live graph rail capture: FAIL (happy-path exited nonzero)");
  process.exit(1);
}

const server = startVite(PORT);
let browser;
let failure = null;

try {
  await waitForServer(URL, 30_000);
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  await page.goto(URL, { waitUntil: "load" });
  // The other gate: this must be our page, not whatever else answered.
  await assertPageIsThisTree(page);

  const rail = page.locator('[data-testid="live-graph-rail"]');
  await rail.waitFor({ state: "visible", timeout: 20_000 });
  // The gate: entities must have been ingested from the real SQLite traces.
  await page.waitForFunction(
    () => {
      const el = document.querySelector('[data-testid="live-graph-rail"]');
      return el !== null && Number(el.getAttribute("data-entity-count")) > 0;
    },
    undefined,
    { timeout: 20_000 },
  );
  const entityCount = Number(await rail.getAttribute("data-entity-count"));
  const edgeCount = Number(await rail.getAttribute("data-edge-count"));
  if (!(entityCount > 0)) throw new Error(`empty rail: entity count ${entityCount}`);

  await rail.scrollIntoViewIfNeeded();
  // The last gate: wait for painted node rings, not for a fixed number of
  // milliseconds. A sleep cannot tell a settled layout from a dead canvas.
  const painted = await waitForPaintedGraph(page);
  mkdirSync("docs/screenshots", { recursive: true });
  await rail.screenshot({ path: SCREENSHOT });
  console.log(
    `live graph rail capture: PASS (${entityCount} entities, ${edgeCount} traversal edges, ` +
      `${painted.nodes} node rings painted -> ${SCREENSHOT})`,
  );
} catch (error) {
  failure = error;
} finally {
  if (browser) await browser.close().catch(() => {});
  killTree(server);
}

if (failure) {
  console.error(`live graph rail capture: FAIL (${failure.message})`);
  process.exit(1);
}
