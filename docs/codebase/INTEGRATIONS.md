# Integrations

Everything this repository talks to that is not its own source.

## Nothing needs an API key

There is no model provider, no cloud account, no auth. `.env.example` contains
three `NODETRACE_*` path variables and nothing secret. `nodekit.yaml` records
this as `noKey.status: certified` with `externalAccountsRequired: 0`, and every
receipt written under `docs/eval/` carries `apiKeysRequired: false`.

## SQLite, via better-sqlite3

- **Where:** `scripts/init-sqlite.mjs`, `scripts/trace-coach-sqlite.mjs`,
  `scripts/agent-trace-scale-smoke.mjs`, `examples/builder-access/server-route.mjs`
- **File:** `.nodetrace/nodetrace.sqlite` (gitignored), overridable with `--db` or
  `NODETRACE_DB_PATH`
- **Schema:** `db/schema.sql`, applied with `create table if not exists` on every
  run, so re-running is safe
- **Settings:** `journal_mode = WAL` everywhere; `foreign_keys = ON` in the trace
  coach script only — `init-sqlite.mjs` does not enable it, which is an
  inconsistency rather than a decision
- **Note:** `better-sqlite3` is a native module. It compiles during
  `npm install`, and running a script while that compile is still going produces
  a confusing failure. Both scripts catch the missing module and print one
  instruction instead of a stack trace.

## Playwright (headless Chromium)

- **Where:** `src/capture/codebaseCapture.mjs` (dynamic import),
  `scripts/capture-live-graph-rail.mjs`, `scripts/record-live-graph-rail.mjs`,
  `scripts/installer-next-e2e-smoke.mjs`, `promotion/probes/j4-installed-target-proof.mjs`
- **What for:** photographing the running app, recording the live graph rail,
  and proving an installed target actually renders
- **Browsers** download during `npm install` because the dependency is
  `playwright`, not `@playwright/test`
- **Caveat:** it is a devDependency, but shipped code imports it. See
  `CONCERNS.md`.

## Model Context Protocol

- **Server:** `bin/nodetrace-mcp.mjs`, stdio transport, `@modelcontextprotocol/sdk`
- **Tools:** `validate_capture_plan` (parse a plan, no browser) and
  `capture_codebase` (run it)
- **Input schemas:** zod
- **Client:** any local coding agent. `scripts/mcp-smoke.mjs` is one — it
  connects with the SDK's own client, lists tools, and calls the validator.
- **Register it** by pointing your agent at `npx -y @homenshum/nodetrace nodetrace-mcp`
  or the local `bin/nodetrace-mcp.mjs`.

## Shiki

Dynamically imported inside the capture engine to turn a real file's real line
range into highlighted HTML, which is then screenshotted. It is why a source
screenshot needs no editor installed and is identical in CI and on a laptop.

## The vendored graph renderer

`vendor/nodegraph-live/` is a **pre-built** copy of NodeGraph Live: compiled
JavaScript plus `.d.ts` declarations, committed, not built here. `LiveGraphRail`
imports `GraphSession` and `NodeGraph` from it, and it in turn imports `sigma`,
`graphology`, `graphology-layout-forceatlas2` and `@sigma/node-border` — which is
why those four are dependencies even though no file of ours mentions them.

Do not edit it. Its sourcemaps were deleted in the Wave 3 reduction because they
pointed at TypeScript sources this repository does not contain; to update it,
replace the directory from upstream.

Its `.d.ts` files are reported as unused by `knip` and are not: TypeScript
resolves `import ... from "../../vendor/nodegraph-live/index.js"` through them,
and deleting them breaks `tsc --noEmit`.

## ffmpeg

`scripts/render-walkthrough-media.mjs` needs `ffmpeg` on `PATH` to build the
walkthrough MP4 and GIF from two committed PNGs, and CI installs it with
`apt-get` for exactly that step. `scripts/record-live-graph-rail.mjs` also uses it
but degrades: no ffmpeg, keep the `.webm`, skip the GIF.

## GitHub Actions

- `.github/workflows/ci.yml` — install, install ffmpeg, `walkthroughs:render`,
  `prepush`, then `git diff --exit-code` on the walkthrough receipt so a
  regenerated video that differs from the committed one fails the build.
- `.github/workflows/node-platform-conformance.yml` — calls a reusable workflow in
  `HomenShum/NodeKit`, pinned to a commit SHA. This is what makes the `dev`,
  `demo`, `doctor`, `check` and `proof` script names load-bearing.

## The NodeRoom checkout, which is not optional but is undocumented

`npm run understand:noderoom` and `npm run capture:noderoom:real` both resolve
their source root as `options["source-root"] ?? NODETRACE_SOURCE_ROOT ?? ".."` —
they expect a checkout of `HomenShum/noderoom` to be the sibling directory of
this one. On a fresh clone both exit 1. Neither is part of `npm run check`.
This is open defect **D3** in `promotion/PROMOTION_LOG.md`.
