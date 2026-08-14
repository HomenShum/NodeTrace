/**
 * Record the live graph rail working, end to end, on the repo's own demo
 * path: run the real happy path (SQLite -> public/nodetrace-state.json),
 * start Vite, load the dashboard in a recorded Chromium context, watch the
 * rail populate from the real trace events, wait for the graph canvas to paint
 * node rings, then click one until the trace-event-id readout appears. An
 * unpainted canvas or no readout means no clip — exits 1.
 *
 * Output: .nodetrace/live-graph-rail.webm, converted (when ffmpeg is on
 * PATH) to docs/screenshots/live-graph-rail.gif.
 */

import { copyFileSync, mkdirSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { chromium } from "playwright";
import {
  GRAPH_CANVAS,
  PORT_ENV,
  assertPageIsThisTree,
  assertPortFree,
  killTree,
  startVite,
  waitForPaintedGraph,
  waitForServer,
} from "./lib/proof-server.mjs";

// not 5173/5187: other checkouts may hold the defaults. If this one is held
// too, the recording refuses rather than filming somebody else's checkout.
const PORT = Number(process.env[PORT_ENV] ?? 5299);
const URL = `http://127.0.0.1:${PORT}/`;
const WEBM = ".nodetrace/live-graph-rail.webm";
const GIF = "docs/screenshots/live-graph-rail.gif";
const VIEWPORT = { width: 1400, height: 860 };
const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

try {
  await assertPortFree(PORT);
} catch (error) {
  console.error(`live graph rail recording: FAIL (${error.message})`);
  process.exit(1);
}

const happy = spawnSync(npmCmd, ["run", "happy-path"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});
if (happy.status !== 0) {
  console.error("live graph rail recording: FAIL (happy-path exited nonzero)");
  process.exit(1);
}

const server = startVite(PORT);
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
  await assertPageIsThisTree(page); // filming this tree, not another checkout
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
  // The gate, and the click targets, in one read: wait for painted node rings
  // instead of a fixed settle time, and take the ring centres as the places to
  // click. Sigma draws to canvas, so nodes have no DOM — but whatever is
  // painted is exactly what is clickable. Runs before the first hover: hovering
  // dims every non-neighbour to grey, which would hide rings from the count.
  const painted = await waitForPaintedGraph(page);

  const canvas = rail.locator(GRAPH_CANVAS);
  const box = await canvas.boundingBox();
  if (!box) throw new Error("nodegraph canvas has no bounding box");
  for (const fx of [0.3, 0.5, 0.7]) {
    await page.mouse.move(box.x + box.width * fx, box.y + box.height * 0.5, { steps: 12 });
    await page.waitForTimeout(300);
  }

  const readout = page.locator('[data-testid="live-graph-node-events"]');
  let clicked = false;
  outer: for (const point of painted.points) {
    for (const [dx, dy] of [[0, 0], [-2, 0], [2, 0], [0, -2]]) {
      await page.mouse.move(point.x + dx, point.y + dy, { steps: 8 });
      await page.mouse.click(point.x + dx, point.y + dy);
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
    `live graph rail recording: PASS (${entityCount} entities, ${edgeCount} traversal edges, ` +
      `${painted.nodes} node rings painted, node readout shown -> ${WEBM})`,
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
