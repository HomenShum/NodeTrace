/**
 * Condition 8 — web-quality audit (accessibility, performance, Core Web Vitals).
 *
 * Run from the repo root:  npm run promotion:web-quality
 *
 * The human situation. Somebody who has never seen this project opens the demo
 * page and tries to read it. If the grey-on-white numbers in the hero are too
 * faint for them, or the page freezes for a second and a half while the graph
 * lays itself out, they do not file a bug — they close the tab. Neither of those
 * shows up in a test suite, because the tests never look at a rendered pixel or
 * a main-thread stall. Two standard tools do look: Lighthouse measures load and
 * responsiveness (its Core Web Vitals are LCP, CLS and TBT), and axe-core checks
 * the page against the WCAG rules that can be checked mechanically. This script
 * runs both against the real built page and keeps their output.
 *
 * Baseline said condition 8 was UNVERIFIED because "installing an audit
 * toolchain was out of scope". Both toolchains are pinned here and installed on
 * demand by npx, so the excuse does not survive a second clone.
 *
 * WHAT IS AUDITED, and why not the dev server. `vite preview` over `dist/`, not
 * `npm run dev`. A dev server ships unminified modules over HMR; its timings
 * describe vite, not this product. The built bundle is what a stranger meets.
 *
 * BOTH SEEDED STATES, because they are different pages. The happy path renders
 * the hero and the graph rail; `npm run trace-coach:sqlite` additionally mounts
 * the six-step Trace Coach, which is the entire J3 screen and carries markup
 * (role="tab", the 10.5px record meta) the happy path never renders. Auditing
 * one and reporting it as "the app" would miss half the surface.
 *
 * REQUIREMENT: a Chrome/Chromium on this machine. Lighthouse launches it and
 * @axe-core/cli drives it through chromedriver. Both fail loudly without one;
 * this script does not silently downgrade to "no findings".
 *
 * Writes, all under promotion/evidence/:
 *   lighthouse-happy-path.json   lighthouse-trace-coach.json
 *   axe-happy-path.json          axe-trace-coach.json
 *   web-quality-audit.json       <- the summary, with the exact commands
 */

import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { PORT_ENV, assertPortFree, killTree, startPreview, waitForServer } from "../../scripts/lib/proof-server.mjs";

const PORT = Number(process.env[PORT_ENV] ?? 4910);
const PAGE_URL = `http://127.0.0.1:${PORT}/`;
const EVIDENCE = join("promotion", "evidence");
const REPORT = join(EVIDENCE, "web-quality-audit.json");
const LIGHTHOUSE = "lighthouse@13.4.1";
const AXE = "@axe-core/cli@4.13.0";

// A finding is "major" when a real reader is blocked or measurably slowed. The
// thresholds are the tools' own, not ours: axe impact serious/critical is the
// half of its scale that names blocked content, and Lighthouse's TBT scoring
// curve puts 600ms at the boundary of its "poor" band.
const AXE_MAJOR_IMPACTS = new Set(["serious", "critical"]);
const TBT_MAJOR_MS = 600;

const states = [
  { id: "happy-path", seed: ["run", "happy-path"], note: "README Happy Path: hero + Live graph rail, no Trace Coach" },
  { id: "trace-coach", seed: ["run", "trace-coach:sqlite"], note: "J3 screen: six-step Trace Coach mounted above the rail" },
];

mkdirSync(EVIDENCE, { recursive: true });
await assertPortFree(PORT);

const results = [];
let preview = null;
try {
  for (const state of states) {
    run("npm", state.seed);
    run("npm", ["run", "build"]);

    preview = startPreview(PORT);
    await waitForServer(PAGE_URL);
    await assertServedTreeIsThis();

    const lighthousePath = join(EVIDENCE, `lighthouse-${state.id}.json`);
    const axePath = join(EVIDENCE, `axe-${state.id}.json`);
    const lighthouseArgv = ["--yes", LIGHTHOUSE, PAGE_URL, "--output=json", `--output-path=${lighthousePath}`, '--chrome-flags=--headless', "--quiet"];
    const axeArgv = ["--yes", AXE, PAGE_URL, "--save", axePath];

    run("npx", lighthouseArgv);
    run("npx", axeArgv);

    killTree(preview);
    preview = null;

    results.push({
      state: state.id,
      note: state.note,
      url: PAGE_URL,
      commands: [`npx ${lighthouseArgv.slice(1).join(" ")}`, `npx ${axeArgv.slice(1).join(" ")}`],
      lighthouse: readLighthouse(lighthousePath),
      axe: readAxe(axePath),
      artifacts: [lighthousePath, axePath].map(posix),
    });
  }
} finally {
  killTree(preview);
  // Leave the tree in the state a fresh clone expects, whatever happened above.
  run("npm", ["run", "happy-path"], { allowFailure: true });
}

