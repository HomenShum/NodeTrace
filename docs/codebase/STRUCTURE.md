# Structure

Where things are, and which of them you will actually open.

## The five files that are the product

If you read nothing else, read these. Together they are under 600 lines.

    src/trace/types.ts             the vocabulary: SurfaceHit, TraceProof, RuntimeTraceRow, NodeTraceState
    src/trace/TraceLensProvider.tsx  catches Ctrl-click, turns a DOM event into a SurfaceHit
    src/trace/TraceLensPanel.tsx     renders proof, trace and ownership for that hit
    db/schema.sql                    the eight tables everything is stored in
    scripts/init-sqlite.mjs          the only code that writes rows and publishes the client JSON

## Full layout

    index.html                 single page; loads src/main.tsx
    vite.config.ts             dev server + build; no plugins beyond React

    src/
      main.tsx                 mounts DemoDashboard, nothing else
      DemoDashboard.tsx        the demo page: hero, Trace Coach panel, live graph rail
      styles.css               demo page styling
      trace/                   THE PORTABLE PART — this whole directory is what
                               `nodetrace add` copies into another repository
        index.ts               the public surface of that copy
        types.ts               domain types
        TraceLensProvider.tsx  click capture + React context
        TraceLensPanel.tsx     the panel
        LiveGraphRail.tsx      trace rows as a graph, via vendor/nodegraph-live
        trace.css              panel styling
      capture/
        codebaseCapture.mjs    the capture engine: Shiki source shots + Playwright app shots

    bin/
      nodetrace.mjs            `nodetrace add` — transplants src/trace into a Vite or Next app
      nodetrace-capture.mjs    thin wrapper over the capture CLI
      nodetrace-mcp.mjs        stdio MCP server exposing two capture tools

    db/schema.sql              trace_sessions, trace_surfaces, trace_proofs, trace_events,
                               trace_code_ownership, trace_coach_steps, trace_coach_graph_nodes,
                               trace_coach_graph_edges

    scripts/                   every npm script's implementation; see below
    vendor/nodegraph-live/     a pre-built third-party graph renderer, committed. Do not edit.
    examples/                  copyable integration examples, each with a README
    promotion/                 the product-readiness loop: goal, journeys, defect ledger, probes
    docs/                      this packet, plus adoption/porting guides and evidence receipts
    public/captures/           committed PNG/SVG evidence the demo page renders
    .tours/                    CodeTour walkthroughs; `npm run citations:check` verifies them

## The scripts directory, grouped by what it is for

Sixteen files, which is a lot. They fall into four groups.

**Make the app work (you will run these):**

- `init-sqlite.mjs` — `npm run happy-path`. Creates SQLite + `public/nodetrace-state.json`.
- `trace-coach-sqlite.mjs` — `npm run trace-coach:sqlite`. Replaces that state
  with the six-step NodeRoom walkthrough. 970 lines, most of them data.

**Check it still works (CI runs these):**

- `smoke.mjs`, `cli-smoke.mjs`, `mcp-smoke.mjs` — `npm run smoke`
- `capture-plan-smoke.mjs` — dry run plus one real headless capture
- `builder-access-smoke.mjs`, `agent-trace-scale-smoke.mjs`
- `installer-next-e2e-smoke.mjs` — installs into a throwaway Next app, runs `next build`
- `capture-plan-fixture.mjs` — shared throwaway fixture; not a script you run
- `citations-check.mjs` — verifies every `.tours/` step and every markdown `path:line` still names the line it claims

**Produce evidence (you will probably not run these):**

- `capture-live-graph-rail.mjs`, `record-live-graph-rail.mjs` — screenshot and
  video of the live graph rail
- `render-walkthrough-media.mjs` — builds an MP4/GIF slideshow from two PNGs; needs ffmpeg

**Need a second repository checked out beside this one (they fail on a fresh clone):**

- `understand-anything-noderoom.mjs` — `npm run understand:noderoom`
- `capture-noderoom-real-assets.mjs` — `npm run capture:noderoom:real`

Both resolve their source with `options["source-root"] ?? env ?? ".."`, i.e. they
assume a NodeRoom checkout is the sibling directory of this one. Nothing in the
README says to create it. This is open defect **D3**; neither script is part of
`npm run check`, so the repository's own green bar does not depend on them.

## What `nodetrace add` copies into a target

Useful to know before you move a file, because moving one silently changes what
other people's applications receive — `bin/nodetrace.mjs:52-75`
(`copyDir(join(packageRoot, "src", "trace")`):

    src/trace/**                 -> <target>/src/nodetrace/
    vendor/nodegraph-live/**     -> <target>/src/nodetrace/vendor/nodegraph-live/
    src/DemoDashboard.tsx        -> <target>/src/nodetrace-demo/DemoDashboard.tsx
    src/styles.css               -> <target>/src/nodetrace-demo/styles.css
    db/schema.sql                -> <target>/db/nodetrace.schema.sql
    scripts/init-sqlite.mjs      -> <target>/scripts/nodetrace-init.mjs
    public/nodetrace-state.json  -> <target>/public/nodetrace-state.json

Relative imports are rewritten on the way. `scripts/cli-smoke.mjs` asserts that
every import in the copied tree still resolves inside the target — add a file to
`src/trace/` that imports something outside these paths and that check goes red.
