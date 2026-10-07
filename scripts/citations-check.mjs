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
    title: "1. Inspect a surface, get its trace",
    description: "Follow the repaired demo candidate from local data to a keyboard- and touch-reachable Trace Lens. Run npm run happy-path and npm run dev first. Final UI acceptance remains pending.",
    steps: [
      ["index.html", "<script type=\"module\" src=\"/src/main.tsx\">",
       "One page and one React entrypoint. The demo synchronizes its detail selection with URL parameters; installed hosts retain their own routing."],
      ["src/main.tsx", "createRoot(document.getElementById(\"root\")!)",
       "One React root mounts DemoDashboard. The browser reads a prepared local dataset; it does not open SQLite or start an agent."],
      ["src/demoState.ts", "export async function loadDemoState",
       "The demo fetches public JSON with an AbortSignal, checks HTTP status, limits the body to 1 MiB and validates required render fields with Zod. DemoContent supplies a ten-second timeout and visible retry."],
      ["src/DemoDashboard.tsx", "function InspectTraceButton",
       "A normal Inspect trace button calls the existing useTraceLens().openHit API. Keyboard and touch users have a visible entrypoint; hosts can add their own controls with the same API. Historical D4 is repaired in this candidate, pending final judge."],
      ["src/trace/TraceLensProvider.tsx", "if (!(event.metaKey || event.ctrlKey)",
       "The existing Ctrl/Cmd-click shortcut still resolves a tagged region through one window listener. It complements normal controls; it is not the only entrypoint. Ordinary clicks on host content pass through."],
      ["src/trace/TraceLensProvider.tsx", "export function resolveTraceHit",
       "The DOM event becomes a SurfaceHit: one required surface id and three optional reference strings. No DOM node crosses. Both data-nodetrace-surface and data-noderoom-surface are supported. This identifies a selection; it does not grant authority."],
      ["src/trace/types.ts", "export interface SurfaceHit",
       "SurfaceHit is the value hosts pass to openHit: surfaceId plus optional artifactId, elementId and targetRef."],
      ["src/trace/TraceLensPanel.tsx", "const meta = state.surfaces.find",
       "An unregistered selection now opens Surface unavailable with missing-data guidance. It does not fabricate a registry entry or proof. Historical D1 is repaired in this candidate, pending final judge."],
      ["src/trace/TraceLensPanel.tsx", "dialog.showModal()",
       "The native dialog makes the page behind it inert. The panel focuses Close, wraps Tab between its controls, and restores the opener on dismissal. Escape, Close and a pointer gesture that starts and ends on the backdrop dismiss it."],
      ["src/trace/TraceLensPanel.tsx", "function filterByHit",
       "Exact element/artifact matches take priority; absent matches fall back to the surrounding surface. The panel says this does not verify the exact element. Proof and runtime windows remain bounded to six rows each."],
      ["src/demoNavigation.ts", "export function useDemoNavigation",
       "Only the demo owns step, tab and lens URL parameters. Reload and history restore selection after state is ready; invalid steps normalize against the loaded dataset. No URL parameter grants builder access."],
      ["src/trace/TraceLensPanel.tsx", "{builderCapable && mode === \"builder\" && ownership ?",
       "The portable panel renders ownership only with builder capability, Builder mode and a matching ownership row. Hosts must derive capability from server-verified identity and serve a safe projection."],
      ["src/demoState.ts", "return { ...parsed.data, builderCapable: false, codeOwnership: [] }",
       "Public JSON is data, not builder authority. The demo discards privileged flags and ownership and always mounts its provider in Review mode. A producer-side environment flag is not authentication."],
      ["scripts/init-sqlite.mjs", "codeOwnership: builderCapable",
       "The seed producer normally omits ownership. Its NODETRACE_BUILDER_CAPABLE option can export internal rows, so operators must not publish a privileged export as a public file. Installed hosts own their privileged server route."],
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
      ["src/DemoDashboard.tsx", "setLoadStatus(\"error\")",
       "Missing, malformed, oversized, invalid or timed-out state produces an alert and Retry loading trace. Retry starts a new abortable request; cleanup prevents a stale request from replacing the current state. Inspect controls stay disabled until data is ready."],
      ["src/trace/TraceLensPanel.tsx", "Source opening is unavailable in this host.",
       "A proof with a URL gets a link. Otherwise a host-supplied onOpenSource callback gets a button. With neither, the panel states that opening is unavailable instead of offering an inert action. Native dialog dismissal returns focus to the opener or a connected fallback."],
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
