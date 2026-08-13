import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { parseArgs } from "node:util";

const TRACE_FILES = [
  {
    id: "artifact",
    label: "Artifact shell",
    kind: "component",
    filePath: "src/ui/panels/Artifact.tsx",
    layer: "UI entry",
    x: 112,
    y: 250,
    summary: "Entry point that imports and renders the TraceSurface tab.",
  },
  {
    id: "surface",
    label: "TraceSurface",
    kind: "component",
    filePath: "src/ui/panels/TraceSurface.tsx",
    layer: "Trace UI",
    x: 332,
    y: 176,
    summary: "Master-detail trace tab with records, tabs, and selected trace detail.",
  },
  {
    id: "data",
    label: "traceData",
    kind: "schema",
    filePath: "src/ui/panels/traceData.ts",
    layer: "Data model",
    x: 332,
    y: 382,
    summary: "TraceRecord, TraceStep, attachment, and bundled QA trace structures.",
  },
  {
    id: "steps",
    label: "TraceStepRow",
    kind: "component",
    filePath: "src/ui/panels/TraceStepRow.tsx",
    layer: "Evidence UI",
    x: 560,
    y: 286,
    summary: "Shared renderer for linear steps and graph-node detail previews.",
  },
  {
    id: "flow",
    label: "TraceFlow",
    kind: "component",
    filePath: "src/ui/panels/TraceFlow.tsx",
    layer: "Graph UI",
    x: 784,
    y: 190,
    summary: "React Flow graph with controls, minimap, and shared step detail.",
  },
  {
    id: "style",
    label: "Trace CSS",
    kind: "runtime",
    filePath: "src/app/styles.css",
    layer: "Visual system",
    x: 790,
    y: 406,
    summary: "Dark trace surface, tabs, cards, screenshot boxes, filmstrip, and flow styling.",
  },
];
const UNDERSTAND_ANYTHING_REPO = "https://github.com/Egonex-AI/Understand-Anything.git";

const { values: options } = parseArgs({
  options: {
    "source-root": { type: "string" },
    work: { type: "string" },
    "graph-out": { type: "string" },
    "json-out": { type: "string" },
    "plugin-root": { type: "string" },
    "bootstrap-root": { type: "string" },
  },
});
const startedAt = new Date();
const startedMs = performance.now();
const sourceRoot = resolve(options["source-root"] ?? process.env.NODETRACE_SOURCE_ROOT ?? "..");
const workRoot = resolve(options.work ?? ".nodetrace/understand-anything-noderoom");
const graphPath = resolve(options["graph-out"] ?? "public/captures/noderoom-trace-knowledge-graph.json");
const reportPath = resolve(options["json-out"] ?? "docs/eval/nodetrace-understand-anything-noderoom.json");
const pluginRoot = resolvePluginRoot(options["plugin-root"] ?? process.env.UNDERSTAND_ANYTHING_PLUGIN_ROOT);
const skillRoot = join(pluginRoot, "skills", "understand");

mkdirSync(workRoot, { recursive: true });
mkdirSync(dirname(graphPath), { recursive: true });
mkdirSync(dirname(reportPath), { recursive: true });

preparePlugin(pluginRoot);

const scanPath = join(workRoot, "scan-script.json");
const importInputPath = join(workRoot, "import-input.json");
const importMapPath = join(workRoot, "import-map.json");
const structureInputPath = join(workRoot, "structure-input.json");
const structurePath = join(workRoot, "structure.json");

runNode(join(skillRoot, "scan-project.mjs"), [sourceRoot, scanPath]);
const scan = readJson(scanPath);
const selectedFiles = selectTraceFiles(scan.files ?? []);
writeJson(importInputPath, {
  projectRoot: sourceRoot,
  files: selectedFiles,
});
runNode(join(skillRoot, "extract-import-map.mjs"), [importInputPath, importMapPath]);
const importMap = readJson(importMapPath);
writeJson(structureInputPath, {
  projectRoot: sourceRoot,
  batchFiles: selectedFiles,
  batchImportData: importMap.importMap ?? {},
});
runNode(join(skillRoot, "extract-structure.mjs"), [structureInputPath, structurePath]);
const structure = readJson(structurePath);

const graph = buildGraph({
  scan,
  importMap,
  pluginRoot,
  selectedFiles,
  sourceRoot,
  structure,
});
writeJson(graphPath, graph);

