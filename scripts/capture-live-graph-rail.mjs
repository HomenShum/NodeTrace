/**
 * Capture proof for the live graph rail: run the real happy path (SQLite ->
 * public/nodetrace-state.json), start the dev server, and require the rail to
 * report >0 entities ingested from those real trace events before taking the
 * screenshot. An empty rail exits nonzero — no capture, no claim.
 */

import { mkdirSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { chromium } from "playwright";

const PORT = 5187;
const URL = `http://127.0.0.1:${PORT}/`;
const SCREENSHOT = "docs/screenshots/live-graph-rail.png";
const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

const happy = spawnSync(npmCmd, ["run", "happy-path"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});
if (happy.status !== 0) {
  console.error("live graph rail capture: FAIL (happy-path exited nonzero)");
  process.exit(1);
}

const server = spawn(npmCmd, ["run", "dev"], {
  stdio: "pipe",
  shell: process.platform === "win32",
});
let browser;
let failure = null;

try {
  await waitForServer(URL, 30_000);
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  await page.goto(URL, { waitUntil: "load" });

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
  await page.waitForTimeout(1_500); // let the force layout settle
  mkdirSync("docs/screenshots", { recursive: true });
  await rail.screenshot({ path: SCREENSHOT });
  console.log(
    `live graph rail capture: PASS (${entityCount} entities, ${edgeCount} traversal edges -> ${SCREENSHOT})`,
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

async function waitForServer(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`dev server did not answer at ${url} within ${timeoutMs}ms`);
}

function killTree(child) {
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    child.kill("SIGTERM");
  }
}
