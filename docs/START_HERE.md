# START HERE

You have never seen this repository and nobody who built it is available. This
page walks one real user action all the way through the code, **in the order the
code actually runs**, not in the order an architect would draw it.

## The human situation, before any jargon

A reviewer is looking at a screen in some product — a number, a status badge, a
generated summary. They ask the question that no screenshot can answer: *where
did that come from, and can I check it?* Normally somebody has to go read the
code and reply in Slack.

NodeTrace is the thing you drop into that product so the screen can answer for
itself. A developer marks a region of their interface with one HTML attribute.
After that, holding **Ctrl** (or **Cmd** on a Mac) and clicking that region opens
a side panel that says: here is the business claim this region is making, here
is the evidence behind it, here are the runtime steps that produced it, and — if
you are on the team — here is which component, query and test own it.

Two words you will meet everywhere below:

- a **surface** is a named region of a user interface (`workSurface.traceStrip`,
  `shell.statusStrip`). It is just a string. Both the interface and the database
  agree to use the same string, and that agreement is the whole trick.
- the **Trace Lens** is that side panel.

This repository ships three things around that idea: the panel itself, a command
that transplants the panel into an app you already have, and a capture tool that
photographs real source files and the real running app so a walkthrough can show
code and screen side by side.

## Run it first

```bash
npm install
npm run happy-path     # creates the SQLite file and public/nodetrace-state.json
npm run dev            # http://127.0.0.1:5173/
```

Then Ctrl-click the big header on the page. That is the action this document
follows. `npm run check` runs the whole verification chain (about six minutes,
because it installs NodeTrace into a throwaway Next.js app and builds it).

---

## Step 1 — The page loads and mounts one React component

**File:** `src/main.tsx`
**Symbol:** the top-level `createRoot(...).render(...)` call
**Called by:** the browser, via `<script type="module" src="/src/main.tsx">` in `index.html:11`
**Calls next:** `DemoDashboard`

**Why this exists**
There is exactly one route and one page. NodeTrace is a component library with a
demo attached, not an application with a router, so nothing here dispatches on a
URL. If you were looking for a routing layer: there isn't one, and that is
deliberate.

**Core code**
```tsx
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <DemoDashboard />
  </React.StrictMode>,
);
```

**Input** — the empty `<div id="root">` from `index.html:10`.
**Output** — a mounted React tree.
**Failure behavior** — if `#root` is missing the non-null assertion throws and
the page is blank. Nothing catches it; there is no error boundary.
**Next** — continue to `DemoDashboard` in Step 2.

---

## Step 2 — The dashboard fetches the state file that everything else reads

**File:** `src/DemoDashboard.tsx`
**Symbol:** `DemoDashboard`, the `useEffect` at line 33
**Called by:** `src/main.tsx`
**Calls next:** `TraceLensProvider`, `LiveGraphRail`, `TraceLensPanel`

**Why this exists**
Everything the panel can say about a surface arrives as one static JSON file,
`public/nodetrace-state.json`, written earlier by the happy path (Step 6). The
browser never talks to SQLite. That is what makes the panel droppable into any
app: it needs a fetch, not a database driver.

**Core code**
```tsx
useEffect(() => {
  fetch("./nodetrace-state.json", { cache: "no-store" })
    .then((response) => (response.ok ? response.json() : seedState))
    .then((nextState: NodeTraceState) => setState(nextState))
    .catch(() => setState(seedState));
}, []);
```

**Input** — none; it runs once on mount.
**Output** — `state`, a `NodeTraceState` holding the surface registry, proof
cards, runtime trace rows and code-ownership rows.
**Failure behavior** — a missing or unparseable file falls back to `seedState`,
which is a placeholder with an empty surface list. The page still renders; the
lens then has nothing to show and stays shut. There is no visible error message,
which is a real weakness — see `docs/codebase/CONCERNS.md`.
**Next** — the tagged regions this component renders are the click targets for
Step 3. The one you will click is the header at line 52,
`data-nodetrace-surface="shell.statusStrip"`.

---

## Step 3 — Ctrl-click anywhere on the page is caught once, at the window

**File:** `src/trace/TraceLensProvider.tsx`
**Symbol:** the `onClick` listener inside `TraceLensProvider`, line 57
**Called by:** the browser, on every click, in the capture phase
**Calls next:** `resolveTraceHit`

**Why this exists**
Every tagged region could have had its own click handler. Instead there is one
listener on `window`, registered with `capture: true` so it runs before the host
application's own handlers. That is why adopting NodeTrace requires no changes to
existing components — only an attribute.

