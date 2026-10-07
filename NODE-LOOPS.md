# NODE-LOOPS.md — nodetrace
> This repo's self-improving-loop manifest. Companion to CLAUDE.md. Spec: https://github.com/HomenShum/noderl/blob/main/spec/node-loops.md

NodeTrace is a portable Trace Lens UI + local SQLite kit for agent-native apps
([`README.md`](README.md)). It is **agent-runtime-agnostic** by design
([`AGENTS.md`](AGENTS.md)): it brings the trace *surface*, *schema*, and *proof
gates*, not the model loop. So the loop this manifest describes is not an
inference loop — it is the **proof/capture pipeline** the repo runs over itself
and over a target codebase (NodeRoom) to keep its trace artifacts honest.

---

## 1. Goal & milestones

**Goal.** Give any coding agent a ready-to-port trace layer where every visible
surface is backed by a real receipt: tagged UI surfaces, a Review/Builder Trace
Lens, business proof cards, bounded runtime trace rows, server-gated code
ownership, and a no-key local SQLite happy path
([`README.md`](README.md) "What You Get").

**Milestones the loop checks against** (the `prepush` chain in
[`package.json`](package.json)):
- **No-key happy path** writes `.nodetrace/nodetrace.sqlite`, `public/nodetrace-state.json`, `docs/eval/nodetrace-happy-path.json` ([`scripts/init-sqlite.mjs`](scripts/init-sqlite.mjs)).
- **Smoke** asserts the schema, provider, panel, docs, and capture assets all line up ([`scripts/smoke.mjs`](scripts/smoke.mjs)).
- **Builder access** stays server-token-gated ([`scripts/builder-access-smoke.mjs`](scripts/builder-access-smoke.mjs)).
- **Scale** sustains a 125-step QA-agent trace with a bounded client window ([`scripts/agent-trace-scale-smoke.mjs`](scripts/agent-trace-scale-smoke.mjs)).
- **Real captures** of the NodeRoom Trace Coach are *actual* source + UI pixels, never generated stand-ins ([`scripts/trace-coach-sqlite.mjs`](scripts/trace-coach-sqlite.mjs)).
- **Installer e2e** proves `nodetrace add` survives a real `next build` ([`scripts/installer-next-e2e-smoke.mjs`](scripts/installer-next-e2e-smoke.mjs)).

---

## 2. Inner loop (agent-status trace)

The inner loop is the **capture pipeline**: produce a trace artifact, then have a
*separate* verifier judge it. The shape mirrors observe → act → extract.

**Task.** Capture a codebase/agent run into portable NodeTrace rows
(sessions, surfaces, proofs, events, code ownership) — see the schema in
[`db/schema.sql`](db/schema.sql) and the contract in
[`src/trace/types.ts`](src/trace/types.ts).

**State / Action / Observation.**
- *State* = `NodeTraceState` ([`src/trace/types.ts`](src/trace/types.ts)): `surfaces`, `proofs`, `traces` (bounded `RuntimeTraceRow[]`), `builderCapable`, optional `coach`.
- *Action* = a producer writes rows: `understand:noderoom` builds the codebase graph; `capture:noderoom:real` starts the live NodeRoom checkout and captures real source + UI pixels into `noderoom-real-capture-manifest.json`; `trace-coach:sqlite` seeds 6 ordered steps with file path + line range + DOMRect + screenshot + Mermaid flow ([`scripts/trace-coach-sqlite.mjs`](scripts/trace-coach-sqlite.mjs)).
- *Observation* = the runtime surface: Cmd/Ctrl-click any `[data-nodetrace-surface]` / `[data-noderoom-surface]` resolves a `SurfaceHit` ([`src/trace/TraceLensProvider.tsx`](src/trace/TraceLensProvider.tsx) `resolveTraceHit`) and opens the Trace Lens panel.

**How it's traced.** Every producer persists to SQLite via
[`db/schema.sql`](db/schema.sql) and emits a JSON receipt under
[`docs/eval/`](docs/eval). Rows carry optional NodeAgent workpaper refs and
receipt hashes (`traceId`, `stepId`, `inputRefs`/`outputRefs`/`evidenceRefs`/
`mutationRefs`/`approvalRefs`, `evalRef`, `argsHash`/`resultHash`/`payloadHash`/
`contextPackHash`) — [`docs/TRACE_WORKPAPER_STANDARD.md`](docs/TRACE_WORKPAPER_STANDARD.md).

