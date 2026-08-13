#!/usr/bin/env node

import { appendFileSync, copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageManifest = readJson(join(packageRoot, "package.json"));
const version = packageManifest.version;
const defaultPhaseTimeoutMs = readPositiveInteger(process.env.NODETRACE_PHASE_TIMEOUT_MS, 300000);
const args = process.argv.slice(2);
const command = args[0] ?? "help";

if (command === "add") {
  addNodeTrace(parseOptions(args.slice(1)));
} else if (command === "capture") {
  const { runCaptureCli } = await import("../src/capture/codebaseCapture.mjs");
  await runCaptureCli(args.slice(1), { cwd: process.cwd() });
} else if (command === "help" || command === "--help" || command === "-h") {
  printHelp();
} else if (command === "--version" || command === "-v") {
  console.log(version);
} else {
  console.error(`Unknown command: ${command}`);
  printHelp();
  process.exitCode = 1;
}

function addNodeTrace(options) {
  const targetDir = resolve(options.target ?? ".");
  const force = Boolean(options.force);
  const shouldInstall = !options.skipInstall;
  const shouldVerify = !options.skipVerify;
  const framework = options.framework ?? detectFramework(targetDir);
  const startedAtMs = Date.now();
  const phases = [];

  if (!existsSync(join(targetDir, "package.json"))) {
    fail(`No package.json found in ${targetDir}`);
    return;
  }

  console.log(`NodeTrace add -> ${formatPath(targetDir)}`);
  const logPath = join(targetDir, ".nodetrace", "setup-log.txt");
  writeText(logPath, `NodeTrace setup log\nstartedAt=${new Date(startedAtMs).toISOString()}\ntargetDir=${targetDir}\nframework=${framework}\n\n`, { force: true });

  // LiveGraphRail.tsx reaches outside src/trace for the vendored NodeGraph Live
  // build. Ship it inside the copied tree and repoint the import: `../../vendor`
  // is only correct in this repo, and resolves to nothing once the components move.
  copyDir(join(packageRoot, "src", "trace"), join(targetDir, "src", "nodetrace"), {
    force,
    replacements: [["../../vendor/nodegraph-live/", "./vendor/nodegraph-live/"]],
  });
  copyDir(join(packageRoot, "vendor", "nodegraph-live"), join(targetDir, "src", "nodetrace", "vendor", "nodegraph-live"), { force });
  copyText(join(packageRoot, "db", "schema.sql"), join(targetDir, "db", "nodetrace.schema.sql"), { force });
  copyText(join(packageRoot, "scripts", "init-sqlite.mjs"), join(targetDir, "scripts", "nodetrace-init.mjs"), {
    force,
    replacements: [["../db/schema.sql", "../db/nodetrace.schema.sql"]],
  });
  writeText(join(targetDir, "scripts", "nodetrace-smoke.mjs"), targetSmokeScript(), { force });
  copyText(join(packageRoot, "src", "DemoDashboard.tsx"), join(targetDir, "src", "nodetrace-demo", "DemoDashboard.tsx"), {
    force,
    replacements: [["./trace", "../nodetrace"]],
  });
  copyText(join(packageRoot, "src", "styles.css"), join(targetDir, "src", "nodetrace-demo", "styles.css"), { force });
  if (framework === "next") {
    writeText(nextPagePath(targetDir), nextPage(nextPageImport(targetDir)), { force });
  } else {
    writeText(join(targetDir, "src", "nodetrace-demo", "main.tsx"), demoMain(), { force });
    writeText(join(targetDir, "nodetrace.html"), demoHtml(), { force });
  }
  writeText(join(targetDir, "docs", "NODETRACE_INTEGRATION.md"), integrationDoc(framework), { force });
  copyText(join(packageRoot, "public", "nodetrace-state.json"), join(targetDir, "public", "nodetrace-state.json"), { force });
  updatePackageJson(targetDir, framework);

  const packageManager = detectPackageManager(targetDir);
  const pkgAfterPatch = readJson(join(targetDir, "package.json"));
  const phaseCount = (shouldInstall ? 1 : 0) + (shouldVerify ? 2 + (pkgAfterPatch.scripts?.build ? 1 : 0) : 0);
  const runPhase = (name, phaseCommand) => runCommand(targetDir, name, phaseCommand, {
    index: phases.length + 1,
    total: phaseCount,
    timeoutMs: defaultPhaseTimeoutMs,
    logPath,
  });
  if (shouldInstall) phases.push(runPhase("install dependencies", packageManager.install));
  if (phases.every((phase) => phase.ok) && shouldVerify) {
    phases.push(runPhase("happy path", packageManager.run("nodetrace:happy-path")));
    if (phases.every((phase) => phase.ok)) phases.push(runPhase("smoke", packageManager.run("nodetrace:smoke")));
    const pkg = readJson(join(targetDir, "package.json"));
    if (phases.every((phase) => phase.ok) && pkg.scripts?.build) phases.push(runPhase("build", packageManager.run("build")));
  }

  const receipt = {
    ok: phases.every((phase) => phase.ok),
    startedAt: new Date(startedAtMs).toISOString(),
    completedAt: new Date().toISOString(),
    totalMs: Date.now() - startedAtMs,
    targetDir,
    framework,
    apiKeysRequired: false,
    setupLog: ".nodetrace/setup-log.txt",
    files: [
      "src/nodetrace",
      "src/nodetrace-demo",
      "db/nodetrace.schema.sql",
      "scripts/nodetrace-init.mjs",
      "scripts/nodetrace-smoke.mjs",
      framework === "next" ? formatPath(nextPagePath(targetDir), targetDir) : "nodetrace.html",
      "docs/NODETRACE_INTEGRATION.md",
    ],
    phases,
    nextSteps: [
      "npm run nodetrace:dev",
      framework === "next" ? "Open /nodetrace" : "Open /nodetrace.html",
      "Copy TraceLensProvider and TraceLensPanel into your app shell when ready.",
    ],
  };
  writeJson(join(targetDir, ".nodetrace", "setup-receipt.json"), receipt);

  if (!receipt.ok) {
    console.error("NodeTrace add failed. See .nodetrace/setup-receipt.json and .nodetrace/setup-log.txt");
    process.exitCode = 1;
    return;
  }

  console.log("NodeTrace add: PASS");
  console.log("Receipt: .nodetrace/setup-receipt.json");
  console.log("Log: .nodetrace/setup-log.txt");
  console.log("Next:");
  console.log("  npm run nodetrace:dev");
  console.log(framework === "next"
    ? "  open http://127.0.0.1:3000/nodetrace or the Next URL printed by your app"
    : "  open http://127.0.0.1:5173/nodetrace.html or the Vite URL printed by your app");
}

function copyDir(sourceDir, targetDir, options) {
  mkdirSync(targetDir, { recursive: true });
  for (const entry of readdirSync(sourceDir)) {
    const sourcePath = join(sourceDir, entry);
    const targetPath = join(targetDir, entry);
    const stats = statSync(sourcePath);
    if (stats.isDirectory()) copyDir(sourcePath, targetPath, options);
    else if (stats.isFile()) copyText(sourcePath, targetPath, options);
  }
}

function copyText(sourcePath, targetPath, options) {
  let text = readFileSync(sourcePath, "utf8");
  for (const [from, to] of options.replacements ?? []) text = text.replaceAll(from, to);
  writeText(targetPath, text, options);
}

function writeText(targetPath, text, options) {
  if (existsSync(targetPath) && !options.force) throw new Error(`Refusing to overwrite ${formatPath(targetPath)}. Re-run with --force.`);
  mkdirSync(dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, text);
}

function updatePackageJson(targetDir, framework) {
  const path = join(targetDir, "package.json");
  const pkg = readJson(path);
  pkg.scripts = {
    ...pkg.scripts,
    "nodetrace:dev": pkg.scripts?.["nodetrace:dev"] ?? (framework === "next" ? "next dev" : "vite --host 127.0.0.1 --open /nodetrace.html"),
    "nodetrace:happy-path": "node scripts/nodetrace-init.mjs --json-out docs/eval/nodetrace-happy-path.json",
    "nodetrace:smoke": "node scripts/nodetrace-smoke.mjs",
  };
  // Ranges come from this package's own manifest rather than a second list
  // maintained by hand here: a copied file whose dependency was never declared
  // is the same defect as a copied file whose import was never copied.
  // @sigma/*, graphology* and sigma are what vendor/nodegraph-live imports.
  pkg.dependencies = withOwnRanges(pkg.dependencies, "dependencies", [
    "@sigma/node-border",
    "better-sqlite3",
    "graphology",
    "graphology-layout-forceatlas2",
    "lucide-react",
    "react",
    "react-dom",
    "sigma",
  ]);
  pkg.devDependencies = withOwnRanges(pkg.devDependencies, "devDependencies", [
    "@types/node",
    "@types/react",
    "@types/react-dom",
    "typescript",
    ...(framework === "next" ? [] : ["@vitejs/plugin-react", "vite"]),
  ]);
  writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`);
}

function withOwnRanges(existing, field, names) {
  const patched = { ...existing };
  for (const name of names) {
    const range = packageManifest[field]?.[name];
    if (!range) throw new Error(`NodeTrace ${field} is missing ${name}; the installed target would not build.`);
    patched[name] = patched[name] ?? range;
  }
  return patched;
}

function runCommand(cwd, name, command, options) {
  const startedAt = performance.now();
  const commandText = command.join(" ");
  const phaseLabel = options.total > 0 ? `[${options.index}/${options.total}]` : "-";
  console.log(`${phaseLabel} ${name}`);
  console.log(`    ${commandText}`);
  appendSetupLog(options.logPath, `## ${name}\ncommand=${commandText}\nstartedAt=${new Date().toISOString()}\n`);
  const result = spawnSync(command[0], command.slice(1), {
    cwd,
    encoding: "utf8",
    shell: false,
    timeout: options.timeoutMs,
    env: commandEnv(),
  });
  const output = [result.error?.message, result.stdout, result.stderr].filter(Boolean).join("\n");
  const durationMs = Math.round(performance.now() - startedAt);
  const timedOut = result.error?.code === "ETIMEDOUT";
  const ok = result.status === 0 && !result.error;
  const status = timedOut ? `TIMEOUT after ${formatMs(options.timeoutMs)}` : ok ? "PASS" : "FAIL";
  appendSetupLog(options.logPath, `completedAt=${new Date().toISOString()}\ndurationMs=${durationMs}\nstatus=${status}\n\n${output.trim()}\n\n`);
  console.log(`    ${status} ${formatMs(durationMs)}`);
  if (!ok && output.trim()) console.error(output.trim().slice(-3000));
  return {
    name,
    command: commandText,
    ok,
    durationMs,
    timeoutMs: options.timeoutMs,
    detail: ok ? "completed" : commandFailureDetail(output, timedOut, options.timeoutMs),
  };
}

function detectPackageManager(targetDir) {
  if (existsSync(join(targetDir, "pnpm-lock.yaml"))) {
    const pnpm = packageManagerCommand("pnpm");
    return { install: [...pnpm, "install"], run: (script) => [...pnpm, "run", script] };
  }
  if (existsSync(join(targetDir, "yarn.lock"))) {
    const yarn = packageManagerCommand("yarn");
    return { install: [...yarn, "install"], run: (script) => [...yarn, script] };
  }
  if (existsSync(join(targetDir, "bun.lockb")) || existsSync(join(targetDir, "bun.lock"))) {
    const bun = packageManagerCommand("bun");
    return { install: [...bun, "install"], run: (script) => [...bun, "run", script] };
  }
  const npm = npmCommand();
  return {
    install: [...npm, "install", "--cache", ".nodetrace/npm-cache", "--prefer-offline", "--no-audit", "--fund=false", "--progress=false"],
    run: (script) => [...npm, "run", script],
  };
}

function targetSmokeScript() {
  return `import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

const tempDir = mkdtempSync(join(tmpdir(), "nodetrace-target-smoke-"));
const dbPath = join(tempDir, "nodetrace.sqlite");
const statePath = join(tempDir, "nodetrace-state.json");
const reportPath = join(tempDir, "happy-path.json");
const result = spawnSync(process.execPath, ["scripts/nodetrace-init.mjs", "--db", dbPath, "--state", statePath, "--json-out", reportPath], {
  cwd: process.cwd(),
  encoding: "utf8",
});
const issues = [];
if (result.status !== 0) issues.push(\`happy path failed: \${[result.stdout, result.stderr].join("\\n").slice(-1200)}\`);
for (const file of [dbPath, statePath, reportPath, "src/nodetrace/TraceLensPanel.tsx", "src/nodetrace/TraceLensProvider.tsx", "db/nodetrace.schema.sql", "nodetrace.html"]) {
  if (file === "nodetrace.html" && (existsSync("app/nodetrace/page.tsx") || existsSync("src/app/nodetrace/page.tsx"))) continue;
  if (!existsSync(file)) issues.push(\`missing \${file}\`);
}
if (issues.length === 0) {
  const panel = readFileSync("src/nodetrace/TraceLensPanel.tsx", "utf8");
  const provider = readFileSync("src/nodetrace/TraceLensProvider.tsx", "utf8");
  for (const required of ["Business proof", "Runtime trace", "Code ownership", "Review", "Builder", "Query", "Mutation", "Skill"]) {
    if (!panel.includes(required)) issues.push(\`TraceLensPanel missing \${required}\`);
  }
  for (const required of ["data-nodetrace-surface", "data-noderoom-surface"]) {
    if (!provider.includes(required)) issues.push(\`TraceLensProvider missing \${required}\`);
  }
}
const report = { ok: issues.length === 0, completedAt: new Date().toISOString(), apiKeysRequired: false, issues };
writeJson("docs/eval/nodetrace-smoke.json", report);
if (tempDir.startsWith(tmpdir())) rmSync(tempDir, { recursive: true, force: true });
if (issues.length > 0) {
  console.error("nodetrace target smoke: FAIL");
  for (const issue of issues) console.error(\`  - \${issue}\`);
  process.exitCode = 1;
} else {
  console.log("nodetrace target smoke: PASS");
}
function writeJson(path, value) {
  const parent = dirname(path);
  if (parent && parent !== "." && !existsSync(parent)) mkdirSync(parent, { recursive: true });
  writeFileSync(path, \`\${JSON.stringify(value, null, 2)}\\n\`);
}
`;
}

function nextPage(importPath) {
  return `"use client";

import dynamic from "next/dynamic";
import "${importPath.replace(/DemoDashboard$/, "styles.css")}";

// The dashboard mounts a WebGL graph renderer and fetches its state in an
// effect, so it has nothing to say on the server. Static prerendering it fails
// the build with \`WebGL2RenderingContext is not defined\`; load it client-side.
const DemoDashboard = dynamic(() => import("${importPath}").then((module) => module.DemoDashboard), { ssr: false });

export default function NodeTracePage() {
  return <DemoDashboard />;
}
`;
}

function demoMain() {
  return `import React from "react";
import { createRoot } from "react-dom/client";
import { DemoDashboard } from "./DemoDashboard";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <DemoDashboard />
  </React.StrictMode>,
);
`;
}

function demoHtml() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>NodeTrace Integration</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/nodetrace-demo/main.tsx"></script>
  </body>
</html>
`;
}

function integrationDoc(framework) {
  const route = framework === "next" ? "/nodetrace" : "/nodetrace.html";
  const entry = framework === "next" ? "App Router page at `src/app/nodetrace/page.tsx` or `app/nodetrace/page.tsx`" : "Vite demo entry at `nodetrace.html`";
  return `# NodeTrace Integration

This app was patched by \`nodetrace add\`.

## Run

\`\`\`bash
npm run nodetrace:happy-path
npm run nodetrace:smoke
npm run nodetrace:dev
\`\`\`

Open \`${route}\` in the dev server.

## Files Added

- \`src/nodetrace/\`: portable Trace Lens components and types, plus the vendored NodeGraph Live renderer they import (\`src/nodetrace/vendor/nodegraph-live/\`).
- \`src/nodetrace-demo/\`: no-key demo dashboard entry.
- \`db/nodetrace.schema.sql\`: generic SQLite trace schema.
- \`scripts/nodetrace-init.mjs\`: local SQLite/state initializer.
- \`scripts/nodetrace-smoke.mjs\`: target app smoke.
- ${entry}.

## Wire Into The App

Wrap the app shell with \`TraceLensProvider\`, render \`TraceLensPanel\`, and tag visible surfaces with \`data-nodetrace-surface\`.

Keep \`builderCapable\` server-verified. Do not expose code ownership, file paths, query names, mutation names, skill paths, raw prompts, cookies, tokens, or secrets in public client state. Builder ownership should come from a privileged server route and include component, query, mutation, skill, and test refs.
`;
}

