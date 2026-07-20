# NodeTrace

NodeKit repository ownership and brownfield mapping are documented in
[`docs/NODEKIT_ADOPTION.md`](docs/NODEKIT_ADOPTION.md). NodeTrace is a portable
trace presentation/storage package, not a second agent runtime or receipt
protocol.

Portable Trace Lens UI and SQLite setup for agent-native apps.

NodeTrace gives any coding agent a ready-to-port trace layer: tagged UI
surfaces, a Review/Builder Trace Lens, business proof cards, bounded runtime
trace rows, gated code ownership, and a local SQLite happy path. It is not bound
to NodeAgent's agent architecture. Bring your own agent, tools, queue, database,
or model provider.

Agent-trace injection guide: [`docs/AGENT_TRACE_ADOPTION.md`](docs/AGENT_TRACE_ADOPTION.md).
Workpaper standard: [`docs/TRACE_WORKPAPER_STANDARD.md`](docs/TRACE_WORKPAPER_STANDARD.md).

[Visual walkthrough](docs/WALKTHROUGH.md) - [Porting guide](docs/PORTING.md)

## Happy Path

```bash
npm install
npm run happy-path
npm run dev
npm run smoke
```

The default path uses no API keys and no cloud account. `npm run happy-path`
creates:

- `.nodetrace/nodetrace.sqlite`
- `public/nodetrace-state.json`
- `docs/eval/nodetrace-happy-path.json`

Open the Vite URL and Cmd/Ctrl-click any tagged surface to open Trace Lens.

![NodeTrace dashboard overview](docs/screenshots/nodetrace-dashboard.png)

## Add To An Existing App

From a React/Vite app:

```bash
npx github:HomenShum/NodeTrace add --framework vite
```

From a Next.js App Router app:

```bash
npx github:HomenShum/NodeTrace add --framework next
```

The unscoped `nodetrace` npm name is already occupied by an unrelated package.
When this repo is published to npm, use the scoped package:

```bash
npx @homenshum/nodetrace add
```

The repo includes a no-skip Next proof for coding agents:

```bash
npm run installer:next:e2e
```

That command creates a throwaway Next App Router target, installs dependencies,
runs the NodeTrace happy path and target smoke, then runs the target's real
`next build`. It also verifies Windows BOM-prefixed `package.json` files.

For long-running QA/browser/workflow agents:

```bash
npm run agent:scale:smoke
```

That proof creates a 125-step QA-agent trace fixture, verifies the public client
state remains Builder-safe, and confirms the Trace Lens keeps a bounded runtime
window for the clicked surface. The integration prompt is in
[`examples/qa-agent/README.md`](examples/qa-agent/README.md).

For a NodeRoom codebase Trace Coach walkthrough:

```bash
npm run understand:noderoom
npm run capture:noderoom:real
npm run trace-coach:sqlite
npm run dev
```

That proof seeds the local sample app from NodeRoom's real trace-tab source
path. It writes a SQLite-backed campaign where each ordered step contains a
step label, real NodeRoom file path and line range, actual NodeTrace
code-browser source screenshot rendered from the real filesystem, UI selector,
DOMRect bounding box, actual running NodeRoom screenshot, and Mermaid flow
source. `npm run capture:noderoom:real` starts the latest local NodeRoom
checkout, writes `public/captures/noderoom-real-capture-manifest.json`, and
captures real UI pixels before the SQLite seeder runs.
`npm run understand:noderoom` runs
Understand-Anything deterministic scripts over the NodeRoom trace files,
auto-cloning the upstream repo into `.nodetrace/understand-anything/` when no
local install is present, and writes the codebase minimap to
`public/captures/noderoom-trace-knowledge-graph.json`, with a receipt at
`docs/eval/nodetrace-understand-anything-noderoom.json`. See
[`examples/trace-coach-sqlite/README.md`](examples/trace-coach-sqlite/README.md).

![NodeRoom-style Trace Coach tabs](docs/eval/nodetrace-trace-coach-sqlite.png)

![NodeRoom Trace Coach minimap](docs/eval/nodetrace-trace-coach-minimap.png)

Reusable coding-agent skill:

- [`.claude/skills/real-codebase-captures/SKILL.md`](.claude/skills/real-codebase-captures/SKILL.md) is the public Claude Code/Codex-style skill for this capture workflow.
- It tells agents to use actual source screenshots, actual running-app screenshots, live DOMRects, and a manifest instead of generated screenshot stand-ins.
- For Codex, copy the `real-codebase-captures` folder into a Codex skills directory; the bundled `agents/openai.yaml` keeps the skill metadata portable.

Reusable capture tool:

- `nodetrace capture --plan <capture-plan.json>` runs a generic plan-driven capture from any repo.
- `nodetrace-capture --plan <capture-plan.json>` is the same tool as a dedicated binary.
- `nodetrace-mcp` exposes `validate_capture_plan` and `capture_codebase` over stdio MCP for local coding agents.
- [`examples/real-codebase-capture/noderoom.capture.json`](examples/real-codebase-capture/noderoom.capture.json) is the copyable plan format.
- The default `editor.mode` is `code-browser`: NodeTrace renders real repo files with Shiki in a local browser view, so no VS Code profile, workspace trust, or desktop automation is required. `desktop` and `web` remain optional escape hatches.

