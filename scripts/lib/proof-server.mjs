/**
 * The capture seam every proof script in this repo routes through: three gates
 * between "a browser is open" and "an artifact may be written".
 *
 * Each one exists because an artifact that passed every other check turned out
 * to be worthless, measured rather than imagined.
 *
 *   1. `assertPortFree` (+ `--strictPort`) — on 2026-08-13 a *second checkout of
 *      this same app* was already serving 127.0.0.1:5187. The capture script
 *      started `npm run dev`, vite quietly moved to 5188 because nothing asked
 *      for `--strictPort`, and the script photographed the other checkout and
 *      printed `PASS (14 entities, 31 traversal edges)`. This tree renders
 *      10 / 15.
 *   2. `assertPageIsThisTree` — same title, same testids, same everything a
 *      page-shape assertion can see, so only the state bytes the *captured page*
 *      loaded, compared against the bytes on disk here, tell the two apart.
 *   3. `waitForPaintedGraph` — the DOM counts (`data-entity-count`) are React
 *      state and stay correct through a graph canvas that never painted a
 *      pixel. On 2026-08-13 one of three runs wrote a screenshot with the labels
 *      drawn, no node rings, and Chromium's broken-image placeholder over the
 *      canvas, while printing `PASS (10 entities, 15 traversal edges)`. Only the
 *      pixels can say the picture has a graph in it.
 *
 * All three run before any artifact is written or any PASS is printed.
 */

import { createServer } from "node:net";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";

export const STATE_FILE = "public/nodetrace-state.json";
export const PORT_ENV = "NODETRACE_CAPTURE_PORT";
export const GRAPH_CANVAS = '[data-testid="nodegraph-canvas"]';

/** Throws unless this process can bind `port` — i.e. nothing else holds it. */
export async function assertPortFree(port, host = "127.0.0.1") {
  await new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", (error) => {
      reject(
        error.code === "EADDRINUSE"
          ? new Error(
              `port ${port} is already in use by another process — refusing to capture a page this checkout did not serve. Stop it, or set ${PORT_ENV} to a free port.`,
            )
          : error,
      );
    });
    probe.listen(port, host, () => probe.close(() => resolve()));
  });
}

/** Vite on exactly this port, or not at all. */
export function startVite(port, host = "127.0.0.1") {
  const npxCmd = process.platform === "win32" ? "npx.cmd" : "npx";
  return spawn(npxCmd, ["vite", "--host", host, "--port", String(port), "--strictPort"], {
    stdio: "pipe",
    shell: process.platform === "win32",
  });
}