const report = {
  ok: true,
  startedAt: startedAt.toISOString(),
  completedAt: new Date().toISOString(),
  durationMs: Math.round(performance.now() - startedMs),
  apiKeysRequired: false,
  sourceRoot: relativePath(sourceRoot),
  pluginRoot: relativePath(pluginRoot),
  graphPath: relativePath(graphPath),
  reportPath: relativePath(reportPath),
  scan: {
    totalFiles: scan.totalFiles ?? selectedFiles.length,
    filteredByIgnore: scan.filteredByIgnore ?? 0,
    estimatedComplexity: scan.estimatedComplexity ?? "unknown",
  },
  importMap: importMap.stats ?? {},
  structure: {
    filesAnalyzed: structure.filesAnalyzed ?? 0,
    filesSkipped: structure.filesSkipped ?? [],
  },
  selectedFiles: selectedFiles.map((file) => file.path),
};
writeJson(reportPath, report);

console.log(`understand-anything noderoom: PASS ${selectedFiles.length} trace files`);
console.log(`wrote ${relativePath(graphPath)}`);
console.log(`wrote ${relativePath(reportPath)}`);

function resolvePluginRoot(explicitRoot) {
  const candidates = [
    explicitRoot,
    join(homedir(), ".understand-anything", "repo", "understand-anything-plugin"),
    resolve(".tmp", "Understand-Anything", "understand-anything-plugin"),
  ].filter(Boolean);
  const seen = new Set();
  for (const candidate of candidates) {
    const root = resolve(candidate);
    if (seen.has(root)) continue;
    seen.add(root);
    if (existsSync(join(root, "skills", "understand", "scan-project.mjs"))) return root;
  }
  const bootstrapRoot = resolve(options["bootstrap-root"] ?? ".nodetrace/understand-anything");
  const repoRoot = join(bootstrapRoot, "repo");
  const bootstrappedPluginRoot = join(repoRoot, "understand-anything-plugin");
  if (!existsSync(join(bootstrappedPluginRoot, "skills", "understand", "scan-project.mjs"))) {
    if (existsSync(repoRoot)) {
      throw new Error(
        [
          `Found ${repoRoot}, but it does not contain an Understand-Anything plugin checkout.`,
          "Pass --plugin-root /path/to/understand-anything-plugin or remove that local cache manually.",
        ].join("\n"),
      );
    }
    mkdirSync(bootstrapRoot, { recursive: true });
    runCommand("git", ["clone", "--depth", "1", UNDERSTAND_ANYTHING_REPO, repoRoot], process.cwd());
  }
  if (existsSync(join(bootstrappedPluginRoot, "skills", "understand", "scan-project.mjs"))) {
    return bootstrappedPluginRoot;
  }
  throw new Error(
    [
      "Understand-Anything plugin root not found.",
      `Automatic clone from ${UNDERSTAND_ANYTHING_REPO} did not produce the expected plugin folder.`,
      "Or pass --plugin-root /path/to/understand-anything-plugin.",
    ].join("\n"),
  );
}

function preparePlugin(root) {
  const hasModules = existsSync(join(root, "node_modules"));
  const hasCoreBuild = existsSync(join(root, "packages", "core", "dist", "index.js"));
  if (!hasModules) runCommand("pnpm", ["install", "--frozen-lockfile"], root);
  if (!hasCoreBuild) runCommand("pnpm", ["--filter", "@understand-anything/core", "build"], root);
}

function runNode(scriptPath, args) {
  if (!existsSync(scriptPath)) throw new Error(`missing Understand-Anything script ${scriptPath}`);
  runCommand(process.execPath, [scriptPath, ...args], process.cwd());
}

function runCommand(command, args, cwd) {
  const useShell = process.platform === "win32" && command === "pnpm";
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    shell: useShell,
    windowsHide: true,
  });
  if (result.error) {
    throw new Error(`${command} ${args.join(" ")} could not start\n${result.error.message}`);
  }
  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(`${command} ${args.join(" ")} failed\n${output.slice(-2400)}`);
  }
}

function selectTraceFiles(files) {
  const byPath = new Map(files.map((file) => [normalizePath(file.path), file]));
  return TRACE_FILES.map((target) => {
    const matched = byPath.get(target.filePath);
    if (matched) return matched;
    const livePath = resolve(sourceRoot, target.filePath);
    if (!existsSync(livePath)) throw new Error(`NodeRoom trace file missing: ${livePath}`);
    return {
      path: target.filePath,
      language: target.filePath.endsWith(".css") ? "css" : "typescript",
      sizeLines: readFileSync(livePath, "utf8").split(/\r?\n/).length,
      fileCategory: target.filePath.endsWith(".css") ? "style" : "code",
    };
  });
}

