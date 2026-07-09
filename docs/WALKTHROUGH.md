# NodeTrace Visual Walkthrough

NodeTrace is a portable trace layer for agent-native apps. This walkthrough
shows both the standalone demo and the expected target-app install flow.

## MP4/GIF Walkthrough

![NodeTrace walkthrough](walkthroughs/nodetrace-walkthrough.gif)

MP4 version: [nodetrace-walkthrough.mp4](walkthroughs/nodetrace-walkthrough.mp4)

The clip covers onboarding, the target-app installer process, the finished
local dashboard, and the Trace Lens overlay.

## 1. Run The Standalone Happy Path

```bash
npm install
npm run happy-path
npm run dev
```

No API key or cloud account is required. The happy path writes:

```text
.nodetrace/nodetrace.sqlite
public/nodetrace-state.json
docs/eval/nodetrace-happy-path.json
```

![NodeTrace dashboard overview](screenshots/nodetrace-dashboard.png)

What to verify:

- Session is `verified`.
- Database is `SQLite`.
- Keys are `none`.
- Trace rows are present.
- Surfaces are tagged and inspectable.

## 2. Open Trace Lens

Cmd/Ctrl-click a tagged surface, such as `Evidence`.

![NodeTrace Trace Lens overlay](screenshots/nodetrace-trace-lens.png)

Trace Lens should show:

- `Review` and `Builder` modes.
- `Business proof` evidence cards.
- `Runtime trace` rows.
- `Code ownership` locked until a privileged route supplies ownership.

## 3. Add NodeTrace To Another App

From a React/Vite app:

```bash
npx github:HomenShum/NodeTrace add --framework vite
npx github:HomenShum/NodeTrace add --framework next
```

After scoped npm publication:

```bash
npx @homenshum/nodetrace add
```

For a no-skip Next proof:

```bash
npm run installer:next:e2e
npm run agent:scale:smoke
npm run understand:noderoom
npm run capture:plan:smoke
npm run capture:noderoom:real
npm run trace-coach:sqlite
```

The installer copies the trace UI, schema, demo entry, init/smoke scripts, and
patches `package.json`. It then runs install, happy path, target smoke, and
build when the target app has a build script. Each phase has a timeout and
writes both status and command output:

```text
.nodetrace/setup-receipt.json
.nodetrace/setup-log.txt
```

Coding agents should read both files when a target install fails. The receipt
is the machine-readable status; the log is the command-by-command transcript.

`nodetrace capture --plan <capture-plan.json>` is the reusable version for any
repo. `nodetrace-capture` provides the same CLI as a dedicated binary, and
`nodetrace-mcp` exposes the capture plan validator and runner over stdio MCP.
`npm run capture:noderoom:real` uses that same capture engine for the latest
local NodeRoom app, captures actual source slices with the NodeTrace
Shiki-backed code browser, measures live
`data-noderoom-surface` DOMRects, and stores actual running-app screenshots plus
`public/captures/noderoom-real-capture-manifest.json`.
`npm run trace-coach:sqlite` switches the demo state to a NodeRoom codebase
Trace Coach campaign based on that manifest, NodeRoom trace-tab files,
selectors, DOMRects, the Understand-Anything-backed minimap graph from
`npm run understand:noderoom`, and Mermaid source. It uses ordered step labels
instead of video timecodes.

## 4. Architecture

```mermaid
flowchart LR
  CLI["nodetrace add"] --> Target["target React/Vite app"]
  CLI --> NextTarget["target Next App Router app"]
  Target --> Schema["db/nodetrace.schema.sql"]
  NextTarget --> Schema
  Target --> Scripts["scripts/nodetrace-init.mjs + smoke"]
  NextTarget --> Scripts
  Target --> Components["src/nodetrace"]
  NextTarget --> Components
  Scripts --> State["public/nodetrace-state.json"]
  State --> Demo["nodetrace.html"]
  State --> NextDemo["/nodetrace page"]
  Components --> Lens["Trace Lens"]
  Lens --> Review["Review mode"]
  Lens --> Locked["Builder/code ownership locked"]
```

## 5. Coding-Agent Integration Prompt

```text
Run npx github:HomenShum/NodeTrace add --framework vite or --framework next in this app.
Keep the no-key happy path green before adding model/provider credentials.
Open /nodetrace.html for Vite or /nodetrace for Next and verify Trace Lens.
Tag product surfaces with data-nodetrace-surface.
Write app runtime events into sessions, surfaces, proofs, trace events, and gated ownership.
Keep builderCapable server-verified.
Run npm run nodetrace:happy-path, npm run nodetrace:smoke, and npm run build.
Run npm run installer:next:e2e in the NodeTrace repo when changing the Next scaffold.
Run npm run agent:scale:smoke when changing trace-row rendering, Builder gating, or long-running agent state.
Run npm run understand:noderoom, npm run capture:plan:smoke, npm run capture:noderoom:real, then npm run trace-coach:sqlite when changing the NodeRoom-style Trace Coach tabs, source/UI captures, or minimap graph.
Use nodetrace capture --plan or nodetrace-mcp when porting the same capture workflow to another repo.
Confirm docs/eval/nodetrace-understand-anything-noderoom.json says ok true and public/captures/noderoom-trace-knowledge-graph.json is Understand-Anything-backed.
Confirm public/captures/noderoom-real-capture-manifest.json points to actual code-browser source and running NodeRoom PNG captures, not generated stand-ins.
Use examples/builder-access/server-route.mjs for a token-gated Builder ownership route.
```

## 6. Done Criteria

- `.nodetrace/setup-receipt.json` has `"ok": true` after install.
- `npm run nodetrace:happy-path` passes in the target app.
- `npm run nodetrace:smoke` passes in the target app.
- Target build passes.
- `/nodetrace.html` or `/nodetrace` renders a dashboard.
- Cmd/Ctrl-click opens Trace Lens.
- Code ownership is not exposed unless `builderCapable` is server verified.