**Core code**
```tsx
const onClick = (event: MouseEvent) => {
  if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey || event.button !== 0) return;
  const resolved = resolveTraceHit(event.target);
  if (!resolved) return;
  event.preventDefault();
  event.stopPropagation();
  openHit(resolved);
};
window.addEventListener("click", onClick, true);
```

**Input** — a raw DOM `MouseEvent`.
**Output** — nothing, unless the modifier keys match and the click landed inside
a tagged region.
**Failure behavior** — an ordinary click, a right-click, or Ctrl+Shift+click all
return early and reach the application untouched. This gate is also the reason
the lens cannot be opened by keyboard or by touch, which is open defect **D4** in
`promotion/PROMOTION_LOG.md`.
**Next** — continue to `resolveTraceHit` in Step 4.

---

## Step 4 — The click becomes a typed domain value

**File:** `src/trace/TraceLensProvider.tsx`
**Symbol:** `resolveTraceHit`, line 15
**Called by:** the window click listener in Step 3
**Calls next:** `openHit`, which stores the result in React state

**Why this exists**
This is the trust boundary. Above it there is a DOM event, which could be
anything. Below it there is a `SurfaceHit` — four optional strings and nothing
else. No DOM node, no event, no component reference crosses this line, which is
why the panel can be rendered anywhere in the tree.

**Core code**
```tsx
export function resolveTraceHit(target: EventTarget | null): SurfaceHit | null {
  if (!(target instanceof Element)) return null;
  const node = target.closest(surfaceSelector);
  if (!node) return null;
  const surfaceId = node.getAttribute("data-nodetrace-surface") ?? node.getAttribute("data-noderoom-surface");
  if (!surfaceId) return null;
  ...
}
```

**Input** — `event.target`.
**Output** — a `SurfaceHit` (`src/trace/types.ts:10`): `surfaceId` plus optional
`artifactId`, `elementId`, `targetRef` read from the nearest enclosing element
that carries them.
**Failure behavior** — every unsupported shape returns `null` and the click is
left alone. `data-noderoom-surface` is accepted as well as
`data-nodetrace-surface` so an app already tagged for NodeRoom works unchanged.
**Next** — the stored hit re-renders `TraceLensPanel`; continue to Step 5.

---

## Step 5 — Tool registration and invocation: the MCP server, not the panel

**File:** `bin/nodetrace-mcp.mjs`
**Symbol:** `server.registerTool("validate_capture_plan", ...)` line 22 and
`server.registerTool("capture_codebase", ...)` line 49
**Called by:** a coding agent over stdio MCP
**Calls next:** `normalizeCapturePlan` / `captureCodebaseFromPlan` in
`src/capture/codebaseCapture.mjs`

**Why this exists**
**The stage the gate calls "agent orchestration" does not exist in this
repository, and you should not go looking for it.** NodeTrace has no planner, no
model call, no agent loop — it is the surface an agent-built product adopts, not
an agent. What it does have is a pair of tools it exposes *to* somebody else's
agent, so a coding assistant can photograph a codebase without a human driving a
browser.

**Core code**
```js
server.registerTool("capture_codebase", { /* zod inputSchema */ },
  async ({ planPath, cwd }) => {
    const result = await captureCodebaseFromPlan(loadCapturePlan(absolutePlanPath), { cwd, planPath: absolutePlanPath });
    ...
  });
await server.connect(new StdioServerTransport());
```

**Input** — a path to a capture plan JSON file (see
`examples/real-codebase-capture/noderoom.capture.json`).
**Output** — a JSON text block with the step count and manifest path, plus PNGs
on disk.
**Failure behavior** — a bad plan throws inside `normalizeCapturePlan` and the
MCP call returns the error text. `editor.mode` other than `code-browser` is
rejected by name (`src/capture/codebaseCapture.mjs:98`).
**Next** — continue to Step 6; the capture writes a manifest, and the happy path
writes the database.

---

## Step 6 — Persistence: the only place rows are created

**File:** `scripts/init-sqlite.mjs`
**Symbol:** the top-level `db.transaction(...)` at line 187 and the
`writeFileSync(statePath, ...)` at line 227
**Called by:** `npm run happy-path`, and by `scripts/nodetrace-init.mjs` inside
any app the installer patched
**Calls next:** nothing — it is a script; it exits

