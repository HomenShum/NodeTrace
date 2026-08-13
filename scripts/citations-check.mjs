/**
 * Every citation in this repository — a `.tours/` step, a `file.ts:12` in a
 * markdown document — points at a line number, and line numbers rot.
 *
 * Checking that the number is *in range* proves nothing: the file still has a
 * line 12, and the citation now describes the wrong code. So every citation
 * here carries a literal anchor as well, and this script asserts the cited line
 * CONTAINS that anchor.
 *
 *   1. `.tours/*.tour` are generated: each step is a file plus an anchor, and
 *      the line number is resolved from the anchor rather than typed.
 *   2. Markdown citations are hand-written, so they are checked instead: every
 *      `path:line` in backticks must be followed by (`anchor`), and the anchor
 *      must appear in the cited line or range.
 *
 *   npm run citations:check
 *   npm run citations:check -- --write     # regenerate .tours after a move
 *
 * A citation whose anchor no longer appears is a hard failure, not a warning: a
 * walkthrough that points at the wrong line is worse than no walkthrough.
 */

import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({ options: { write: { type: "boolean" } } });

const tours = [
  {
    file: ".tours/01-primary-user-flow.tour",
    title: "1. Ctrl-click a surface, get its proof",
    description: "The one user action this product exists for, from the browser event to the rendered panel. Run `npm run happy-path && npm run dev` first so there is state to show.",
    steps: [
      ["index.html", "<script type=\"module\" src=\"/src/main.tsx\">",
       "One page, one script. There is no router in this repository and looking for one is a dead end."],
      ["src/main.tsx", "createRoot(document.getElementById(\"root\")!)",
       "One React root, one component. Everything below hangs off `DemoDashboard`."],
      ["src/DemoDashboard.tsx", "fetch(\"./nodetrace-state.json\"",
       "Everything the panel can ever say arrives here, as one static JSON file. The browser never opens SQLite -- that is what makes the panel droppable into any app.\n\nIf the file is missing, the `.catch` below falls back to a placeholder with an empty surface list, and nothing on screen says so."],
      ["src/DemoDashboard.tsx", "className=\"showcase\" data-nodetrace-surface",
       "This attribute is the entire adoption cost. A region of interface says: I am the surface called shell.statusStrip. That string is the only thing the interface and the database have to agree on.\n\nThis particular tag is also open defect D1: after `npm run trace-coach:sqlite` the state file no longer registers `shell.statusStrip`, so Ctrl-clicking here silently does nothing."],
      ["src/trace/TraceLensProvider.tsx", "if (!(event.metaKey || event.ctrlKey)",
       "One listener on `window`, in the capture phase, gated on Ctrl or Cmd plus a plain left click. This is why adopting NodeTrace needs no changes to existing components.\n\nIt is also why the lens cannot be opened by keyboard or by touch -- open defect D4."],
      ["src/trace/TraceLensProvider.tsx", "export function resolveTraceHit",
       "The trust boundary. Above this line there is a DOM event, which could be anything; below it there is a `SurfaceHit`, which is four optional strings and nothing else. No DOM node crosses.\n\n`data-noderoom-surface` is accepted as well as `data-nodetrace-surface`, so an app already tagged for NodeRoom works unchanged."],
      ["src/trace/types.ts", "export interface SurfaceHit",
       "`SurfaceHit` -- the domain value the rest of the panel is written against. Four strings, three of them optional."],
      ["src/trace/TraceLensPanel.tsx", "const meta = state.surfaces.find",
       "The panel looks the clicked id up in the registry that came with the state file. A miss makes `meta` null, and the next line returns null: the click was swallowed and nothing appears.\n\nThat is defect D1's mechanism, in two lines."],
      ["src/trace/TraceLensPanel.tsx", "function filterByHit",
       "Narrowing, with a deliberate fallback: match on the exact element first, and if nothing matches, show everything for the surface. A click on a region with no per-element evidence still shows the region's evidence rather than an empty panel."],
      ["src/trace/TraceLensPanel.tsx", "{builderCapable && mode === \"builder\" && ownership ?",
       "Code ownership -- component, query, mutation, skill and test paths -- renders only when the host app has declared itself builder-capable."],
      ["scripts/init-sqlite.mjs", "codeOwnership: builderCapable",
       "And here is why that is more than a UI toggle: the happy path strips ownership rows out of the published JSON entirely unless `NODETRACE_BUILDER_CAPABLE=true`. The client cannot leak what it never received. This is the single security-relevant line in the browser path."],
    ],
  },
  {
    file: ".tours/02-agent-execution.tour",
    title: "2. What an agent can drive: the capture engine",
    description: "NodeTrace has no agent runtime of its own. What it has is a pair of MCP tools somebody else's coding agent can call to photograph a codebase. This tour follows one capture from tool call to PNG.",
    steps: [
      ["bin/nodetrace-mcp.mjs", "const server = new McpServer",
       "Read this first: there is no planner, no model call and no agent loop anywhere in this repository. NodeTrace is the trace surface an agent-built product adopts, not an agent.\n\nWhat it exposes instead is this stdio MCP server, so a coding assistant can run a capture without a human driving a browser."],
      ["bin/nodetrace-mcp.mjs", "\"validate_capture_plan\"",
       "Tool one: parse and resolve a plan without opening a browser. Cheap, and the only thing `npm run mcp:smoke` exercises."],
      ["bin/nodetrace-mcp.mjs", "\"capture_codebase\"",
       "Tool two: actually run the capture. Inputs are declared as zod schemas, which the MCP SDK turns into the tool's JSON schema."],
      ["src/capture/codebaseCapture.mjs", "export function normalizeCapturePlan",
       "Validation for the whole engine happens once, here. A plan is input from an agent, so every path is resolved, every default filled, and a step whose source file does not exist throws before any browser starts."],
      ["src/capture/codebaseCapture.mjs", "Unsupported editor.mode",
       "`code-browser` is the only capture mode. Modes that drove VS Code Desktop and VS Code for the Web used to live here; the Wave 3 reduction removed them because no committed plan, no test and no CI job ever ran them, and this mode already renders source with Shiki, headless, with no editor installed."],
      ["src/capture/codebaseCapture.mjs", "export async function captureCodebaseFromPlan",
       "The run itself. Playwright is imported dynamically so that merely importing this module -- which `bin/nodetrace.mjs` does on every `capture` command -- does not require a browser."],
      ["src/capture/codebaseCapture.mjs", "async function captureCodeBrowserSteps",
       "Half one: render the real file's real line range as HTML with Shiki, and screenshot it. The source in the picture is read from disk at capture time, which is the entire point -- a hand-drawn code screenshot proves nothing."],
      ["src/capture/codebaseCapture.mjs", "async function captureAppSteps",
       "Half two: drive the real running app to the right state, find the selector, measure its bounding box, and screenshot the element. A box smaller than 20x20 throws rather than saving a sliver."],
      ["src/capture/codebaseCapture.mjs", "function buildManifest",
       "The receipt. `captureKind` fields starting with `actual-` are how downstream checks tell a real capture from a placeholder; `scripts/smoke.mjs` refuses a manifest whose steps are not all `actual-`."],
      ["scripts/capture-plan-smoke.mjs", "async function checkRealCapture",
       "The check that proves all of the above still works: it serves a page over HTTP from inside the test, runs the capture CLI against it, and asserts the manifest recorded `actual-code-browser-shiki` and a real DOMRect.\n\nBefore this existed, nothing ran the engine end to end -- only its plans were parsed."],
    ],
  },
  {
    file: ".tours/03-debug-and-recovery.tour",
    title: "3. When it breaks: receipts, timeouts and the tests",
    description: "Where failures surface, what they write down, and which check catches which class of bug.",
    steps: [
      ["src/DemoDashboard.tsx", ".catch(() => setState(seedState))",
       "Failure one, and the weakest: a missing or unparseable state file silently becomes the placeholder. The page renders, the lens opens nothing, and no message is shown. Fixing this is the cheapest user-visible improvement available."],
      ["src/trace/TraceLensProvider.tsx", "if (event.key === \"Escape\") setOpen(false);",
       "The only keyboard affordance in the product. Escape closes the panel; nothing opens it."],
      ["scripts/init-sqlite.mjs", "Missing dependency: run `npm install`",
       "Failure two, and the friendliest: `better-sqlite3` is a native module that has to compile. When it has not, this prints one instruction instead of a stack trace."],
      ["bin/nodetrace.mjs", "function runCommand",
       "The riskiest thing this project does is modify somebody else's repository. Every phase of `nodetrace add` runs through here: timed, timeout-bounded, appended to `.nodetrace/setup-log.txt`, and reduced to `{ ok, durationMs, detail }`."],
      ["bin/nodetrace.mjs", "if (phases.every((phase) => phase.ok) && shouldVerify)",
       "The chain stops at the first failed phase instead of continuing to change the target. A broken install never reaches the build."],
      ["bin/nodetrace.mjs", "writeJson(join(targetDir, \".nodetrace\", \"setup-receipt.json\"), receipt);",
       "The receipt is written whether or not the phases passed, so a failed install is inspectable rather than silent."],
      ["bin/nodetrace.mjs", "Refusing to overwrite",
       "Re-running `add` cannot quietly clobber a copy somebody customised. `--force` is the explicit opt-in."],
      ["bin/nodetrace.mjs", "function withOwnRanges",
       "This function exists because of defect D2. The installer used to keep its own hand-written list of dependency version ranges next to the real one in `package.json`; the two drifted, and every installed app failed to build while this repository stayed green. Now a missing range throws at install time."],
      ["scripts/cli-smoke.mjs", "function validateInstalledImports",
       "The regression check for the other half of D2: walk every file the installer copied and assert each relative import resolves inside the target. It is a property check, not a check for one file, so the next component added with an outside-the-copy import fails here instead of in a user's build."],
      ["scripts/smoke.mjs", "if (!readme.includes(required)) issues.push",
       "Now the uncomfortable part. Roughly 170 of this file's 212 lines are assertions that documentation and source contain particular literal strings.\n\nRenaming a function or rewording a README sentence turns `npm run smoke` red. It is the single largest obstacle to changing anything here, and it is why the Wave 3 reduction deleted only things this file does not name. See docs/codebase/CONCERNS.md."],
      ["scripts/installer-next-e2e-smoke.mjs", "next build",
       "The end-to-end proof: install NodeTrace into a throwaway Next.js app and run the real `next build`. Roughly four minutes, and the only check that would have caught D2 before a user did."],
    ],
  },
];

