import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { appendFileSync, existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { createCaptureFixture, FIXTURE_APP_HTML } from "./capture-plan-fixture.mjs";

const self = fileURLToPath(import.meta.url);
const repo = resolve(dirname(self), "..");
const json = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };

// This real child app records argv and readiness before the capture photographs it.
if (process.argv[2] === "--serve") {
  const [directory, port, mode, ...args] = process.argv.slice(3);
  json(join(directory, "app.json"), { pid: process.pid, args });
  let requests = 0;
  const server = createServer((request, response) => {
    const ready = request.url === "/ready";
    if (++requests <= 32) appendFileSync(join(directory, "requests.jsonl"), `${JSON.stringify({ at: Date.now(), event: "request", ready })}\n`);
    if (requests > 32) return response.writeHead(503).end();
    if (ready && (mode === "never" || (mode === "transient" && requests < 3))) return response.writeHead(503).end();
    const send = () => {
      response.writeHead(ready && mode === "404" ? 404 : 200, { "content-type": "text/html" });
      if (ready && mode === "open-body") {
        response.once("close", () => appendFileSync(join(directory, "requests.jsonl"), `${JSON.stringify({ at: Date.now(), event: "ready-body-closed" })}\n`));
        response.flushHeaders();
      }
      else response.end(FIXTURE_APP_HTML);
    };
    ready && mode === "stall" ? setTimeout(send, 4000) : send();
  });
  server.listen(Number(port), "127.0.0.1");
} else if (process.argv[1] && resolve(process.argv[1]) === self) {
  const result = await checkStartedCaptures();
  console.log(JSON.stringify(result, null, 2));
  if (result.issues.length) process.exitCode = 1;
}