**The JUDGE = a separate verifier.** The producer never grades itself. Distinct
scripts re-open the produced artifact and assert invariants:
- [`scripts/smoke.mjs`](scripts/smoke.mjs) re-reads the emitted state, the panel/provider source, the schema, every doc, and every capture asset, and fails if any required string/table/file is missing.
- [`scripts/agent-trace-scale-smoke.mjs`](scripts/agent-trace-scale-smoke.mjs) re-derives the visible window from the produced state and checks it is exactly the last 6 rows newest-first, that `codeOwnership` is empty while `builderCapable=false`, and that the panel still calls `.slice(-6).reverse()`.
- [`scripts/trace-coach-sqlite.mjs`](scripts/trace-coach-sqlite.mjs) `loadRealCaptureManifest` **throws** unless every step's `sourceView.captureKind` and `uiCapture.captureKind` start with `actual-`, the asset files exist, and `uiCapture.rect` is a finite measured DOMRect.

**Reward.** Binary per run: `ok: true` with `issues: []` in the eval receipt
(e.g. [`docs/eval/nodetrace-agent-scale-smoke.json`](docs/eval/nodetrace-agent-scale-smoke.json)),
non-zero exit + an enumerated `issues[]` list otherwise.

---

## 3. Outer loop (self-improve)

There is no autonomous retrain loop. The outer loop is **agent-in-the-loop
self-heal**, driven by receipts:

- **How failures feed back.** A failing verifier prints each issue and exits non-zero (`scripts/smoke.mjs:198-204` (`process.exitCode = 1`)), so the coding agent (or `prepush`) sees the exact missing surface/table/asset and edits the producing script, schema, or doc to close it.
- **Installer self-heal with receipts.** `bin/nodetrace.mjs add` writes `.nodetrace/setup-receipt.json` and `.nodetrace/setup-log.txt` (every command, output tail, duration, timeout). On a slow/locked-down target it **fails with a receipt instead of hanging**; the agent retries with `NODETRACE_PHASE_TIMEOUT_MS`, `--skip-install`, or a target-local npm cache ([`README.md`](README.md) "Add To An Existing App").
- **What's edited.** Producer scripts, [`db/schema.sql`](db/schema.sql), the panel/provider, docs, and capture plans ([`examples/real-codebase-capture/noderoom.capture.json`](examples/real-codebase-capture/noderoom.capture.json)). The trace surface contract itself stays portable (no app store / agent runtime imports — [`AGENTS.md`](AGENTS.md) rules).
- **Promotion gate.** [`package.json`](package.json) `prepush`: `happy-path && smoke && citations:check && builder:smoke && agent:scale:smoke && capture:plan:smoke && trace-coach:sqlite && installer:next:e2e && build && package:dry-run && npm audit --omit=dev`. All green or no push.
- **Kill criteria.** Generated/mocked captures are forbidden in public docs and release proof — only an explicit `--allow-generated-captures` debug fallback may stand in, never for a release ([`AGENTS.md`](AGENTS.md)). A hand-modeled knowledge graph is rejected: the graph must be produced by Understand-Anything deterministic scripts or smoke fails (`scripts/smoke.mjs:114-119` (`trace coach graph is not backed by Understand-Anything output`)).

---

## 4. Context anchors

The substrates that ground the loop. **Absence is itself a finding.**

