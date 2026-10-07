import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, relative, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import net from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { parseArgs } from "node:util";

export async function runCaptureCli(args, context = {}) {
  const { values: options } = parseArgs({
    args,
    options: {
      plan: { type: "string" },
      "dry-run": { type: "boolean" },
      "source-root": { type: "string" },
      "capture-root": { type: "string" },
      manifest: { type: "string" },
      "timeout-ms": { type: "string" },
      "app-url": { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });
  if (options.help || args.length === 0) {
    printCaptureHelp();
    return;
  }
  if (!options.plan) throw new Error("Missing --plan <capture-plan.json>");
  const planPath = resolve(context.cwd ?? process.cwd(), options.plan);
  const plan = loadCapturePlan(planPath);
  const merged = applyCaptureOverrides(plan, options);
  if (isTruthy(options["dry-run"])) {
    const normalized = normalizeCapturePlan(merged, { cwd: context.cwd ?? process.cwd(), planPath });
    console.log(`nodetrace capture dry run: PASS ${normalized.steps.length} steps`);
    console.log(`manifest: ${relativePath(normalized.manifestPath, context.cwd ?? process.cwd())}`);
    return;
  }
  const result = await captureCodebaseFromPlan(merged, { cwd: context.cwd ?? process.cwd(), planPath });
  console.log(`nodetrace capture: PASS ${result.steps.length} source screenshots + ${result.steps.length} app screenshots`);
  console.log(`wrote ${relativePath(result.manifestPath, context.cwd ?? process.cwd())}`);
}

export function loadCapturePlan(planPath) {
  return JSON.parse(readFileSync(planPath, "utf8").replace(/^\uFEFF/, ""));
}

export async function captureCodebaseFromPlan(rawPlan, context = {}) {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    throw new Error("Missing dependency: install Playwright before running nodetrace capture.");
  }

  const plan = normalizeCapturePlan(rawPlan, context);
  mkdirSync(plan.captureRoot, { recursive: true });
  mkdirSync(dirname(plan.manifestPath), { recursive: true });

  const childProcesses = [];
  const cleanup = () => {
    for (const child of childProcesses.splice(0)) killTree(child);
  };
  process.once("exit", cleanup);

  const browser = await chromium.launch({ headless: plan.headless });
  try {
    const appBaseUrl = await resolveAppBaseUrl(plan, childProcesses);
    const codePage = await browser.newPage({ viewport: plan.editor.viewport, deviceScaleFactor: 1 });
    await captureCodeBrowserSteps({ page: codePage, plan });

    const appPage = await browser.newPage({ viewport: plan.app.viewport, deviceScaleFactor: 1 });
    await captureAppSteps({ page: appPage, appBaseUrl, plan });

    const manifest = buildManifest(plan, appBaseUrl);
    writeJson(plan.manifestPath, manifest);
    return {
      manifest,
      manifestPath: plan.manifestPath,
      captureRoot: plan.captureRoot,
      steps: plan.steps,
    };
  } finally {
    await browser.close();
    cleanup();
    process.removeListener("exit", cleanup);
  }
}

export function normalizeCapturePlan(rawPlan, context = {}) {
  const cwd = resolve(context.cwd ?? process.cwd());
  const planDir = context.planPath ? dirname(resolve(context.planPath)) : cwd;
  const plan = rawPlan ?? {};
  const id = plan.id ?? "codebase-capture";
  const sourceRoot = resolveFrom(plan.sourceRoot ?? ".", planDir);
  const captureRoot = resolveFrom(plan.captureRoot ?? "public/captures", planDir);
  const manifestPath = resolveFrom(plan.manifestPath ?? plan.manifest ?? `${captureRoot}/${id}-manifest.json`, planDir);
  const timeoutMs = Number(plan.timeoutMs ?? 120_000);
  const editorMode = plan.editor?.mode ?? plan.editor?.capture ?? "code-browser";
  if (editorMode !== "code-browser") {
    throw new Error(`Unsupported editor.mode "${editorMode}". NodeTrace renders source slices itself with Shiki; "code-browser" is the only mode.`);
  }
  const steps = normalizeSteps(plan.steps ?? [], { sourceRoot, captureRoot, assetPathPrefix: plan.assetPathPrefix ?? "captures" });
  if (steps.length === 0) throw new Error("Capture plan must include at least one step.");
  return {
    id,
    generator: plan.generator ?? "nodetrace reusable codebase capture",
    sourceRepo: plan.sourceRepo ?? plan.repository ?? "local",
    sourceRoot,
    captureRoot,
    manifestPath,
    assetPathPrefix: plan.assetPathPrefix ?? "captures",
    timeoutMs,
    headless: plan.headless !== false,
    editor: {
      mode: editorMode,
      viewport: plan.editor?.viewport ?? { width: 1440, height: 920 },
    },
    app: {
      name: plan.app?.name ?? "app",
      url: plan.app?.url,
      host: plan.app?.host ?? "127.0.0.1",
      port: plan.app?.port ? Number(plan.app.port) : undefined,
      startCommand: plan.app?.startCommand,
      startCwd: plan.app?.startCwd ? resolveFrom(plan.app.startCwd, planDir) : sourceRoot,
      waitUrl: plan.app?.waitUrl,
      setupActions: plan.app?.setupActions ?? [],
      viewport: plan.app?.viewport ?? { width: 1440, height: 1000 },
    },
    steps,
  };
}

export async function findFreePort(start, host = "127.0.0.1") {
  for (let port = start; port < start + 100; port += 1) {
    if (await isPortFree(port, host)) return port;
  }
  throw new Error(`No free port found from ${start} to ${start + 99}`);
}

function normalizeSteps(rawSteps, context) {
  return rawSteps.map((step, index) => {
    const source = step.sourceView ?? step.source;
    const ui = step.uiCapture ?? step.ui;
    if (!step.id) throw new Error(`Capture step at index ${index} is missing id.`);
    if (!source?.filePath) throw new Error(`${step.id}: missing source.filePath.`);
    if (!ui?.selector) throw new Error(`${step.id}: missing ui.selector.`);
    const sourcePath = resolve(context.sourceRoot, source.filePath);
    if (!existsSync(sourcePath)) throw new Error(`${step.id}: source file not found: ${sourcePath}`);
    const sourceLines = readFileSync(sourcePath, "utf8").split(/\r?\n/);
    const lineRange = resolveLineRange(sourcePath, source);
    const ideFileName = source.imageName ?? `${step.id}-ide.png`;
    const uiFileName = ui.screenshotName ?? `${step.id}-ui.png`;
    return {
      id: step.id,
      sourceView: {
        captureKind: source.captureKind,
        filePath: source.filePath,
        startLine: lineRange.startLine,
        endLine: lineRange.endLine,
        titleHint: source.filePath.split("/").at(-1),
        textHint: selectSourceTextHint(source, sourceLines, lineRange),
        imagePath: assetPath(context.assetPathPrefix, ideFileName),
        outputPath: resolve(context.captureRoot, ideFileName),
      },
      uiCapture: {
        captureKind: ui.captureKind,
        selector: ui.selector,
        actions: ui.actions ?? [],
        waitForImage: Boolean(ui.waitForImage),
        screenshotPath: assetPath(context.assetPathPrefix, uiFileName),
        outputPath: resolve(context.captureRoot, uiFileName),
        rect: null,
      },
    };
  });
}

function resolveLineRange(sourcePath, source) {
  if (source.startLine && source.endLine) {
    return { startLine: Number(source.startLine), endLine: Number(source.endLine) };
  }
  if (!source.anchor) throw new Error(`${source.filePath}: provide startLine/endLine or anchor.`);
  const lines = readFileSync(sourcePath, "utf8").split(/\r?\n/);
  const anchorIndex = lines.findIndex((line) => line.includes(source.anchor));
  if (anchorIndex < 0) throw new Error(`anchor not found in ${source.filePath}: ${source.anchor}`);
  const before = Number(source.before ?? 0);
  const after = Number(source.after ?? 20);
  const start = Math.max(0, anchorIndex + before);
  const end = Math.min(lines.length - 1, anchorIndex + after);
  return { startLine: start + 1, endLine: end + 1 };
}

function selectSourceTextHint(source, lines, lineRange) {
  if (source.textHint) return source.textHint;
  if (source.anchor) return source.anchor;
  const window = lines.slice(lineRange.startLine - 1, lineRange.endLine);
  const usefulLine = window.find((line) => {
    const text = line.trim();
    return text.length >= 8 && !/^[{}()[\],;]+$/.test(text);
  });
  return usefulLine?.trim() ?? "";
}

async function resolveAppBaseUrl(plan, childProcesses) {
  if (plan.app.url) return plan.app.url;
  if (!plan.app.startCommand) throw new Error("Capture plan app must provide url or startCommand.");
  const port = plan.app.port ?? await findFreePort(5179, plan.app.host);
  const command = materializeCommand(plan.app.startCommand, { host: plan.app.host, port });
  const child = spawnPlanCommand(command, { cwd: plan.app.startCwd });
  childProcesses.push(child);
  child.stdout?.on("data", (chunk) => process.stdout.write(`[${plan.app.name}] ${chunk}`));
  child.stderr?.on("data", (chunk) => process.stderr.write(`[${plan.app.name}] ${chunk}`));
  const url = plan.app.waitUrl ?? `http://${plan.app.host}:${port}/`;
  await waitForHttp(url, plan.timeoutMs, `${plan.app.name} dev server`);
  return url;
}

async function captureCodeBrowserSteps({ page, plan }) {
  for (const step of plan.steps) {
    console.log(`capturing code browser: ${step.id} ${step.sourceView.filePath}:${step.sourceView.startLine}`);
    await page.setContent(await renderCodeBrowserHtml({ plan, step }), { waitUntil: "load", timeout: plan.timeoutMs });
    const frame = page.locator(".nt-code-browser").first();
    await frame.waitFor({ state: "visible", timeout: plan.timeoutMs });
    await frame.screenshot({ path: step.sourceView.outputPath });
    step.sourceView.captureKind = "actual-code-browser-shiki";
  }
}

async function renderCodeBrowserHtml({ plan, step }) {
  const { codeToHtml } = await import("shiki");
  const sourcePath = resolve(plan.sourceRoot, step.sourceView.filePath);
  const sourceLines = readFileSync(sourcePath, "utf8").split(/\r?\n/);
  const snippet = sourceLines.slice(step.sourceView.startLine - 1, step.sourceView.endLine).join("\n");
  const highlighted = await codeToHtml(snippet, {
    lang: languageForPath(step.sourceView.filePath),
    theme: "github-light",
  });
  const treeRows = buildCodeTreeRows(plan.sourceRoot, step.sourceView.filePath)
    .map((row) => {
      const indent = row.depth * 14;
      const icon = row.kind === "dir" ? (row.open ? "▾" : "▸") : fileIcon(row.name);
      return `<div class="tree-row ${row.active ? "active" : ""}" style="--indent:${indent}px"><span class="tree-icon">${icon}</span><span>${escapeHtml(row.name)}</span></div>`;
    })
    .join("");
  const startLine = step.sourceView.startLine - 1;
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #eef2f7; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #172033; }
    .nt-code-browser { width: 1440px; height: 920px; background: #f8fafc; border: 1px solid #d9e2ef; overflow: hidden; }
    .topbar { height: 46px; display: flex; align-items: center; gap: 14px; padding: 0 18px; background: #ffffff; border-bottom: 1px solid #d9e2ef; }
    .dots { display: flex; gap: 7px; }
    .dot { width: 11px; height: 11px; border-radius: 999px; }
    .dot.red { background: #e35d45; } .dot.yellow { background: #e4ad39; } .dot.green { background: #2fb36f; }
    .title { font-size: 13px; font-weight: 700; color: #29364d; }
    .path { margin-left: auto; font: 12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; color: #62708a; }
    .layout { display: grid; grid-template-columns: 292px 1fr 92px; height: 874px; }
    .sidebar { background: #f3f6fb; border-right: 1px solid #d9e2ef; padding: 16px 12px; overflow: hidden; }
    .side-head { display: flex; align-items: center; justify-content: space-between; margin: 0 6px 12px; font-size: 11px; font-weight: 800; letter-spacing: .08em; color: #6b7890; text-transform: uppercase; }
    .repo { margin: 0 6px 12px; font-size: 12px; font-weight: 700; color: #1c2a43; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .tree { height: 790px; overflow: hidden; font: 12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    .tree-row { height: 24px; display: flex; align-items: center; gap: 7px; padding-left: calc(6px + var(--indent)); border-radius: 6px; color: #53627b; white-space: nowrap; }
    .tree-row.active { color: #9d341f; background: #ffe8de; box-shadow: inset 3px 0 0 #df6041; font-weight: 800; }
    .tree-icon { width: 16px; color: #8793a7; }
    .editor { min-width: 0; background: #ffffff; overflow: hidden; }
    .crumbs { height: 44px; display: flex; align-items: center; gap: 7px; padding: 0 20px; border-bottom: 1px solid #e5ebf4; font: 12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; color: #63718a; }
    .crumbs strong { color: #233047; }
    .code-wrap { height: 830px; overflow: hidden; padding: 18px 0 24px; }
    .shiki { margin: 0; background: transparent !important; font-size: 13px; line-height: 20px; }
    .shiki code { counter-reset: line ${startLine}; display: block; min-width: 100%; }
    .shiki .line { display: block; min-height: 20px; padding-right: 18px; }
    .shiki .line::before { counter-increment: line; content: counter(line); display: inline-block; width: 52px; margin-right: 18px; padding-right: 12px; text-align: right; color: #8b98ad; border-right: 1px solid #e1e7f0; user-select: none; }
    .shiki .line:nth-child(1), .shiki .line:nth-child(2), .shiki .line:nth-child(3), .shiki .line:nth-child(4) { background: #fff4ef; }
    .minimap { background: #f8fafc; border-left: 1px solid #e5ebf4; padding: 58px 18px; }
    .mini-rail { width: 54px; height: 560px; border-radius: 9px; border: 1px solid #d9e2ef; background: linear-gradient(#dfe7f2 0 2px, transparent 2px 8px), #ffffff; background-size: 100% 8px; position: relative; overflow: hidden; }
    .mini-hot { position: absolute; left: 8px; top: 38%; width: 38px; height: 88px; border-radius: 6px; background: rgba(223,96,65,.22); border: 1px solid rgba(223,96,65,.62); }
    .caption { position: absolute; left: 314px; bottom: 16px; font-size: 12px; color: #63718a; }
  </style>
</head>
<body>
  <main class="nt-code-browser">
    <div class="topbar">
      <div class="dots"><span class="dot red"></span><span class="dot yellow"></span><span class="dot green"></span></div>
      <div class="title">NodeTrace code browser</div>
      <div class="path">${escapeHtml(step.sourceView.filePath)} · lines ${step.sourceView.startLine}-${step.sourceView.endLine}</div>
    </div>
    <div class="layout">
      <aside class="sidebar">
        <div class="side-head"><span>Explorer</span><span>real fs</span></div>
        <div class="repo">${escapeHtml(plan.sourceRepo)}</div>
        <div class="tree">${treeRows}</div>
      </aside>
      <section class="editor">
        <div class="crumbs">${step.sourceView.filePath.split("/").map((part, index, all) => index === all.length - 1 ? `<strong>${escapeHtml(part)}</strong>` : `<span>${escapeHtml(part)}</span><span>/</span>`).join("")}</div>
        <div class="code-wrap">${highlighted}</div>
      </section>
      <aside class="minimap"><div class="mini-rail"><div class="mini-hot"></div></div></aside>
    </div>
    <div class="caption">Rendered from the actual repository files by NodeTrace capture. No VS Code process, profile, or workspace trust state required.</div>
  </main>
</body>
</html>`;
}

function buildCodeTreeRows(sourceRoot, activeFilePath) {
  const activeParts = activeFilePath.split(/[\\/]/).filter(Boolean);
  const ignored = new Set([".git", "node_modules", "dist", "build", ".next", "coverage", "test-results"]);
  const rows = [];
  function visit(absDir, depth, relParts) {
    let entries = [];
    try {
      entries = readdirSync(absDir, { withFileTypes: true })
        .filter((entry) => !ignored.has(entry.name))
        .sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name));
    } catch {
      return;
    }
    const activePrefix = activeParts.slice(0, relParts.length + 1).join("/");
    for (const entry of entries) {
      const rel = [...relParts, entry.name].join("/");
      const active = rel === activeFilePath;
      const open = entry.isDirectory() && rel === activePrefix;
      rows.push({ name: entry.name, kind: entry.isDirectory() ? "dir" : "file", depth, active, open });
      if (open) visit(resolve(absDir, entry.name), depth + 1, [...relParts, entry.name]);
    }
  }
  rows.push({ name: basename(sourceRoot), kind: "dir", depth: 0, active: false, open: true });
  visit(sourceRoot, 1, []);
  return rows.slice(0, 96);
}

function languageForPath(path) {
  const ext = extname(path).toLowerCase();
  if (ext === ".tsx") return "tsx";
  if (ext === ".ts") return "ts";
  if (ext === ".jsx") return "jsx";
  if (ext === ".js" || ext === ".mjs" || ext === ".cjs") return "js";
  if (ext === ".css") return "css";
  if (ext === ".json") return "json";
  if (ext === ".md") return "md";
  if (ext === ".yml" || ext === ".yaml") return "yaml";
  if (ext === ".html") return "html";
  return "text";
}

function fileIcon(name) {
  const ext = extname(name).toLowerCase();
  if ([".ts", ".tsx"].includes(ext)) return "TS";
  if ([".js", ".jsx", ".mjs", ".cjs"].includes(ext)) return "JS";
  if (ext === ".css") return "#";
  if (ext === ".json") return "{}";
  return "·";
}

async function captureAppSteps({ page, appBaseUrl, plan }) {
  await runActions(page, plan.app.setupActions, { appBaseUrl, timeoutMs: plan.timeoutMs });
  for (const step of plan.steps) {
    console.log(`capturing app: ${step.id} ${step.uiCapture.selector}`);
    await runActions(page, step.uiCapture.actions, { appBaseUrl, timeoutMs: plan.timeoutMs });
    const locator = page.locator(step.uiCapture.selector).first();
    await locator.scrollIntoViewIfNeeded({ timeout: plan.timeoutMs }).catch(() => undefined);
    await locator.waitFor({ state: "visible", timeout: plan.timeoutMs });
    if (step.uiCapture.waitForImage) await waitForLoadedImage(locator, plan.timeoutMs);
    const box = await locator.boundingBox({ timeout: plan.timeoutMs });
    if (!box) throw new Error(`capture target has no bounding box for ${step.id}`);
    const rect = {
      x: Math.round(box.x),
      y: Math.round(box.y),
      width: Math.round(box.width),
      height: Math.round(box.height),
    };
    if (rect.width < 20 || rect.height < 20) throw new Error(`capture target too small for ${step.id}: ${JSON.stringify(rect)}`);
    step.uiCapture.rect = rect;
    await locator.screenshot({ path: step.uiCapture.outputPath });
    step.uiCapture.captureKind = step.uiCapture.captureKind ?? "actual-app-playwright";
  }
}

async function runActions(page, actions, context) {
  for (const action of actions) {
    if (!action?.type) throw new Error(`Capture action is missing type: ${JSON.stringify(action)}`);
    if (action.type === "goto") {
      const url = new URL(action.url ?? context.appBaseUrl);
      for (const [key, value] of Object.entries(action.query ?? {})) url.searchParams.set(key, String(value));
      await page.goto(url.toString(), { waitUntil: action.waitUntil ?? "domcontentloaded", timeout: action.timeoutMs ?? context.timeoutMs });
    } else if (action.type === "reload") {
      await page.reload({ waitUntil: action.waitUntil ?? "domcontentloaded", timeout: action.timeoutMs ?? context.timeoutMs });
    } else if (action.type === "waitFor") {
      await actionLocator(page, action).waitFor({ state: action.state ?? "visible", timeout: action.timeoutMs ?? context.timeoutMs });
    } else if (action.type === "click") {
      const locator = actionLocator(page, action);
      if (action.ifVisible) {
        const visible = await locator.isVisible({ timeout: action.timeoutMs ?? 1000 }).catch(() => false);
        if (!visible) continue;
      } else {
        await locator.waitFor({ state: "visible", timeout: action.timeoutMs ?? context.timeoutMs });
      }
      if (action.ifAttributeNot) {
        const current = await locator.getAttribute(action.ifAttributeNot.name, { timeout: action.timeoutMs ?? context.timeoutMs });
        if (current === action.ifAttributeNot.value) continue;
      }
      await locator.click({ timeout: action.timeoutMs ?? context.timeoutMs });
    } else if (action.type === "fill") {
      await actionLocator(page, action).fill(String(action.value ?? ""), { timeout: action.timeoutMs ?? context.timeoutMs });
    } else if (action.type === "press") {
      await actionLocator(page, action).press(action.key, { timeout: action.timeoutMs ?? context.timeoutMs });
    } else if (action.type === "localStorage.set") {
      await page.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: action.key, value: String(action.value ?? "") });
    } else if (action.type === "waitForImage") {
      await waitForLoadedImage(actionLocator(page, action), action.timeoutMs ?? context.timeoutMs);
    } else if (action.type === "delay") {
      await delay(Number(action.ms ?? 250));
    } else {
      throw new Error(`Unsupported capture action type: ${action.type}`);
    }
  }
}

function actionLocator(page, action) {
  let locator;
  if (action.testId) locator = page.getByTestId(action.testId);
  else if (action.text) locator = page.getByText(action.text, { exact: Boolean(action.exact) });
  else if (action.role) locator = page.getByRole(action.role, { name: action.name, exact: Boolean(action.exact) });
  else if (action.selector) locator = page.locator(action.selector);
  else throw new Error(`Action requires selector, testId, text, or role: ${JSON.stringify(action)}`);
  if (action.hasText) locator = locator.filter({ hasText: action.hasText });
  return action.all ? locator : locator.first();
}

async function waitForLoadedImage(locator, timeoutMs) {
  const image = locator.locator("img").first();
  await image.waitFor({ state: "visible", timeout: timeoutMs });
  await image.evaluate(
    (img) =>
      new Promise((resolveImage, rejectImage) => {
        const ready = () => img.complete && img.naturalWidth > 20 && img.naturalHeight > 20;
        if (ready()) {
          resolveImage(true);
          return;
        }
        const timeout = setTimeout(() => rejectImage(new Error("image did not load")), 15000);
        img.addEventListener("load", () => {
          if (ready()) {
            clearTimeout(timeout);
            resolveImage(true);
          }
        }, { once: true });
        img.addEventListener("error", () => {
          clearTimeout(timeout);
          rejectImage(new Error("image failed to load"));
        }, { once: true });
      }),
  );
}

function buildManifest(plan, appBaseUrl) {
  const sourceCaptureModel = "actual code-browser source screenshots from real filesystem using Shiki";
  const appCaptureModel = `actual running ${plan.app.name} Playwright screenshots`;
  return {
    generator: plan.generator,
    generatedAt: new Date().toISOString(),
    sourceRepo: plan.sourceRepo,
    sourceRoot: relativePath(plan.sourceRoot),
    appUrl: appBaseUrl,
    sourceViewUrl: "inline:nodetrace-code-browser",
    captureModel: `${sourceCaptureModel} + ${appCaptureModel}`,
    steps: plan.steps.map((step) => ({
      id: step.id,
      sourceView: {
        captureKind: step.sourceView.captureKind,
        filePath: step.sourceView.filePath,
        startLine: step.sourceView.startLine,
        endLine: step.sourceView.endLine,
        imagePath: step.sourceView.imagePath,
      },
      uiCapture: {
        captureKind: step.uiCapture.captureKind,
        selector: step.uiCapture.selector,
        rect: step.uiCapture.rect,
        screenshotPath: step.uiCapture.screenshotPath,
      },
    })),
  };
}

function materializeCommand(command, values) {
  if (Array.isArray(command)) return command.map((part) => replaceTokens(part, values));
  if (typeof command === "object" && command.command) {
    return {
      command: replaceTokens(command.command, values),
      args: (command.args ?? []).map((part) => replaceTokens(part, values)),
    };
  }
  return replaceTokens(String(command), values);
}

function replaceTokens(value, values) {
  return String(value).replaceAll("{host}", values.host).replaceAll("{port}", String(values.port));
}

function spawnPlanCommand(command, options) {
  if (Array.isArray(command)) return spawnPortable(command[0], command.slice(1), { cwd: options.cwd, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  if (typeof command === "object") return spawnPortable(command.command, command.args ?? [], { cwd: options.cwd, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  return spawn(command, { cwd: options.cwd, shell: true, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
}

function spawnPortable(command, args, options) {
  if (process.platform !== "win32") return spawn(command, args, options);
  return spawn("cmd.exe", ["/d", "/s", "/c", [command, ...args].map(quoteCmdArg).join(" ")], options);
}

async function waitForHttp(url, timeoutMs, label) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status < 500) return;
    } catch {
      await delay(500);
    }
  }
  throw new Error(`${label} did not become reachable at ${url}`);
}

function isPortFree(port, host) {
  return new Promise((resolvePort) => {
    const server = net.createServer();
    server.once("error", () => resolvePort(false));
    server.once("listening", () => server.close(() => resolvePort(true)));
    server.listen(port, host);
  });
}

function killTree(child) {
  if (!child?.pid || child.killed) return;
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
  else child.kill("SIGTERM");
}

function applyCaptureOverrides(plan, options) {
  const next = structuredClone(plan);
  if (options["source-root"]) next.sourceRoot = options["source-root"];
  if (options["capture-root"]) next.captureRoot = options["capture-root"];
  if (options.manifest) next.manifestPath = options.manifest;
  if (options["timeout-ms"]) next.timeoutMs = Number(options["timeout-ms"]);
  if (options["app-url"]) next.app = { ...(next.app ?? {}), url: options["app-url"] };
  return next;
}


function printCaptureHelp() {
  console.log(`NodeTrace capture

Usage:
  nodetrace capture --plan <capture-plan.json> [--dry-run]
  nodetrace-capture --plan <capture-plan.json>

Common overrides:
  --source-root <dir>        Source repo root for code-browser captures
  --capture-root <dir>       Directory for PNG outputs
  --manifest <file>          Manifest output path
  --app-url <url>            Reuse a running app instead of starting one
  --timeout-ms <ms>          Capture timeout

The plan captures real code-browser source screenshots and real running-app Playwright screenshots.
`);
}

function resolveFrom(path, base) {
  return resolve(base, path);
}

function assetPath(prefix, name) {
  return prefix ? `${String(prefix).replace(/\/$/, "")}/${name}` : name;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function isTruthy(value) {
  return value === true || value === "true" || value === "1" || value === "yes";
}

function writeJson(path, value) {
  const parent = dirname(path);
  if (parent && parent !== "." && !existsSync(parent)) mkdirSync(parent, { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function relativePath(path, from = process.cwd()) {
  return relative(from, path).replaceAll("\\", "/");
}
