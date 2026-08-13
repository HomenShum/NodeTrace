# Canonical journeys — NodeTrace

Four real workflows. Not feature tours: a journey is one person, one goal, and
the artifact they hold when it worked. These are the promotion loop's work queue,
exercised in order of importance.

**A journey with no browser evidence is unfinished**, regardless of test status.

## Journey shape

Each journey states, in this order:

- **Persona and situation** — who arrived, and why today.
- **Goal** — what they want to be true when they leave.
- **Steps** — what they actually do, in the UI, in order.
- **Done when** — the observable artifact or state that proves completion.
- **Evidence** — path to the capture that shows it working. Empty until proven.

---

## J1 — "Show me it works before I give you my repo."

- **Persona and situation:** An engineer found NodeTrace this morning and has
  about ten minutes. They have been burned by tools that require a cloud account
  before they will render a pixel, so their first question is not "is it good",
  it is "does it run on my laptop with nothing signed in".
- **Goal:** A page open in their own browser, drawn from data on their own disk,
  with no key and no account anywhere in the path.
- **Steps:**
  1. `npm install`
  2. `npm run happy-path` — `scripts/init-sqlite.mjs` writes
     `.nodetrace/nodetrace.sqlite`, `public/nodetrace-state.json` and
     `docs/eval/nodetrace-happy-path.json`.
  3. `npm run dev` — Vite on `http://127.0.0.1:5187/` (`vite.config.ts`).
  4. Open that URL, read the Live graph rail.
  5. `npm run smoke` in a second shell.
- **Done when:** The dashboard renders and the Live graph rail states a non-zero
  entity count derived from the SQLite rows step 2 just wrote — observed:
  "10 entities from 4 SQLite trace events · 15 of 15 relationships shown" — and
  `npm run smoke` exits 0.
- **Status:** PASS. Every command exited 0; the count in the browser matches the
  4 events in `public/nodetrace-state.json`.
- **Evidence:** `promotion/evidence/happy-path-desktop-1280.png`

## J2 — "What produced this thing I am looking at?"

- **Persona and situation:** A reviewer is looking at one region of a running
  application and does not trust it yet. They want the provenance of that
  specific region, and they do not want to be handed a repository to go read.
- **Goal:** Point at the region, get back the source file, the evidence card, the
  confidence, and the ordered runtime events — and see plainly that privileged
  detail is withheld from them rather than absent.
- **Steps:**
  1. With the dev server up, Ctrl-click (Cmd-click on macOS) a region carrying
     `data-nodetrace-surface` — the resolver is
     `src/trace/TraceLensProvider.tsx:55-67`
     (`window.addEventListener("click", onClick, true)`).
  2. Read the panel `src/trace/TraceLensPanel.tsx` renders: Business proof,
     Runtime trace, Code ownership.
  3. Press Escape to dismiss.
- **Done when:** The panel opens in Review mode showing a proof card with a
  source and a confidence percentage, bounded runtime rows, and a Code ownership
  region visibly **locked** because `builderCapable` is false — observed:
  "Step 01 · verified · src/ui/panels/Artifact.tsx - 88%", one ENTRY row at
  57 ms, and "Builder access only. Component, query, mutation, skill, and test
  ownership must come from a privileged server route."
- **Status:** PASS on `workSurface.traceStrip`, **FAIL on `shell.statusStrip`**
  (defect D1 — the largest tagged region on the page is a silent no-op).
  Keyboard and touch have no path into this journey at all (defect D4).
- **Evidence:** `promotion/evidence/j2-lens-tracestrip-desktop.png` (works),
  `promotion/evidence/j2-lens-statusstrip-desktop.png` (D1 — Ctrl-click, no
  panel), `promotion/evidence/j2-mobile-tap-no-lens.png` (D4 — tap, no panel).

## J3 — "Walk me through a real codebase, with the actual file and the actual screen."

- **Persona and situation:** Someone joining a project wants to understand how a
  feature is put together, and has been told the codebase is the documentation.
  They want an ordered tour where each step shows the real file, the real lines,
  and the real screen that file draws.
- **Goal:** A guided, ordered walkthrough of a genuine codebase where every step
  is anchored to a file path, a line range, a UI selector and a screenshot.
