/**
 * J4 proof: the application `nodetrace add` leaves behind actually builds and
 * actually renders.
 *
 * Run from the repo root:  node promotion/probes/j4-installed-target-proof.mjs
 *
 * It drives the repo's own installer end-to-end smoke (which creates a throwaway
 * Next App Router app, installs, seeds, smokes and runs a real `next build`),
 * keeps that target, serves it with `next start`, and photographs /nodetrace in
 * headless Chromium. Journey step 3 — "open /nodetrace in the target
 * application" — is the half that was never reached before, so a green build is
 * not accepted as proof on its own here.
 *
 * Writes:
 *   promotion/evidence/j4-installed-next-target-1280.png
 *   promotion/evidence/j4-installed-next-target.json
 */

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { chromium } from "playwright";
import { assertPortFree } from "../../scripts/lib/proof-server.mjs";

const PORT = Number(process.env.NODETRACE_PROOF_PORT ?? 4302);
const HOST = "127.0.0.1";
const evidenceDir = join("promotion", "evidence");
const screenshotPath = join(evidenceDir, "j4-installed-next-target-1280.png");
const reportPath = join(evidenceDir, "j4-installed-next-target.json");

const startedAtMs = Date.now();
const issues = [];
let server;
let targetDir;
let installerPhases = [];
let observed = {};

try {
  // Same rule as the capture scripts: photograph only a server this process
  // started. A foreign listener on PORT would otherwise be measured as "the
  // installed target" and reported as proof.
  await assertPortFree(PORT, HOST);

  console.log("[1/3] nodetrace add into a throwaway Next target (install, seed, smoke, next build)");
  const installer = spawnSync(process.execPath, ["scripts/installer-next-e2e-smoke.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, NODETRACE_KEEP_E2E_TARGET: "1", NEXT_TELEMETRY_DISABLED: "1" },
    timeout: 900000,
  });
  process.stdout.write([installer.stdout, installer.stderr].filter(Boolean).join("\n").slice(-3000));
  const smoke = JSON.parse(readFileSync(join("docs", "eval", "nodetrace-next-e2e-smoke.json"), "utf8"));
  installerPhases = smoke.phases ?? [];
  targetDir = smoke.targetDir;
  if (!smoke.ok) issues.push(`installer e2e smoke not ok: ${(smoke.issues ?? []).join(" | ").slice(0, 600)}`);
  if (!targetDir || !existsSync(join(targetDir, ".next"))) issues.push("target has no .next build output to serve");

  if (issues.length === 0) {
    console.log(`[2/3] next start on http://${HOST}:${PORT}/nodetrace`);
    server = spawn(process.execPath, [join(targetDir, "node_modules", "next", "dist", "bin", "next"), "start", "-H", HOST, "-p", String(PORT)], {
      cwd: targetDir,
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
      stdio: "ignore",
    });
    await waitForServer(`http://${HOST}:${PORT}/nodetrace`);

    console.log("[3/3] render /nodetrace in headless Chromium at 1280x900");
    observed = await capture(`http://${HOST}:${PORT}/nodetrace`);
    if (!observed.liveGraphRailPresent) issues.push("live graph rail did not render in the installed target");
    if (observed.consoleErrors.length > 0) issues.push(`console errors: ${observed.consoleErrors.join(" | ").slice(0, 600)}`);
    if (observed.failedRequests.length > 0) issues.push(`failed requests: ${observed.failedRequests.join(" | ").slice(0, 600)}`);
  }
} catch (error) {
  issues.push(`probe error: ${error.message}`);
} finally {
  stopServer(server);
  if (targetDir && process.env.NODETRACE_KEEP_E2E_TARGET !== "1") rmSync(targetDir, { recursive: true, force: true });
}

const report = {
  ok: issues.length === 0,
  journey: "J4 - install into an existing Next app and open /nodetrace",
  completedAt: new Date().toISOString(),
  totalMs: Date.now() - startedAtMs,
  apiKeysRequired: false,
  url: `http://${HOST}:${PORT}/nodetrace`,
  viewport: { width: 1280, height: 900 },
  installerPhases,
  observed,
  screenshot: screenshotPath.replaceAll("\\", "/"),
  issues,
};
writeJson(reportPath, report);

if (issues.length > 0) {
  console.error("j4 installed target proof: FAIL");
  for (const issue of issues) console.error(`  - ${issue}`);
  process.exitCode = 1;
} else {
  console.log(`j4 installed target proof: PASS ${Math.round(report.totalMs / 1000)}s -> ${report.screenshot}`);
}

async function capture(url) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const consoleErrors = [];
  const failedRequests = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text().slice(0, 300));
  });
  page.on("pageerror", (error) => consoleErrors.push(`pageerror: ${error.message.slice(0, 300)}`));
  page.on("requestfailed", (request) => failedRequests.push(`${request.url()} ${request.failure()?.errorText ?? ""}`));
  page.on("response", (response) => {
    if (response.status() >= 400) failedRequests.push(`${response.url()} HTTP ${response.status()}`);
  });

  const response = await page.goto(url, { waitUntil: "networkidle" });
  const rail = page.locator('[data-testid="live-graph-rail"]');
  const liveGraphRailPresent = await rail.count() > 0;
  if (liveGraphRailPresent) await rail.waitFor({ state: "visible", timeout: 15000 });
  await page.waitForTimeout(1500); // let ForceAtlas2 settle before the photograph
  mkdirSync(dirname(screenshotPath), { recursive: true });
  await page.screenshot({ path: screenshotPath, fullPage: true });

  const measured = {
    httpStatus: response?.status() ?? 0,
    title: await page.title(),
    liveGraphRailPresent,
    entities: liveGraphRailPresent ? await rail.getAttribute("data-entity-count") : null,
    edges: liveGraphRailPresent ? await rail.getAttribute("data-edge-count") : null,
    traceRecords: await page.locator('[data-testid="trace-record"]').count(),
    canvases: await page.locator('[data-testid="live-graph-rail"] canvas').count(),
    horizontalOverflowPx: await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
    consoleErrors,
    failedRequests,
  };
  await browser.close();
  return measured;
}

async function waitForServer(url) {
  const deadline = Date.now() + 90000;
  for (;;) {
    try {
      const response = await fetch(url);
      if (response.status < 500) return;
    } catch {
      // server not up yet
    }
    if (Date.now() > deadline) throw new Error(`server never answered on ${url}`);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

function stopServer(child) {
  if (!child?.pid) return;
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  else child.kill("SIGTERM");
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}
