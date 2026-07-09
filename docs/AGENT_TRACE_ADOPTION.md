# Agent Trace Adoption

NodeTrace is intended to be injected into another app by a coding agent, then
fed by that app's own agent runtime. It is not tied to NodeAgent, Convex, or
NodeRoom.

## External Demo Prompt

```text
Install NodeTrace into this repo and prove the no-key trace UI works.

Use the correct framework target:
npx github:HomenShum/NodeTrace add --framework vite
npx github:HomenShum/NodeTrace add --framework next

Run the generated checks:
npm run nodetrace:happy-path
npm run nodetrace:smoke
npm run build

Then wire our agent trace data into NodeTraceState:
- trace_sessions: one long-running run, job, workflow, or QA session
- trace_surfaces: visible product surfaces with opaque ids
- trace_events: every agent step, tool call, retry, browser action, scheduler event, and receipt
- trace_proofs: source-backed business or QA evidence cards
- trace_code_ownership: Builder-only ownership served by a privileged server route
- RuntimeTraceRow.traceId / stepId: stable workpaper ids from your runtime
- RuntimeTraceRow.inputRefs / outputRefs: opaque refs for context, sources, cells, artifacts, and tool results
- RuntimeTraceRow.receiptHashes: args/result/payload/context hashes, never raw secrets
- coach.sourceView: actual source screenshot for the active code section
- coach.uiCapture: actual running-app screenshot with selector and DOMRect
- coach.mapCapture: codebase minimap backed by a graph JSON file, compatible with an Understand Anything export

For visual codebase onboarding, copy examples/real-codebase-capture/noderoom.capture.json,
edit it for this repo, run nodetrace capture --plan <plan> --dry-run, then run
nodetrace capture --plan <plan>. Use the default `editor.mode: "code-browser"`
for fast CLI-friendly source screenshots from real files. MCP clients can use
nodetrace-mcp with validate_capture_plan followed by capture_codebase.

Tag visible UI surfaces with data-nodetrace-surface. Keep public client state
free of file paths, query names, mutation names, skill paths, raw prompts,
cookies, tokens, and private user data. Only return code ownership after
server-verified Builder access.

For a 100+ step QA agent, keep the full operation ledger durable server-side.
The Trace Lens client panel should show the newest relevant window for the
clicked surface, while the backend keeps the full audit trail for export.
```

## Proven Long-Run Shape

Run:

```bash
npm run agent:scale:smoke
```

The smoke creates a 125-step QA-agent trace fixture, writes it through the same
SQLite trace schema, verifies public state keeps `codeOwnership` empty when
`builderCapable=false`, and confirms Trace Lens renders a bounded newest-first
window for the clicked surface.

## Builder Ownership Fields

NodeTrace follows the latest NodeRoom Trace Lens Builder shape:

| Field | Visibility | Purpose |
|---|---|---|
| `componentRef` | server-only until Builder access | UI component or surface owner |
| `queryRef` | server-only until Builder access | read/query path |
| `mutationRef` | server-only until Builder access | write/mutation path |
| `skillRef` | server-only until Builder access | agent skill/tool/process owner |
| `testRef` | server-only until Builder access | regression/e2e proof owner |

`backendRef` remains available for non-Convex or mixed backends, but the
NodeRoom-compatible minimum for Builder mode is component, query, mutation,
skill, and test ownership.

## Done Criteria

```bash
npm run happy-path
npm run smoke
npm run builder:smoke
npm run agent:scale:smoke
npm run capture:plan:smoke
npm run build
```

In the target app, Cmd/Ctrl-click a tagged surface and verify Review mode opens
with proof and runtime rows, while Builder/code ownership stays locked for a
non-builder viewer.