export async function waitForServer(url, timeoutMs = 30_000) {
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

/**
 * Positive identity: the page in front of the camera is THIS application, from
 * THIS working tree. The state file is regenerated with a fresh millisecond
 * timestamp by every `npm run happy-path`, so a foreign checkout cannot match
 * it even when it is the same product at the same commit.
 */
export async function assertPageIsThisTree(page) {
  const title = await page.title();
  if (title !== "NodeTrace") {
    throw new Error(`captured page is not NodeTrace (document.title is ${JSON.stringify(title)})`);
  }
  const served = await page.evaluate(() =>
    fetch("./nodetrace-state.json", { cache: "no-store" }).then((response) =>
      response.ok ? response.text() : `HTTP ${response.status}`,
    ),
  );
  const onDisk = readFileSync(STATE_FILE, "utf8");
  if (served !== onDisk) {
    throw new Error(
      `the captured page served a different ${STATE_FILE} than this checkout has on disk ` +
        `(page ${sha(served)}, disk ${sha(onDisk)}) — another process answered on this port`,
    );
  }
}

/**
 * Painted, not merely mounted — and the count is read out of the pixels, never
 * out of an attribute.
 *
 * Sigma draws the nodes and edges on three WebGL canvases (`sigma-edges`,
 * `sigma-nodes`, `sigma-hoverNodes`) and the text on four 2d ones. When the GPU
 * context dies the React tree is untouched: `data-entity-count` still says 10,
 * the rail is still visible, the labels still paint — and the WebGL canvases
 * render as Chromium's broken-image placeholder. Every DOM-level check passes
 * over an empty picture.
 *
 * So this one screenshots the canvas box and counts what is actually on it. The
 * node rings are the only COLOURED ink in there: labels are near-black, edges
 * and the dot grid are grey, so a pixel with chroma is a node ring and nothing
 * else. Measured: a real capture of the happy-path state has ~400 coloured
 * pixels clustering into exactly 10 rings for its 10 entities; the hollow one
 * (promotion/evidence/capture-identity-before-foreign-checkout.png) has 0 and 0.
 * The gate is `nodes > 0`, because the observed failure is total — no partial
 * paint has ever been seen — and the count is printed next to the DOM count so a
 * future partial one is visible in the PASS line.
 *
 * It waits for painted AND STILL — the rings in the same places two polls
 * apart — which is the condition the old `waitForTimeout(1_500)` was guessing
 * at: ForceAtlas2 stops at `settleMs(order)` = 1020ms for this graph, and the
 * camera resets on the same tick.
 *
 * WHY IT RELOADS. The dead context is not rare: React StrictMode mounts the
 * renderer, kills it and mounts it again, and that WebGL churn leaves the
 * surviving instance with `isContextLost() === true` about half the time here
 * (measured: of 14 first loads, 7 painted nothing; of the 8 loads allowed to
 * reload, all 8 painted — 3 of them after exactly one reload, none needing a
 * second). So a hollow canvas costs a reload, and only a page that is still
 * empty after `attempts` loads throws.
 *
 * Returns { nodes, chromaticPixels, points }, points being the ring centres in
 * viewport coordinates: whatever is painted is also what is clickable.
 */
export async function waitForPaintedGraph(
  page,
  { selector = GRAPH_CANVAS, timeoutMs = 10_000, attempts = 3 } = {},
) {
  const canvas = page.locator(selector).first();
  let painted = { nodes: 0, chromaticPixels: 0, points: [] };
  for (let attempt = 1; ; attempt += 1) {
    painted = await pollUntilStill(page, canvas, timeoutMs);
    if (painted.nodes > 0) return painted;
    if (attempt >= attempts) break;
    console.log(
      `graph canvas painted nothing in ${timeoutMs}ms — reloading (attempt ${attempt + 1}/${attempts})`,
    );
    await page.reload({ waitUntil: "load" });
  }
  throw new Error(
    `the graph canvas painted 0 node rings in ${attempts} loads of ${timeoutMs}ms ` +
      `(${painted.chromaticPixels} coloured pixels in ${selector}) — the DOM counts survive a dead ` +
      `canvas, so this artifact would have been an empty picture with the right numbers next to it`,
  );
}

/** Screenshot the canvas box until the rings stop moving, or time runs out. */
async function pollUntilStill(page, canvas, timeoutMs) {
  await canvas.waitFor({ state: "visible", timeout: timeoutMs });
  const deadline = Date.now() + timeoutMs;
  let previous = null;
  for (;;) {
    const box = await canvas.boundingBox();
    const shot = await canvas.screenshot();
    const painted = await page.evaluate(readPaintedRings, {
      png: `data:image/png;base64,${shot.toString("base64")}`,
      box,
    });
    if (painted.nodes > 0 && isStill(previous, painted)) return painted;
    if (Date.now() >= deadline) return painted;
    previous = painted;
    await page.waitForTimeout(250);
  }
}

/** Same rings, same places (within a pixel and a half), two polls apart. */
function isStill(previous, painted) {
  if (!previous || previous.nodes !== painted.nodes) return false;
  return previous.points.every(
    (point, i) =>
      Math.abs(point.x - painted.points[i].x) <= 1.5 &&
      Math.abs(point.y - painted.points[i].y) <= 1.5,
  );
}

/** Runs in the page: decode the screenshot, cluster its coloured pixels. */
async function readPaintedRings({ png, box }) {
  const bitmap = await createImageBitmap(await (await fetch(png)).blob());
  const surface = document.createElement("canvas");
  surface.width = bitmap.width;
  surface.height = bitmap.height;
  const context = surface.getContext("2d");
  context.drawImage(bitmap, 0, 0);
  const { data, width, height } = context.getImageData(0, 0, bitmap.width, bitmap.height);
  const rings = [];
  let chromaticPixels = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (Math.max(r, g, b) - Math.min(r, g, b) <= 24) continue; // grey ink: not a node
      chromaticPixels += 1;
      let ring = rings.find(
        (k) => x >= k.minX - 12 && x <= k.maxX + 12 && y >= k.minY - 12 && y <= k.maxY + 12,
      );
      if (!ring) rings.push((ring = { minX: x, maxX: x, minY: y, maxY: y }));
      ring.minX = Math.min(ring.minX, x);
      ring.maxX = Math.max(ring.maxX, x);
      ring.minY = Math.min(ring.minY, y);
      ring.maxY = Math.max(ring.maxY, y);
    }
  }
  const sx = box.width / width;
  const sy = box.height / height;
  return {
    nodes: rings.length,
    chromaticPixels,
    points: rings.map((k) => ({
      x: box.x + ((k.minX + k.maxX) / 2) * sx,
      y: box.y + ((k.minY + k.maxY) / 2) * sy,
    })),
  };
}

export function killTree(child) {
  if (!child?.pid) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    child.kill("SIGTERM");
  }
}

function sha(text) {
  return `sha256:${createHash("sha256").update(text).digest("hex").slice(0, 12)}`;
}
