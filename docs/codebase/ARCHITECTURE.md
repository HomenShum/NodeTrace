# Architecture

## The one idea

A **surface** is a named region of a user interface. The name is a string, like
`workSurface.traceStrip`. Two independent things agree to use that same string:

- the interface, via an HTML attribute: `data-nodetrace-surface="workSurface.traceStrip"`
- the database, via a column: `trace_proofs.surface_id`, `trace_events.surface_id`

Nothing else connects them. No component registry, no import, no build step, no
route. That is why a panel written here can explain a screen written by someone
else who has never seen this repository — they only had to agree on a string.

Everything below follows from that.

## The data path, end to end

    scripts/init-sqlite.mjs
        writes rows          ->  .nodetrace/nodetrace.sqlite   (server side, private)
        publishes a subset   ->  public/nodetrace-state.json   (client side, public)

    browser
        DemoDashboard fetches that JSON once, on mount
        TraceLensProvider listens for Ctrl-click on window (capture phase)
        resolveTraceHit    DOM event  ->  SurfaceHit
        TraceLensPanel     SurfaceHit + state  ->  the panel

The browser never opens SQLite and never calls an API. The published JSON is the
entire contract, and it is a static file. That is the reason the panel drops into
a Next.js app, a Vite app, or anything else that can serve a file.

### The one privacy rule in the whole system

`scripts/init-sqlite.mjs` writes `codeOwnership` into the published JSON **only**
when `NODETRACE_BUILDER_CAPABLE=true`. Those rows carry internal component,
query, mutation, skill and test paths. The panel also gates them again at render
time, but the render-time gate is cosmetic; the one that matters is the write.
A client cannot leak what it never received.

The generated integration doc repeats the rule to whoever adopts NodeTrace:
keep `builderCapable` server-verified, and serve ownership from a privileged
route rather than a static file.

## Three programs, one shared vocabulary

The repository is not one application. It is three programs that share
`src/trace/types.ts` and `db/schema.sql`.

**1. The panel** (`src/trace/`, ~430 lines of TSX plus CSS)
A React context provider, a panel component, and a graph rail. No data fetching
of its own — it takes state as a prop. This is the part that gets copied.

**2. The installer** (`bin/nodetrace.mjs`, ~500 lines)
Copies the panel into someone else's repository, rewrites its relative imports,
patches their `package.json` scripts and dependencies, then runs their install,
the happy path, the target smoke and their build — stopping at the first failure
and writing a receipt either way.

Its history is worth knowing because it explains the code's shape. The installer
used to keep hand-written lists of what NodeTrace "is made of": which files to
copy, which packages to declare. Those lists drifted from the code they
described, and because this repository already contains everything, its own build
could never disagree with them. Every installed application failed and every
check here stayed green. Two of the three lists are now derived —
`withOwnRanges` reads dependency ranges from this package's own manifest and
throws if one is missing — and `scripts/cli-smoke.mjs` checks the third by
walking the copied tree.

**3. The capture engine** (`src/capture/codebaseCapture.mjs`, ~600 lines)
Given a plan naming source files, anchors and UI selectors, it produces two
screenshots per step: the real file's real line range rendered with Shiki, and
the real running app's real element photographed with Playwright, with its
measured DOMRect. Reachable three ways — `nodetrace capture`,
`nodetrace-capture`, and the MCP tools — all of which funnel into
`normalizeCapturePlan` and then `captureCodebaseFromPlan`.

There is exactly one `editor.mode`, `code-browser`. Modes that drove VS Code
Desktop and VS Code for the Web were removed in the Wave 3 reduction; see
`docs/SIMPLIFICATION_REPORT.md`.

## What is NOT here

**There is no agent.** No planner, no model call, no tool loop, no streaming
token path. NodeTrace is the trace surface an agent-built product adopts. The
nearest thing to orchestration is `captureCodebaseFromPlan`, which runs a plan an
agent wrote. If you are looking for the agent, you are in the wrong repository.

**There is no server.** No HTTP route, no API handler. `examples/builder-access/server-route.mjs`
is a worked example of the privileged route a host app should write — it is a
sample, not a running service.

**There is no router and no client-side state store.** One page, one `useState`.

## Invariants worth not breaking

1. **The published JSON never contains ownership rows unless the environment
   says so.** `scripts/init-sqlite.mjs`.
2. **The panel takes state as a prop and fetches nothing.** Break this and it
   stops being droppable.
3. **Everything `src/trace/` imports must live inside `src/trace/` or be a
   declared dependency.** Enforced by `scripts/cli-smoke.mjs`, learned the hard
   way (defect D2).
4. **Trace rows are telemetry, not evidence.** `LiveGraphRail` never passes a
   measured count and never calls `assertEdge`, so every edge it can draw is a
   faint `traversal` edge. The file says so at the top; keep it true.
5. **A capture's `captureKind` starts with `actual-` only when something was
   really photographed.** Downstream checks read that prefix to tell a real
   capture from a placeholder.