- **Codebase graph (PRESENT).** Understand-Anything deterministic minimap over the real NodeRoom checkout → [`public/captures/noderoom-trace-knowledge-graph.json`](public/captures/noderoom-trace-knowledge-graph.json), generated by [`scripts/understand-anything-noderoom.mjs`](scripts/understand-anything-noderoom.mjs), receipt at [`docs/eval/nodetrace-understand-anything-noderoom.json`](docs/eval/nodetrace-understand-anything-noderoom.json) (2474 files scanned, 6 selected, 7 import edges).
- **Trace data contract (PRESENT).** [`src/trace/types.ts`](src/trace/types.ts) — `NodeTraceState`, `RuntimeTraceRow`, `TraceProof`, `CodeOwnershipReceipt`, `TraceCoachState`. Persisted by [`db/schema.sql`](db/schema.sql) (8 tables).
- **Knowledge/standard layer (PRESENT, doc-form).** [`docs/TRACE_WORKPAPER_STANDARD.md`](docs/TRACE_WORKPAPER_STANDARD.md) maps NodeAgent workpaper fields → NodeTrace display and defines the "What did the user ask / see / do / change; can I trust it?" frame.
- **Key modules.** Resolver [`src/trace/TraceLensProvider.tsx`](src/trace/TraceLensProvider.tsx); panel [`src/trace/TraceLensPanel.tsx`](src/trace/TraceLensPanel.tsx); surface registry [`src/trace/surfaces.ts`](src/trace/surfaces.ts); generic capture engine [`src/capture/codebaseCapture.mjs`](src/capture/codebaseCapture.mjs) (CLI [`bin/nodetrace-capture.mjs`](bin/nodetrace-capture.mjs), MCP [`bin/nodetrace-mcp.mjs`](bin/nodetrace-mcp.mjs)).
- **Eval/proof gates.** [`docs/eval/`](docs/eval) JSON receipts (happy-path, smoke, builder-access, agent-scale, next-e2e, trace-coach, understand-anything).
- **Reusable agent skill.** [`.claude/skills/real-codebase-captures/SKILL.md`](.claude/skills/real-codebase-captures/SKILL.md) — the portable "use actual source + running-app screenshots, not stand-ins" capture skill (Codex metadata in `agents/openai.yaml`).
- **Memory substrate (ABSENT — finding).** No persistent cross-run memory / failure store / RAG embedding layer ships in this repo. State is regenerated each run; failure memory lives only in transient `issues[]` arrays. This is the **control-arm gap**: the loop self-heals via re-running gates, not via accumulated memory.

---

## 5. Verification protocol

Separate-verifier and no-proof-no-claim are enforced in code, not by convention:

- **Separate verifier.** Producers and judges are different scripts (§2). `smoke.mjs` re-reads emitted artifacts rather than trusting the producer's return value.
- **No-proof-no-claim.** Real-capture is a **hard gate**: `loadRealCaptureManifest` throws unless captures are `actual-*` with existing files and a measured DOMRect; smoke re-asserts `captureModel` contains "actual code-browser" and "actual running NodeRoom" and that all 6 coach steps have real captures ([`scripts/trace-coach-sqlite.mjs`](scripts/trace-coach-sqlite.mjs), [`scripts/smoke.mjs`](scripts/smoke.mjs)).
- **Honest status (no fake 2xx / no silent pass).** Every verifier sets `ok:false` + non-zero exit on any issue and writes the failing `issues[]` to its receipt. The Builder route returns honest HTTP codes — 401 `builder_token_required`, 400 `surfaceId_required`, 404 `ownership_not_found` ([`examples/builder-access/server-route.mjs`](examples/builder-access/server-route.mjs)).
- **Runtime reliability.**
  - *Bounded reads.* The public client window is capped at the last 6 rows (`.slice(-6).reverse()`), asserted by [`scripts/agent-trace-scale-smoke.mjs`](scripts/agent-trace-scale-smoke.mjs) even at 125 stored rows.
  - *Timeout / no hang.* Installer phases honor `NODETRACE_PHASE_TIMEOUT_MS` and fail with a receipt instead of blocking ([`README.md`](README.md)); next-e2e ran under a 600 000 ms budget ([`docs/eval/nodetrace-next-e2e-smoke.json`](docs/eval/nodetrace-next-e2e-smoke.json)).
  - *Least-privilege data.* Public state holds only opaque surface ids, labels, proof cards, and bounded rows — never file paths, query/mutation names, secrets, or raw prompts ([`AGENTS.md`](AGENTS.md) rules).
- **PROVE-BEFORE-CLAIM** (agent-side gate) — never assert done/pass/fixed/blocked/absent/"root cause" from a *proxy* (an affordance, a keyword/template echo, a rendered shell, or a prior-based hypothesis); name the artifact that proves it and check THAT, independent-confirm anything that "looks done", and treat no gate as real until the autonomous path is tried. Canonical gate + observed failure signals: https://github.com/HomenShum/noderl/blob/main/spec/prove-before-claim.md