const major = results.flatMap((result) => [
  ...result.axe.violations
    .filter((violation) => AXE_MAJOR_IMPACTS.has(violation.impact))
    .map((violation) => `${result.state}: axe ${violation.id} (${violation.impact}, ${violation.nodes} nodes) — ${violation.help}`),
  ...(result.lighthouse.totalBlockingTimeMs > TBT_MAJOR_MS
    ? [`${result.state}: Total Blocking Time ${Math.round(result.lighthouse.totalBlockingTimeMs)}ms exceeds ${TBT_MAJOR_MS}ms — the main thread is unresponsive to input for that long after load`]
    : []),
]);

const report = {
  ok: major.length === 0,
  condition: 8,
  generatedAt: new Date().toISOString(),
  servedFrom: "vite preview over dist/ (the built bundle, not the dev server)",
  tools: { lighthouse: LIGHTHOUSE, axe: AXE },
  major,
  results,
};
writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`);

for (const result of results) {
  const { categories, largestContentfulPaintMs, cumulativeLayoutShift, totalBlockingTimeMs } = result.lighthouse;
  console.log(
    `${result.state}: lighthouse perf ${categories.performance} a11y ${categories.accessibility} ` +
      `best-practices ${categories["best-practices"]} | LCP ${Math.round(largestContentfulPaintMs)}ms ` +
      `CLS ${cumulativeLayoutShift.toFixed(3)} TBT ${Math.round(totalBlockingTimeMs)}ms | ` +
      `axe ${result.axe.violations.length} violations (${result.axe.violationNodes} nodes)`,
  );
}
for (const finding of major) console.log(`major: ${finding}`);
console.log(`web quality audit: ${report.ok ? "PASS" : "FAIL"} (${major.length} major) -> ${posix(REPORT)}`);
process.exit(report.ok ? 0 : 1);

// ---------------------------------------------------------------------------

/**
 * The audited page must be served by THIS working tree — the same guard the
 * capture scripts carry, for the same reason: another checkout of the same
 * product answers with the same title and the same testids, and an audit of
 * somebody else's tree is worse than no audit.
 */
async function assertServedTreeIsThis() {
  const served = await fetch(new URL("nodetrace-state.json", PAGE_URL)).then((response) => response.text());
  const onDisk = readFileSync(join("public", "nodetrace-state.json"), "utf8");
  if (served.trim() !== onDisk.trim()) {
    throw new Error(
      `the page on ${PAGE_URL} served a different public/nodetrace-state.json than this checkout has on disk — ` +
        `another process is answering on port ${PORT}, or dist/ is stale`,
    );
  }
}

function run(command, args, { allowFailure = false } = {}) {
  const cmd = process.platform === "win32" ? `${command}.cmd` : command;
  const result = spawnSync(cmd, args, { stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0 && !allowFailure) {
    throw new Error(`${command} ${args.join(" ")} exited ${result.status}`);
  }
  return result.status;
}

function readLighthouse(path) {
  const report = JSON.parse(readFileSync(path, "utf8"));
  const audit = (id) => report.audits[id]?.numericValue ?? null;
  return {
    lighthouseVersion: report.lighthouseVersion,
    categories: Object.fromEntries(Object.entries(report.categories).map(([id, category]) => [id, category.score])),
    largestContentfulPaintMs: audit("largest-contentful-paint"),
    cumulativeLayoutShift: audit("cumulative-layout-shift"),
    totalBlockingTimeMs: audit("total-blocking-time"),
    firstContentfulPaintMs: audit("first-contentful-paint"),
    failedAudits: Object.entries(report.audits)
      .filter(([, x]) => x.score !== null && x.score < 0.9 && x.scoreDisplayMode !== "informative")
      .map(([id, x]) => ({ id, score: x.score, title: x.title })),
  };
}

function readAxe(path) {
  const saved = JSON.parse(readFileSync(path, "utf8"));
  const page = Array.isArray(saved) ? saved[0] : saved;
  return {
    axeVersion: page.testEngine?.version ?? null,
    passes: page.passes.length,
    incomplete: page.incomplete.map((x) => ({ id: x.id, impact: x.impact, nodes: x.nodes.length })),
    violationNodes: page.violations.reduce((total, x) => total + x.nodes.length, 0),
    violations: page.violations.map((x) => ({
      id: x.id,
      impact: x.impact,
      help: x.help,
      nodes: x.nodes.length,
      targets: x.nodes.map((node) => node.target.join(" ")),
    })),
  };
}

function posix(path) {
  return path.split("\\").join("/");
}