**Why this exists**
This is the whole write path of the product. It applies `db/schema.sql`, inserts
one demo session with its surfaces, proof cards, trace events and ownership rows,
and then publishes the browser-safe subset as
`public/nodetrace-state.json`. Notice what it strips: `codeOwnership` is written
to the JSON **only** when `NODETRACE_BUILDER_CAPABLE=true`, because component,
query, mutation and test paths are internal information.

**Core code**
```js
db.transaction(() => {
  insertSession.run(session);
  for (const surface of surfaces) insertSurface.run({ ...surface, proofAvailable: surface.proofAvailable ? 1 : 0 });
  ...
})();

const clientState = { ..., codeOwnership: builderCapable ? codeOwnership.map(...) : [] };
writeFileSync(statePath, `${JSON.stringify(clientState, null, 2)}\n`);
```

**Input** — `--db`, `--state`, `--json-out` (parsed by `node:util`), and the
`NODETRACE_BUILDER_CAPABLE` environment variable.
**Output** — `.nodetrace/nodetrace.sqlite`, `public/nodetrace-state.json`, and an
optional receipt JSON.
**Failure behavior** — a missing `better-sqlite3` prints one instruction and
exits 1 (line 10). Everything else throws with a stack trace. The transaction
means a half-written database is not possible.
**Next** — the JSON this step wrote is what Step 2 fetches. That is the loop.

---

## Step 7 — Rendering: the panel filters the state down to one surface

**File:** `src/trace/TraceLensPanel.tsx`
**Symbol:** `TraceLensPanel`, line 7
**Called by:** `DemoDashboard` (`src/DemoDashboard.tsx:120`)
**Calls next:** `filterByHit`, line 158

**Why this exists**
The panel holds no state of its own. It reads the current hit from context and
the full state from its prop, and narrows: proof cards and trace rows are matched
first on the exact element, then fall back to the whole surface, so a click on a
region with no per-element evidence still shows the region's evidence.

**Core code**
```tsx
const meta = state.surfaces.find((surface) => surface.id === hit?.surfaceId) ?? null;
if (!open || !hit || !meta) return null;

const proofCards = filterByHit(state.proofs, hit.surfaceId, hit.artifactId, hit.elementId).slice(0, 6);
const traceRows = filterByHit(state.traces, hit.surfaceId, hit.artifactId, hit.elementId).slice(-6).reverse();
```

**Input** — the `SurfaceHit` from Step 4 and the `NodeTraceState` from Step 2.
**Output** — a `role="dialog"` panel with three regions: Business proof, Runtime
trace, Code ownership.
**Failure behavior** — **this is the line that produces open defect D1.** If the
clicked surface id is not in `state.surfaces`, `meta` is `null` and the component
returns `null`: the click was consumed, and nothing appears. There is no message.
Reproduce it by running `npm run trace-coach:sqlite` (which replaces the surface
registry) and then Ctrl-clicking the header, which is still tagged
`shell.statusStrip`.
**Next** — a second rendering path runs beside this one; continue to Step 8.

---

## Step 8 — The live graph rail turns trace rows into a picture

**File:** `src/trace/LiveGraphRail.tsx`
**Symbol:** `LiveGraphRail`, line 27
**Called by:** `DemoDashboard` (`src/DemoDashboard.tsx:115`), only when
`state.traces` is non-empty
**Calls next:** `GraphSession.observe` and the `NodeGraph` renderer in
`vendor/nodegraph-live/`

**Why this exists**
Each trace row names an actor, a surface, sometimes an artifact, and a phase.
Feeding those to a graph session turns a flat list into a picture of what touched
what. The header comment on this file states the rule that matters: trace rows
are **telemetry**, so every edge is a faint `traversal` edge and never an
`evidence` edge. Nothing here is a measured claim about the world.

**Core code**
```tsx
for (const row of traces) {
  const entities = entitiesFor(row);
  // Telemetry only: no measured count, so no evidence edge can appear.
  nextSession.observe(entities, undefined, { eventId: row.id });
  ...
}
const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
```

**Input** — `RuntimeTraceRow[]`.
**Output** — a WebGL canvas plus `data-entity-count` / `data-edge-count`
attributes, which is how the browser probes assert on it without reading pixels.
**Failure behavior** — this component needs WebGL and mounts nothing useful on a
server. That is why the installer loads the dashboard through
`next/dynamic(..., { ssr: false })` in a Next.js target
(`bin/nodetrace.mjs:304`); without it, `next build` dies in prerender with
`WebGL2RenderingContext is not defined`.
**Next** — continue to failure and recovery in Step 9.