function buildGraph({ scan, importMap, pluginRoot, selectedFiles, sourceRoot, structure }) {
  const selectedPathSet = new Set(TRACE_FILES.map((file) => file.filePath));
  const resultByPath = new Map((structure.results ?? []).map((result) => [normalizePath(result.path), result]));
  const nodeByPath = new Map(TRACE_FILES.map((node) => [node.filePath, node]));
  const nodes = TRACE_FILES.map((node) => {
    const analysis = resultByPath.get(node.filePath);
    return {
      id: node.id,
      label: node.label,
      kind: node.kind,
      filePath: node.filePath,
      layer: node.layer,
      x: node.x,
      y: node.y,
      summary: node.summary,
      understandAnything: {
        language: analysis?.language ?? selectedFiles.find((file) => file.path === node.filePath)?.language ?? "unknown",
        fileCategory: analysis?.fileCategory ?? selectedFiles.find((file) => file.path === node.filePath)?.fileCategory ?? "unknown",
        totalLines: analysis?.totalLines ?? selectedFiles.find((file) => file.path === node.filePath)?.sizeLines ?? null,
        metrics: analysis?.metrics ?? {},
        exports: (analysis?.exports ?? []).slice(0, 12),
        functions: (analysis?.functions ?? []).slice(0, 12),
        classes: (analysis?.classes ?? []).slice(0, 12),
      },
    };
  });

  const importEdges = [];
  for (const [fromPath, targets] of Object.entries(importMap.importMap ?? {})) {
    const from = nodeByPath.get(normalizePath(fromPath));
    if (!from) continue;
    for (const targetPath of targets ?? []) {
      const to = nodeByPath.get(normalizePath(targetPath));
      if (!to || !selectedPathSet.has(to.filePath)) continue;
      importEdges.push({
        id: `ua-import-${from.id}-${to.id}`,
        from: from.id,
        to: to.id,
        label: "imports",
        source: "understand-anything import-map",
      });
    }
  }

  const guidedEdges = [
    { from: "surface", to: "style", label: "uses trace CSS", source: "trace coach guided-tour" },
    { from: "steps", to: "style", label: "uses screenshot box styles", source: "trace coach guided-tour" },
    { from: "flow", to: "style", label: "uses flowgraph styles", source: "trace coach guided-tour" },
  ];
  const edgeMap = new Map();
  for (const edge of [...importEdges, ...guidedEdges]) {
    if (!edgeMap.has(edge.id)) edgeMap.set(edge.id, edge);
  }

  return {
    generator: "Understand-Anything deterministic scripts via NodeTrace",
    sourceRepo: "HomenShum/noderoom",
    sourceRoot: relativePath(sourceRoot),
    generatedAt: new Date().toISOString(),
    pluginRoot: relativePath(pluginRoot),
    model: "Understand-Anything-backed codebase minimap",
    note: "Generated from scan-project.mjs, extract-import-map.mjs, and extract-structure.mjs over NodeRoom trace UI files.",
    scan: {
      totalFiles: scan.totalFiles ?? selectedFiles.length,
      filteredByIgnore: scan.filteredByIgnore ?? 0,
      estimatedComplexity: scan.estimatedComplexity ?? "unknown",
      stats: scan.stats ?? {},
    },
    importMap: {
      stats: importMap.stats ?? {},
      selectedEdges: importEdges.length,
    },
    structure: {
      filesAnalyzed: structure.filesAnalyzed ?? 0,
      filesSkipped: structure.filesSkipped ?? [],
    },
    nodes,
    edges: [...edgeMap.values()],
    layers: buildLayers(nodes),
    guidedTour: TRACE_FILES.map((file, index) => ({
      id: `coach-step-${String(index + 1).padStart(2, "0")}`,
      label: `Step ${String(index + 1).padStart(2, "0")}`,
      nodeId: file.id,
      filePath: file.filePath,
      summary: file.summary,
    })),
  };
}

function buildLayers(nodes) {
  const byLayer = new Map();
  for (const node of nodes) {
    const entry = byLayer.get(node.layer) ?? { id: slug(node.layer), label: node.layer, files: [] };
    entry.files.push(node.filePath);
    byLayer.set(node.layer, entry);
  }
  return [...byLayer.values()];
}


function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  const parent = dirname(path);
  if (parent && parent !== "." && !existsSync(parent)) mkdirSync(parent, { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function normalizePath(path) {
  return String(path).replaceAll("\\", "/");
}

function relativePath(path) {
  return normalizePath(relative(process.cwd(), path)) || basename(path);
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