function parseOptions(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--target" || value === "--dir") {
      parsed.target = values[index + 1];
      index += 1;
    } else if (value === "--force") {
      parsed.force = true;
    } else if (value === "--framework") {
      const framework = values[index + 1];
      if (framework !== "vite" && framework !== "next") {
        console.error("--framework must be vite or next");
        process.exit(1);
      }
      parsed.framework = framework;
      index += 1;
    } else if (value === "--skip-install") {
      parsed.skipInstall = true;
    } else if (value === "--skip-verify") {
      parsed.skipVerify = true;
    }
  }
  return parsed;
}

function detectFramework(targetDir) {
  const pkg = readJson(join(targetDir, "package.json"));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  if (deps.next || existsSync(join(targetDir, "next.config.js")) || existsSync(join(targetDir, "next.config.mjs"))) return "next";
  return "vite";
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function nextPagePath(targetDir) {
  return existsSync(join(targetDir, "src", "app"))
    ? join(targetDir, "src", "app", "nodetrace", "page.tsx")
    : join(targetDir, "app", "nodetrace", "page.tsx");
}

function nextPageImport(targetDir) {
  return existsSync(join(targetDir, "src", "app"))
    ? "../../nodetrace-demo/DemoDashboard"
    : "../../src/nodetrace-demo/DemoDashboard";
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function appendSetupLog(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, value);
}

function commandEnv() {
  return {
    ...process.env,
    NEXT_TELEMETRY_DISABLED: "1",
    npm_config_audit: "false",
    npm_config_fund: "false",
    npm_config_progress: "false",
    npm_config_update_notifier: "false",
    NO_UPDATE_NOTIFIER: "1",
  };
}

function commandFailureDetail(output, timedOut, timeoutMs) {
  if (timedOut) return `timed out after ${formatMs(timeoutMs)}; see .nodetrace/setup-log.txt`;
  return output.slice(-240).replace(/\s+/g, " ").trim() || "failed; see .nodetrace/setup-log.txt";
}

function readPositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function formatMs(ms) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms}ms`;
}

function formatPath(path, from = process.cwd()) {
  const relativePath = relative(from, path);
  return relativePath && !relativePath.startsWith("..") ? relativePath : path;
}

function npmCommand() {
  const npmExecPath = process.env.npm_execpath;
  if (npmExecPath && existsSync(npmExecPath)) return [process.execPath, npmExecPath];
  return packageManagerCommand("npm");
}

function packageManagerCommand(name) {
  return process.platform === "win32" ? ["cmd.exe", "/d", "/s", "/c", `${name}.cmd`] : [name];
}

function printHelp() {
  console.log(`NodeTrace ${version}

Commands:
  nodetrace add [--target <dir>] [--framework vite|next] [--force] [--skip-install] [--skip-verify]
  nodetrace capture --plan <capture-plan.json> [--dry-run]

Default add behavior copies Trace Lens, patches package scripts/dependencies,
runs install, runs the no-key happy path, runs target smoke, and runs build
when the target app has a build script. Vite targets get nodetrace.html; Next
targets get an App Router /nodetrace page.
Each phase writes .nodetrace/setup-receipt.json and .nodetrace/setup-log.txt.
Set NODETRACE_PHASE_TIMEOUT_MS to tune the per-phase timeout.

Capture runs a reusable real-codebase proof plan: actual source screenshots
from real files plus actual running-app Playwright screenshots and a manifest.
`);
}
