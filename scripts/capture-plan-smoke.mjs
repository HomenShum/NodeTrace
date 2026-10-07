/**
 * Two checks on the capture engine, cheapest first.
 *
 * 1. Dry run — the plan parses, the source file and anchor resolve, no browser.
 * 2. Real run — headless Chromium renders the source slice with Shiki and
 *    photographs a live page served here over HTTP. This is the only check in
 *    the repo that runs `editor.mode: "code-browser"` end to end; without it
 *    nothing proves the engine still works, only that its plans parse.
 */

import { createServer } from "node:http";
import { mkdirSync, readFileSync, rmSync, statSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawn } from "node:child_process";
import { createCaptureFixture, FIXTURE_APP_HTML } from "./capture-plan-fixture.mjs";

const tempDir = mkdtempSync(join(tmpdir(), "nodetrace-capture-plan-smoke-"));
const reportPath = "docs/eval/nodetrace-capture-plan-smoke.json";
const issues = [];
let realRun = "skipped";

try {
  const { planPath } = createCaptureFixture(tempDir);
  const dry = await runCapture(planPath, ["--dry-run"]);
  if (dry.status !== 0) {
    issues.push([dry.stdout, dry.stderr].join("\n").slice(-1200));
  } else if (!dry.stdout.includes("nodetrace capture dry run: PASS 1 steps")) {
    issues.push(`unexpected dry-run output: ${dry.stdout}`);
  }
  realRun = await checkRealCapture();
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

writeJson(reportPath, {
  ok: issues.length === 0,
  completedAt: new Date().toISOString(),
  fixture: "local disposable capture plan",
  realCapture: realRun,
  issues,
});

if (issues.length > 0) {
  console.error("nodetrace capture plan smoke: FAIL");
  for (const issue of issues) console.error(`  - ${issue}`);
  process.exitCode = 1;
} else {
  console.log(`nodetrace capture plan smoke: PASS (real capture: ${realRun})`);
}

async function checkRealCapture() {
  const realDir = join(tempDir, "real");
  mkdirSync(realDir, { recursive: true });
  const server = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(FIXTURE_APP_HTML);
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  const appUrl = `http://127.0.0.1:${server.address().port}/`;
  try {
    const { planPath, captureRoot } = createCaptureFixture(realDir, { appUrl });
    const run = await runCapture(planPath, []);
    if (run.status !== 0) {
      issues.push(`real capture failed: ${[run.stdout, run.stderr].join("\n").slice(-1200)}`);
      return "failed";
    }
    const manifest = JSON.parse(readFileSync(join(captureRoot, "manifest.json"), "utf8"));
    const step = manifest.steps?.[0] ?? {};
    if (step.sourceView?.captureKind !== "actual-code-browser-shiki") {
      issues.push(`source capture kind is ${step.sourceView?.captureKind}, expected actual-code-browser-shiki`);
    }
    if (step.uiCapture?.captureKind !== "actual-app-playwright") {
      issues.push(`ui capture kind is ${step.uiCapture?.captureKind}, expected actual-app-playwright`);
    }
    if (!(step.uiCapture?.rect?.width > 0)) issues.push("ui capture recorded no DOMRect");
    for (const name of ["fixture-trace-strip-ide.png", "fixture-trace-strip-ui.png"]) {
      const bytes = statSync(join(captureRoot, name)).size;
      // A PNG this small is a blank frame, not a screenshot of anything.
      if (bytes < 1000) issues.push(`${name} is ${bytes} bytes, expected a real screenshot`);
    }
    return "passed";
  } catch (error) {
    issues.push(`real capture threw: ${error instanceof Error ? error.message : String(error)}`);
    return "failed";
  } finally {
    server.close();
  }
}

// Async on purpose: the real run photographs an HTTP server owned by THIS
// process, and spawnSync would block the event loop so that server never
// answers. The capture then fails with a goto timeout that looks like a bug in
// the engine.
function runCapture(planPath, extraArgs) {
  return new Promise((done) => {
    const child = spawn(process.execPath, ["bin/nodetrace.mjs", "capture", "--plan", planPath, ...extraArgs], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("close", (status) => done({ status, stdout, stderr }));
  });
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}