Default `add` behavior:

- copies `src/nodetrace/`
- creates `src/nodetrace-demo/`
- creates `nodetrace.html` for Vite or `/nodetrace` App Router page for Next
- copies the SQLite schema and init/smoke scripts
- patches `package.json` scripts and missing dependencies
- runs install, no-key happy path, target smoke, and build when available
- writes `.nodetrace/setup-receipt.json`
- writes `.nodetrace/setup-log.txt` with every command, output tail, duration,
  and timeout result

Then run:

```bash
npm run nodetrace:dev
```

Open `/nodetrace.html` for Vite or `/nodetrace` for Next. No API keys are
required.

If a target app has a slow registry, native package build, or locked-down
network, the installer fails with a receipt instead of hanging forever. Agents
can inspect `.nodetrace/setup-receipt.json` and `.nodetrace/setup-log.txt`, then
retry with `NODETRACE_PHASE_TIMEOUT_MS=600000`, `--skip-install`, or the target
repo's preferred package-manager command. npm installs use a target-local
`.nodetrace/npm-cache` so a stale global npm cache cannot block onboarding.

## Visual Walkthrough

The full screenshot walkthrough is in [`docs/WALKTHROUGH.md`](docs/WALKTHROUGH.md).
Storyboard first: the README media is governed by
[`docs/FEATURE_PROOF_STORYBOARD.md`](docs/FEATURE_PROOF_STORYBOARD.md). It
must prove no-key install, tagged surfaces, Trace Lens interaction,
proof/runtime separation, and Builder safety before it is treated as
publishable proof.

![NodeTrace MP4/GIF walkthrough](docs/walkthroughs/nodetrace-walkthrough.gif)

MP4 version: [`docs/walkthroughs/nodetrace-walkthrough.mp4`](docs/walkthroughs/nodetrace-walkthrough.mp4)

The walkthrough shows onboarding, the installer process, the finished no-key
demo dashboard, and the Trace Lens overlay.

Regenerate the README GIF/MP4 after storyboard or screenshot updates with:

```bash
npm run clip:capture
```

Cmd/Ctrl-click any tagged surface to open Trace Lens:

![NodeTrace Trace Lens overlay](docs/screenshots/nodetrace-trace-lens.png)

## What You Get

- `src/trace/TraceLensProvider.tsx`: global Cmd/Ctrl-click resolver.
- `src/trace/TraceLensPanel.tsx`: Review/Builder panel with the three trace regions.
- `src/trace/types.ts`: portable state contract.
- `src/trace/surfaces.ts`: client-safe opaque surface registry helpers.
- `db/schema.sql`: SQLite schema for sessions, surfaces, proofs, events, and gated ownership.
- `scripts/init-sqlite.mjs`: local database/state initializer.
- `scripts/understand-anything-noderoom.mjs`: UA-backed NodeRoom trace minimap generator.
- `examples/builder-access/server-route.mjs`: token-gated code ownership route.
- `examples/qa-agent/README.md`: coding-agent prompt for 100+ step QA traces.
- `examples/trace-coach-sqlite/README.md`: NodeRoom codebase Trace Coach example.
- `examples/real-codebase-capture/`: generic CLI/MCP capture plan for real source and app screenshots.
- `public/captures/`: real code-browser PNGs, real NodeRoom UI PNGs, and minimap evidence assets.
- `docs/AGENT_TRACE_ADOPTION.md`: injection checklist for external agent apps.
- `docs/PORTING.md`: copy/adapt checklist for coding agents.

## Trace Contract

NodeTrace follows the same safety shape as the NodeRoom Trace Lens:

- The client only sees opaque surface ids and user-facing labels.
- `Review` is the default mode.
- `Builder` tabs and code ownership only appear when `builderCapable` is server verified.
- `Business proof` shows source/evidence cards and confidence.
- `Runtime trace` shows bounded frame/tool/run events.
- Runtime rows may carry optional workpaper refs and receipt hashes, including
  `traceId`, `stepId`, `inputRefs`, `outputRefs`, evidence refs, mutation refs,
  approval refs, eval refs, and context/tool/payload hashes.
- `Code ownership` stays locked until a privileged server route supplies it.

Use either attribute on clickable surfaces:

```tsx
<section data-nodetrace-surface="workSurface.traceStrip">
  ...
</section>

// NodeRoom compatibility:
<section data-noderoom-surface="workSurface.traceStrip">
  ...
</section>
```

## Port Into Another App

1. Run `npx github:HomenShum/NodeTrace add --framework vite` or `--framework next`.
2. Open `/nodetrace.html` for Vite or `/nodetrace` for Next and confirm the no-key demo works.
3. Tag your visible surfaces with `data-nodetrace-surface`.
4. Insert trace rows and proof cards from your app runtime.
5. Serve `NodeTraceState` to the client from your backend.
6. Keep code ownership behind a privileged server route with component, query, mutation, skill, and test ownership.

NodeTrace provides the setup needed for the UI and database path. It does not
choose your agent loop, model, tool runtime, queue, auth, or cloud provider.