const issues = [];
mkdirSync(".tours", { recursive: true });

for (const tour of tours) {
  const steps = [];
  for (const [file, anchor, description] of tour.steps) {
    const lines = readFileSync(file, "utf8").split(/\r?\n/);
    const line = lines.findIndex((text) => text.includes(anchor)) + 1;
    if (line === 0) {
      issues.push(`${tour.file}: anchor no longer in ${file}: ${anchor}`);
      continue;
    }
    steps.push({ file, line, description });
  }
  const expected = `${JSON.stringify({
    $schema: "https://aka.ms/codetour-schema",
    title: tour.title,
    description: tour.description,
    ref: "main",
    steps,
  }, null, 2)}\n`;
  if (values.write) {
    writeFileSync(tour.file, expected);
    console.log(`wrote ${tour.file} (${steps.length} steps)`);
    continue;
  }
  const actual = readFileSync(tour.file, "utf8").replace(/\r\n/g, "\n");
  if (actual !== expected) issues.push(`${tour.file} is out of date; re-run with --write`);
}

// A markdown citation: `path:line` or `path:from-to`, then the anchor that the
// cited line must contain, e.g. `src/main.tsx:6` (`createRoot(`).
const citation = /`([\w./-]+\.[a-z]+):(\d+)(?:-(\d+))?`(?:\s*\(`([^`]+)`\))?/g;
let citationCount = 0;

for (const doc of markdownFiles(".")) {
  const body = readFileSync(doc, "utf8");
  // "the useEffect at line 33" is unguardable: nothing names the file, so
  // nothing can be resolved. The form has to stay out of the documents.
  for (const [prose] of body.matchAll(/\blines? ~?\d+/gi)) {
    issues.push(`${doc}: "${prose}" — write citations as \`path:line\` (\`anchor\`) so the anchor can be checked`);
  }
  // `panel.tsx:73,91,99` is a citation the checker below cannot parse, so it
  // would pass unchecked. One citation per line, or a from-to range.
  for (const [loose] of body.matchAll(/`[\w./-]+\.[a-z]+:\d[^`]*`/g)) {
    if (!new RegExp(`^${citation.source}$`).test(loose)) issues.push(`${doc}: ${loose} — one citation per line, \`path:line\` or \`path:from-to\``);
  }
  for (const [text, file, from, to, rawAnchor] of body.matchAll(citation)) {
    citationCount += 1;
    const where = `${doc}: ${text}`;
    if (!existsSync(file)) {
      issues.push(`${where} cites a file that does not exist`);
      continue;
    }
    if (!rawAnchor) {
      issues.push(`${where} carries no anchor; write \`${file}:${from}\` (\`some text on that line\`)`);
      continue;
    }
    // Markdown tables escape pipes; the source line has the bare character.
    const anchor = rawAnchor.replaceAll("\\|", "|");
    const lines = readFileSync(file, "utf8").split(/\r?\n/).slice(Number(from) - 1, Number(to ?? from));
    if (!lines.some((line) => line.includes(anchor))) {
      issues.push(`${where} does not contain ${anchor} — the line moved, or the symbol did`);
    }
  }
}

function markdownFiles(dir) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    const path = join(dir, entry.name).replaceAll("\\", "/");
    if (entry.isDirectory()) found.push(...markdownFiles(path));
    else if (entry.name.endsWith(".md")) found.push(path);
  }
  return found;
}

if (issues.length > 0) {
  console.error("nodetrace citations check: FAIL");
  for (const issue of issues) console.error(`  - ${issue}`);
  process.exitCode = 1;
} else if (!values.write) {
  const steps = tours.reduce((n, tour) => n + tour.steps.length, 0);
  console.log(`nodetrace citations check: PASS ${tours.length} tours, ${steps} steps, ${citationCount} markdown citations`);
}
