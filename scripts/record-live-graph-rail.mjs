/**
 * Record the live graph rail working, end to end, on the repo's own demo
 * path: run the real happy path (SQLite -> public/nodetrace-state.json),
 * start Vite, load the dashboard in a recorded Chromium context, watch the
 * rail populate from the real trace events, then click a graph node until
 * the trace-event-id readout appears. No readout, no clip — exits 1.
 *
 * Output: .nodetrace/live-graph-rail.webm, converted (when ffmpeg is on
 * PATH) to docs/screenshots/live-graph-rail.gif.
 */

import { copyFileSync, mkdirSync, statSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { chromium } from "playwright";

const PORT = 5299; // not 5173/5187: other checkouts may hold the defaults
const URL = `http://127.0.0.1:${PORT}/`;
const WEBM = ".nodetrace/live-graph-rail.webm";
const GIF = "docs/screenshots/live-graph-rail.gif";
const VIEWPORT = { width: 1400, height: 860 };
const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const npxCmd = process.platform === "win32" ? "npx.cmd" : "npx";

const happy = spawnSync(npmCmd, ["run", "happy-path"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});
if (happy.status !== 0) {
  console.error("live graph rail recording: FAIL (happy-path exited nonzero)");
  process.exit(1);
}

const server = spawn(npxCmd, ["vite", "--host", "127.0.0.1", "--port", String(PORT), "--strictPort"], {
  stdio: "pipe",
  shell: process.platform === "win32",
});
let browser;
let failure = null;
let videoPath = null;

try {
  await waitForServer(URL, 30_000);
  mkdirSync(".nodetrace/recordings", { recursive: true });
  browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: VIEWPORT,
    recordVideo: { dir: ".nodetrace/recordings", size: VIEWPORT },
  });
  const page = await context.newPage();
  await page.goto(URL, { waitUntil: "load" });
  await page.waitForTimeout(2_500); // dashboard visible before any motion

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

  // Scroll down to the rail in steps, like a reader would.
  for (let i = 0; i < 12; i += 1) {
    const inView = await rail.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return r.top >= 0 && r.bottom <= window.innerHeight;
    });
    if (inView) break;
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(2_500); // let the force layout settle on camera

  // Hover across the canvas, then grid-click until a node answers with its
  // trace-event-id readout. Sigma draws to canvas, so nodes have no DOM.
  const canvas = rail.locator('[data-testid="nodegraph-canvas"]');
  const box = await canvas.boundingBox();
  if (!box) throw new Error("nodegraph canvas has no bounding box");
  for (const fx of [0.3, 0.5, 0.7]) {
    await page.mouse.move(box.x + box.width * fx, box.y + box.height * 0.5, { steps: 12 });
    await page.waitForTimeout(300);
  }
  // Sigma draws each node's label just right of the node on the 2d labels
  // canvas, so opaque label pixels give us clickable node positions.
  const candidates = await page.evaluate(() => {
    const canvas = document.querySelector(
      '[data-testid="live-graph-rail"] [data-testid="nodegraph-canvas"] canvas.sigma-labels',
    );
    if (!canvas) return [];
    const ctx = canvas.getContext("2d");
    const { width, height } = canvas;
    const data = ctx.getImageData(0, 0, width, height).data;
    const clusters = [];
    for (let y = 0; y < height; y += 2) {
      for (let x = 0; x < width; x += 2) {
        if (data[(y * width + x) * 4 + 3] <= 32) continue;
        let c = clusters.find(
          (k) => x >= k.minX - 14 && x <= k.maxX + 14 && y >= k.minY - 8 && y <= k.maxY + 8,
        );
        if (!c) clusters.push((c = { minX: x, maxX: x, minY: y, maxY: y }));
        c.minX = Math.min(c.minX, x);
        c.maxX = Math.max(c.maxX, x);
        c.minY = Math.min(c.minY, y);
        c.maxY = Math.max(c.maxY, y);
      }
    }
    const rect = canvas.getBoundingClientRect();
    const sx = rect.width / width;
    const sy = rect.height / height;
    return clusters.map((c) => ({
      x: rect.left + c.minX * sx, // label starts right of the node circle
      y: rect.top + ((c.minY + c.maxY) / 2) * sy,
    }));
  });
  if (candidates.length === 0) throw new Error("no node labels found on the sigma labels canvas");

  const readout = page.locator('[data-testid="live-graph-node-events"]');
  let clicked = false;
  outer: for (const point of candidates) {
    for (const dx of [-9, -6, -12, -15]) {
      await page.mouse.move(point.x + dx, point.y, { steps: 8 });
      await page.mouse.click(point.x + dx, point.y);
      await page.waitForTimeout(350);
      if (await readout.isVisible()) {
        clicked = true;
        break outer;
      }
    }
  }
  if (!clicked) throw new Error("no node click produced the trace-event-id readout");
  // Bring the trace-event-id readout on camera without losing the graph.
  // Pointer must leave the sigma canvas first: wheeling over it zooms the
  // graph camera instead of scrolling the page.
  await page.mouse.move(12, Math.round(VIEWPORT.height / 2), { steps: 8 });
  for (let i = 0; i < 6; i += 1) {
    const onCamera = await readout.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return r.bottom <= window.innerHeight;
    });
    if (onCamera) break;
    await page.mouse.wheel(0, 200);
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(4_500); // hold the readout on camera

  const video = page.video();
  await context.close(); // flushes the webm
  videoPath = await video.path();
  copyFileSync(videoPath, WEBM);
  console.log(
    `live graph rail recording: PASS (${entityCount} entities, ${edgeCount} traversal edges, node readout shown -> ${WEBM})`,
  );
} catch (error) {
  failure = error;
} finally {
  if (browser) await browser.close().catch(() => {});
  killTree(server);
}

if (failure) {
  console.error(`live graph rail recording: FAIL (${failure.message})`);
  process.exit(1);
}

// webm -> gif, when ffmpeg is available. 128 colors, bayer dither, <=8MB.
const attempts = [
  "fps=8,scale=960:-1:flags=lanczos",
  "fps=6,scale=800:-1:flags=lanczos",
];
let converted = false;
for (const vf of attempts) {
  const ff = spawnSync(
    "ffmpeg",
    ["-y", "-i", WEBM, "-vf", `${vf},split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer`, GIF],
    { stdio: "pipe", shell: process.platform === "win32" },
  );
  if (ff.error || ff.status !== 0) {
    console.error("live graph rail recording: webm kept, gif skipped (ffmpeg unavailable or failed)");
    break;
  }
  const mb = statSync(GIF).size / (1024 * 1024);
  if (mb <= 8) {
    console.log(`live graph rail gif: PASS (${vf.split(",")[0]}, ${mb.toFixed(1)}MB -> ${GIF})`);
    converted = true;
    break;
  }
  console.log(`gif ${mb.toFixed(1)}MB > 8MB with ${vf.split(",")[0]}, retrying smaller`);
}
if (!converted) process.exitCode = process.exitCode ?? 0;

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