export async function checkStartedCaptures() {
  // Retain inputs, logs and pixels so a failed CI or local run can be inspected.
  const root = mkdtempSync(join(tmpdir(), "nodetrace started capture "));
  const executable = join(root, process.platform === "win32" ? "node with spaces.exe" : "node with spaces");
  if (process.platform === "win32") linkSync(process.execPath, executable);
  else symlinkSync(process.execPath, executable);
  const cases = [
    { name: "array-argv", form: "array", mode: "ready" },
    { name: "object-path", form: "object", mode: "ready" },
    { name: "npm-lookup", form: "npm", mode: "ready" },
    ...(process.platform === "win32" ? [{ name: "cmd-shim", form: "cmd", mode: "ready" }] : []),
    { name: "string-stall", form: "string", mode: "stall", fails: true },
    { name: "missing-command", form: "missing", mode: "ready", fails: true },
    { name: "reachable-404", form: "array", mode: "404" },
    { name: "transient-503", form: "array", mode: "transient" },
    { name: "never-ready", form: "object", mode: "never", fails: true },
    { name: "open-body", form: "array", mode: "open-body" },
  ];
  const rows = [];
  const ports = new Set();
  for (const scenario of cases) {
    do { scenario.port = await freePort(); } while (ports.has(scenario.port));
    ports.add(scenario.port);
  }
  // Two simultaneous agents, followed by repeated captures and degraded starts.
  rows.push(...await Promise.all(cases.slice(0, 2).map(runCase)));
  for (const scenario of cases.slice(2)) rows.push(await runCase(scenario));
  const result = { root, cases: rows, issues: rows.flatMap((row) => row.issue ? [`${row.name}: ${row.issue}`] : []) };
  json(join(root, "report.json"), result);
  return result;

  async function runCase(scenario) {
    const directory = join(root, scenario.name);
    mkdirSync(directory);
    const fixture = createCaptureFixture(directory, { appUrl: `http://127.0.0.1:${scenario.port}/` });
    const plan = JSON.parse(readFileSync(fixture.planPath, "utf8"));
    const sentinel = join(directory, "must-not-exist.txt");
    const literals = ["", "two words", 'say "hello"', "trailing\\", "%NODETRACE_UNSET%", "!literal!", `& echo injected > "${sentinel}"`, "(a)^b|c"];
    const forwarded = ["array", "object", "cmd"].includes(scenario.form) ? literals : [];
    const appArgs = [self, "--serve", directory, "{port}", scenario.mode, ...forwarded];
    let command = [executable, ...appArgs];
    if (scenario.form === "object") command = { command: executable, args: appArgs };
    if (scenario.form === "missing") command = { command: join(directory, "missing-executable"), args: [] };
    if (scenario.form === "string") command = [process.execPath, ...appArgs].map((part) => `"${part}"`).join(" ");
    if (scenario.form === "npm") {
      json(join(directory, "package.json"), { private: true, scripts: { fixture: `node "${self.replaceAll("\\", "/")}" --serve` } });
      command = { command: "npm", args: ["run", "fixture", "--", directory, "{port}", scenario.mode] };
    }
    if (scenario.form === "cmd") {
      const shim = join(directory, "node_modules", ".bin", "fixture app.cmd");
      mkdirSync(dirname(shim), { recursive: true });
      writeFileSync(shim, `@"${process.execPath}" "${self}" --serve %*\r\n`);
      command = [shim, directory, "{port}", scenario.mode, ...forwarded];
    }
    plan.timeoutMs = scenario.mode === "stall" ? 1000 : 5000;
    plan.app = { name: scenario.name, startCommand: command, startCwd: directory, host: "127.0.0.1", port: scenario.port, waitUrl: `http://127.0.0.1:${scenario.port}/ready` };
    plan.steps[0].ui.actions = [{ type: "goto", url: `http://127.0.0.1:${scenario.port}/` }];
    let readinessServer;
    const readinessEvents = [], heldResponses = new Set();
    let run, app, issue;
    try {
      if (scenario.mode === "stall") {
        // Isolate an in-flight fetch from the variable cost of starting Windows processes.
        readinessServer = createServer((_request, response) => {
          if (readinessEvents.length >= 8) return response.writeHead(503).end();
          readinessEvents.push({ event: "request", at: Date.now() });
          const timer = setTimeout(() => {
            readinessEvents.push({ event: "headers", at: Date.now() });
            response.writeHead(200).end(FIXTURE_APP_HTML);
          }, 4000);
          heldResponses.add(timer);
          response.once("close", () => {
            clearTimeout(timer);
            heldResponses.delete(timer);
            readinessEvents.push({ event: "closed", at: Date.now() });
          });
        });
        await new Promise((done, reject) => { readinessServer.once("error", reject); readinessServer.listen(0, "127.0.0.1", done); });
        plan.app.waitUrl = `http://127.0.0.1:${readinessServer.address().port}/ready`;
      }
      json(fixture.planPath, plan);
      run = await runCapture(fixture.planPath, directory);
      app = existsSync(join(directory, "app.json")) ? JSON.parse(readFileSync(join(directory, "app.json"), "utf8")) : null;
      assert.equal(run.timedOut, false, "independent 15s CLI watchdog fired");
      assert.equal(run.truncated, false, "capture exceeded bounded log buffer");
      assert.equal(existsSync(sentinel), false, "an argument was interpreted as a shell command");
      const manifestPath = join(fixture.captureRoot, "manifest.json");
      if (scenario.fails) {
        assert.notEqual(run.status, 0, "failed startup reported success");
        assert.equal(existsSync(manifestPath), false, "failed startup wrote a success manifest");
        assert.match(run.stderr, scenario.form === "missing" ? /ENOENT/ : /did not become reachable/);
        if (scenario.mode === "stall") {
          const first = readinessEvents.find((event) => event.event === "request");
          const closed = readinessEvents.find((event) => event.event === "closed");
          assert.ok(first && closed, "real readiness request and cancellation required");
          assert.equal(readinessEvents.some((event) => event.event === "headers"), false, "late readiness headers were released");
          assert.ok(closed.at - first.at < 3000, "pending readiness connection was not cancelled");
          assert.ok(run.finishedAt - first.at < 3000, "readiness failure did not return before delayed headers");
        }
      } else {
        assert.equal(run.status, 0, run.stderr);
        assert.deepEqual(app?.args, forwarded, "child argv changed");
        const step = JSON.parse(readFileSync(manifestPath, "utf8")).steps[0];
        assert.equal(step.sourceView.captureKind, "actual-code-browser-shiki");
        assert.equal(step.uiCapture.captureKind, "actual-app-playwright");
        assert.ok(step.uiCapture.rect.width > 0);
        for (const name of ["fixture-trace-strip-ide.png", "fixture-trace-strip-ui.png"]) assert.ok(statSync(join(fixture.captureRoot, name)).size > 1000, name);
      }
      if (app && scenario.mode !== "stall") {
        const events = readFileSync(join(directory, "requests.jsonl"), "utf8").trim().split("\n").map(JSON.parse);
        const ready = events.filter((event) => event.event === "request" && event.ready);
        if (scenario.mode === "never") assert.ok(ready.length > 0 && ready.length <= Math.ceil(plan.timeoutMs / 500) + 1, "503 retries were not bounded");
        if (scenario.mode === "transient") {
          assert.equal(ready.length, 3);
          assert.ok(ready[2].at - ready[0].at >= 900, "503 retries skipped the backoff");
        }
        if (scenario.mode === "open-body") {
          const closed = events.find((event) => event.event === "ready-body-closed");
          const photographed = events.find((event) => event.event === "request" && !event.ready);
          assert.ok(closed && photographed && closed.at <= photographed.at, "readiness body remained open during app capture");
        }
      }
      if (app) {
        for (let i = 0; i < 20 && alive(app.pid); i++) await delay(50);
        assert.equal(alive(app.pid), false, "capture left its owned app running");
      }
    } catch (error) {
      issue = error.stack ?? String(error);
    } finally {
      for (const timer of heldResponses) clearTimeout(timer);
      if (readinessServer) {
        readinessServer.closeAllConnections();
        await new Promise((done) => readinessServer.close(done));
        json(join(directory, "readiness-events.json"), readinessEvents);
      }
      // Only a failed owner's recorded fixture process may need test teardown.
      app ??= existsSync(join(directory, "app.json")) ? JSON.parse(readFileSync(join(directory, "app.json"), "utf8")) : null;
      if (app && alive(app.pid)) stopOwned(app.pid);
    }
    const row = { name: scenario.name, directory, run, app, issue };
    json(join(directory, "result.json"), row);
    return row;
  }
}

