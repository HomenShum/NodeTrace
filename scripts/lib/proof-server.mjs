/**
 * The server seam every capture/proof script in this repo routes through.
 *
 * Why it exists, measured rather than imagined: on 2026-08-13 a *second
 * checkout of this same app* was already serving 127.0.0.1:5187. The capture
 * script started `npm run dev`, vite quietly moved to 5188 because nothing
 * asked for `--strictPort`, and the script photographed the other checkout and
 * printed `PASS (14 entities, 31 traversal edges)`. This tree renders 10 / 15.
 * The artifact was indistinguishable from a real one.
 *
 * Same title, same testids, same everything a page-shape assertion can see, so
 * only two checks can tell the two apart:
 *
 *   1. refuse a port this process does not own (`assertPortFree` + `--strictPort`)
 *   2. compare the state bytes the *captured page* loaded against the bytes on
 *      disk in this working tree (`assertPageIsThisTree`)
 *
 * Both run before any artifact is written or any PASS is printed.
 */

import { createServer } from "node:net";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";

export const STATE_FILE = "public/nodetrace-state.json";
export const PORT_ENV = "NODETRACE_CAPTURE_PORT";

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