---

## Step 9 — Failure and recovery live in the installer, not the UI

**File:** `bin/nodetrace.mjs`
**Symbol:** `runCommand`, line 204, and the receipt written at line 120
**Called by:** `addNodeTrace`, line 31, i.e. `npx @homenshum/nodetrace add`
**Calls next:** nothing — it writes the receipt and sets the exit code

**Why this exists**
The riskiest thing this project does is modify somebody else's repository:
copying files in, editing their `package.json`, running their install and their
build. Every phase is timed, logged to `.nodetrace/setup-log.txt`, and recorded
in `.nodetrace/setup-receipt.json` with `ok`, duration and a failure excerpt — and
the chain stops at the first failure rather than continuing to make changes.

**Core code**
```js
const result = spawnSync(command[0], command.slice(1), { cwd, timeout: options.timeoutMs, env: commandEnv() });
const ok = result.status === 0 && !result.error;
const status = timedOut ? `TIMEOUT after ${formatMs(options.timeoutMs)}` : ok ? "PASS" : "FAIL";
```

**Input** — a target directory, and optionally `--framework`, `--force`,
`--skip-install`, `--skip-verify`.
**Output** — files in the target, a patched `package.json`, a receipt, and exit
code 0 or 1.
**Failure behavior** — the receipt is written whether or not the phases passed,
so a failed install is inspectable rather than silent. `writeText` refuses to
overwrite an existing file unless `--force` is given (line 156), so re-running
`add` cannot quietly clobber a customised copy.
**Next** — continue to the tests in Step 10.

---

## Step 10 — The tests that prove the flow, and the one that does not

**File:** `scripts/cli-smoke.mjs`, `scripts/capture-plan-smoke.mjs`,
`scripts/mcp-smoke.mjs`, `scripts/smoke.mjs`
**Symbol:** `validateInstalledImports` (`scripts/cli-smoke.mjs:116`) and
`checkRealCapture` (`scripts/capture-plan-smoke.mjs:52`)
**Called by:** `npm run smoke`, `npm run capture:plan:smoke`, both members of
`npm run check`
**Calls next:** the real binaries, as subprocesses

**Why this exists**
Two of these are the tests worth knowing about.

`validateInstalledImports` walks every file the installer copied into a target
and asserts each relative import resolves *inside that target*. It exists because
of defect D2: a component imported the vendored graph renderer by a path that was
only correct in this repository, so every installed app failed at build time
while this repository stayed green.

`checkRealCapture` serves a page over HTTP from inside the test, then runs the
capture CLI against it and checks the manifest recorded
`actual-code-browser-shiki` and a real DOMRect. Before it existed, nothing ran the
capture engine end to end — only its plans were parsed.

**Core code**
```js
for (const match of readFileSync(file, "utf8").matchAll(/(?:from|import)\s+"(\.[^"]*)"/g)) {
  if (resolvesInTarget(dirname(file), match[1])) continue;
  issues.push(`${framework} ${shown} imports ${match[1]}, which the installer never copied into the target`);
}
```

**Input** — a throwaway target directory and a throwaway capture plan.
**Output** — a receipt in `docs/eval/`, and exit 0 or 1.
**Failure behavior** — each script collects issues and prints them all before
exiting 1, rather than throwing on the first one.
**And the one that does not:** `scripts/smoke.mjs` is mostly not a test. Roughly
170 of its 212 lines assert that documentation files and source files contain
particular literal strings — that `README.md` contains `125-step QA-agent trace`,
that `DemoDashboard.tsx` does *not* contain `surfaceBand`. Renaming a function or
rewording a sentence turns it red. Read `docs/codebase/TESTING.md` before you
change anything it names.

---

## Where you would add one adjacent capability

Say you want the panel to also show *who approved* a surface.

1. Add the field to `src/trace/types.ts` (`TraceProof`, line 17).
2. Add the column to `db/schema.sql` (`trace_proofs`, line 16).
3. Write it in `scripts/init-sqlite.mjs` — both the `proofs` array and the
   `insertProof` prepared statement, which must stay in sync by hand.
4. Render it in `src/trace/TraceLensPanel.tsx`, inside the Business proof region.
5. Add the column name to the schema assertion list in `scripts/smoke.mjs:47`,
   or the smoke will not notice if you delete it later.

Steps 1-4 are the flow. Step 5 is the tax this repository charges, and it is the
first thing to reconsider.