function runCapture(planPath, directory) {
  return new Promise((done) => {
    const child = spawn(process.execPath, [join(repo, "bin/nodetrace.mjs"), "capture", "--plan", planPath], { cwd: repo, windowsHide: true, detached: process.platform !== "win32", stdio: ["ignore", "pipe", "pipe"] });
    const startedAt = Date.now();
    let stdout = "", stderr = "", bytes = 0, timedOut = false;
    child.stdout.on("data", (chunk) => { bytes += chunk.length; stdout = (stdout + chunk).slice(0, 65536); });
    child.stderr.on("data", (chunk) => { bytes += chunk.length; stderr = (stderr + chunk).slice(0, 65536); });
    const timer = setTimeout(() => { timedOut = true; stopOwned(child.pid, true); }, 15000);
    child.once("error", (error) => { stderr += error.message; });
    child.once("close", (status) => {
      clearTimeout(timer);
      writeFileSync(join(directory, "stdout.log"), stdout);
      writeFileSync(join(directory, "stderr.log"), stderr);
      done({ status, cliPid: child.pid, startedAt, finishedAt: Date.now(), timedOut, truncated: bytes > 65536, stderr });
    });
  });
}

function stopOwned(pid, group = false) {
  if (!pid || !alive(pid)) return;
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(pid), "/t", "/f"], { windowsHide: true, stdio: "ignore", timeout: 4000 });
  else process.kill(group ? -pid : pid, "SIGKILL");
}

async function freePort() {
  const server = createServer();
  await new Promise((done, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", done); });
  const port = server.address().port;
  await new Promise((done) => server.close(done));
  return port;
}