- **Steps:**
  1. `npm run understand:noderoom` (`scripts/understand-anything-noderoom.mjs`)
  2. `npm run capture:noderoom:real` (`scripts/capture-noderoom-real-assets.mjs`)
  3. `npm run trace-coach:sqlite` (`scripts/trace-coach-sqlite.mjs`)
  4. Reload `http://127.0.0.1:5187/` and work through the step list, then the
     Overview / Steps / Minimap / Raw JSON tabs
     (`src/DemoDashboard.tsx:141-146`
     (`{ id: "flow", label: "Minimap", Icon: Network }`)).
- **Done when:** Six ordered steps render, each naming a real NodeRoom file and
  line range, a code-browser source screenshot, a UI selector with its DOMRect,
  and a running-app screenshot — and `docs/eval/nodetrace-trace-coach-sqlite.json`
  reports `ok: true`.
- **Status:** The screen is reached, but not by the documented route. Steps 1 and
  2 both exit 1 on a fresh clone (defect D3); step 3 succeeds anyway by silently
  falling back to `sourceMode: "snapshot"`, which the UI then renders as "full
  local checkout" (defect D3). Six steps, four tabs and both screenshots do
  render, and the receipt reports `ok: true`.
- **Evidence:** `promotion/evidence/trace-coach-desktop-1280.png`

## J4 — "Put it in the app I already have, without me hand-wiring it."

- **Persona and situation:** The same engineer from J1, now convinced. They have
  a Next.js App Router application at work and no appetite for copying twelve
  files by hand and guessing at the wiring.
- **Goal:** One command that leaves their application building, with the Trace
  Lens reachable at a route, and a receipt they can show a colleague.
- **Steps:**
  1. `npx github:HomenShum/NodeTrace add --framework next` — `bin/nodetrace.mjs`
     copies `src/trace/` to `<target>/src/nodetrace/`, adds the demo, the schema,
     the scripts and the `/nodetrace` page, then installs, seeds and builds.
  2. Or, as the repo's own no-skip proof of exactly that:
     `npm run installer:next:e2e` (`scripts/installer-next-e2e-smoke.mjs`).
  3. Open `/nodetrace` in the target application.
- **Done when:** The throwaway Next target installs, runs NodeTrace's happy path
  and its own smoke, completes a real `next build`, and writes
  `.nodetrace/setup-receipt.json`.
- **Status:** **PASS** as of iteration 1 (2026-08-13). Was FAIL at baseline
  (defect D2): phase 4 failed with
  `Module not found: Can't resolve '../../vendor/nodegraph-live/index.js'`, and
  once that was fixed the build compiled and then failed in prerender with
  `ReferenceError: WebGL2RenderingContext is not defined`. Both are fixed in
  `bin/nodetrace.mjs`. All four installer phases now pass, and step 3 — open
  `/nodetrace` in the target application — has been driven for the first time:
  the built target was served with `next start` on 127.0.0.1:4302 and the page
  returned HTTP 200 with the Live graph rail drawing 10 entities / 15 edges,
  0 console errors and 0 failed requests.
- **Evidence:** `promotion/evidence/j4-installed-next-target-1280.png` and
  `promotion/evidence/j4-installed-next-target.json`, produced by
  `npm run promotion:j4` (`promotion/probes/j4-installed-target-proof.mjs`).

---

## Journeys every agent surface owes

- **Receipt — applies, and is covered.** J2 *is* the receipt journey: after the
  application has done something consequential, the user points at the result and
  is shown what changed, where it came from, and how confident the system was.
  J4 adds the install-time receipt (`.nodetrace/setup-receipt.json`,
  `.nodetrace/setup-log.txt`). Both are exercised above.
- **Recovery — does not apply.** NodeTrace does not run anything on the user's
  behalf. It renders trace rows some other runtime already wrote; AGENTS.md is
  explicit that it "is not tied to NodeAgent, NodeRoom, Convex, or any model
  provider" and the README tells adopters to "Bring your own agent, tools, queue,
  database, or model provider." There is no run in this product to interrupt, so
  there is no mid-run failure to recover from. The nearest equivalent — a seeder
  failing — is a command-line failure, and is scored as D3.
- **Steering — does not apply, same reason.** There is no agent in flight here to
  correct. The user's only inputs are which surface to inspect and which tab to
  read, and both take effect immediately.

Recorded as decisions, not omissions: if NodeTrace ever ships its own runtime,
both come back.