---

## 6. Reward & safety

**Reward components.** Per-gate `ok` boolean → the all-green `prepush` chain.
No numeric score is fabricated; reward is the union of the eval receipts in
[`docs/eval/`](docs/eval).

**Safety gates.**
- **Server-verified privilege.** Builder tabs and code ownership only appear when `builderCapable` is server-verified; `setMode("builder")` silently downgrades to `review` if not capable ([`src/trace/TraceLensProvider.tsx`](src/trace/TraceLensProvider.tsx)). Code ownership is served only behind a token route requiring a ≥12-char `NODETRACE_BUILDER_TOKEN` ([`examples/builder-access/server-route.mjs`](examples/builder-access/server-route.mjs)).
- **No data leakage.** Raw payloads stay server-side; the client gets refs/hashes/summaries only ([`docs/TRACE_WORKPAPER_STANDARD.md`](docs/TRACE_WORKPAPER_STANDARD.md)).
- **No-key by default.** The entire happy path runs with no API keys and no cloud account ([`README.md`](README.md)); every eval receipt records `apiKeysRequired: false`.
- **Bounded resources.** Smoke/scale scripts write to `mkdtemp` temp dirs and `rmSync` them, guarded by a `startsWith(tmpdir())` check ([`scripts/agent-trace-scale-smoke.mjs`](scripts/agent-trace-scale-smoke.mjs), [`scripts/smoke.mjs`](scripts/smoke.mjs)).
- **Supply-chain.** `prepush` ends with `npm audit --omit=dev` and `npm pack --dry-run`.

---

## 7. Status / receipts

Receipts live in [`docs/eval/`](docs/eval) (committed JSON, dated 2026-06-22 /
understand-anything 2026-06-17).

**PROVEN (receipt `ok: true`, `issues: []`):**
- Happy path — `traceRows: 4`, `proofRows: 2`, `builderCapable: false` ([`docs/eval/nodetrace-happy-path.json`](docs/eval/nodetrace-happy-path.json)).
- Smoke ([`docs/eval/nodetrace-smoke.json`](docs/eval/nodetrace-smoke.json)).
- Builder access — `builderTokenRequired: true` ([`docs/eval/nodetrace-builder-access-smoke.json`](docs/eval/nodetrace-builder-access-smoke.json)).
- Scale — 125 trace rows, 6-row visible window, 0 public code-ownership rows ([`docs/eval/nodetrace-agent-scale-smoke.json`](docs/eval/nodetrace-agent-scale-smoke.json)).
- CLI — vite + next frameworks ([`docs/eval/nodetrace-cli-smoke.json`](docs/eval/nodetrace-cli-smoke.json)).
- Next installer e2e — install/happy-path/smoke/`next build` all green in 125 s ([`docs/eval/nodetrace-next-e2e-smoke.json`](docs/eval/nodetrace-next-e2e-smoke.json)).
- Understand-Anything NodeRoom graph — 2474 files scanned, 7 import edges ([`docs/eval/nodetrace-understand-anything-noderoom.json`](docs/eval/nodetrace-understand-anything-noderoom.json)).
- Trace Coach SQLite — 6 NodeRoom codebase steps, real captures ([`docs/eval/nodetrace-trace-coach-sqlite.json`](docs/eval/nodetrace-trace-coach-sqlite.json)).

**OPEN:**
- **No persistent memory / failure-store / RAG substrate** in-repo (§4). Self-improvement is re-run-the-gate, not learned-from-memory.
- **Receipts are checked-in snapshots, not CI-enforced.** No CI workflow runs `prepush` on this repo's own pushes; the gate is local/manual.
- **No autonomous outer loop.** Trace/failure feedback is consumed by a human/coding-agent editing scripts; nothing auto-edits tools/prompts.
- **Reward is binary gate-pass**, not a scored signal — there is no quality/regression scoring beyond presence-of-required-strings assertions.
- **`trace-coach:sqlite` requires a local NodeRoom checkout** to capture live source/UI; absent it, only the `--allow-generated-captures` debug fallback runs (forbidden for release proof).
