# Promotion log — NodeTrace

Loop state lives here, in git, so any agent can resume cold. One entry per
iteration. Append; never rewrite history, because the list of things that turned
out to be wrong is more useful to the next reader than the current values alone.

Iteration cap: **10** (default). On reaching the cap without a gate pass, stop
and leave the remaining defect ledger below — a documented stop is a valid
outcome; a silent one is not.

## Entry shape

```
### Iteration N — YYYY-MM-DD
- Journey exercised: J<k> <name>
- Observed: <the defect, with its reproduction — inputs, width, state>
- Fixed: <the change, using existing components; file paths>
- Re-proved: <evidence path showing the defect gone in the rendered app>
- Tests: <command and result>
- Conditions newly PASS: <numbers, or "none">
```

---

## Baseline — 2026-08-13

Wave 1. Measurement only: **nothing in this repository was fixed**, by design.
A baseline that quietly repairs things is a baseline nobody can compare against.
The only files added are the four under `promotion/` and the captures in
`promotion/evidence/`.

- **Repo state:** fresh `git clone --depth 50`, default branch `main`, at
  `8be0092`.
- **Environment:** Windows 11, Node v22.22.2, npm 10.x, headless Chromium driven
  by the repo's own Playwright 1.61 devDependency.
- **App started:** yes. `npm run dev` (Vite 6.4.3) served
  `http://127.0.0.1:5187/` and every capture below came from that server.
- **Journeys drivable:** **2 of 4 clean.** J1 and J2 complete end-to-end. J3
  reaches its screen only through an undocumented fallback after both documented
  prerequisites fail. J4 never reaches a browser at all.
- **Scorecard at baseline:** first recorded as 3/12 PASS (PASS on 4, 9, 10);
  **corrected the same day to 0/12 PASS** — see [PRODUCT_GOAL.md](PRODUCT_GOAL.md)
  and the Correction section at the bottom of this file. FAIL on 1, 2, 3, 5, 6,
  11. UNVERIFIED on 4, 7, 8, 9, 10, 12. No condition passes.
- **Not marked DEFERRED** in the Wave 1 context note for this repo. The note
  flagged one known API gap, recorded below as D5.

### Commands run, with real exit codes

| Command | Exit | Note |
|---|---|---|
| `npm install` | 0 | 252 packages in ~1m. Reports 6 vulnerabilities (2 moderate, 4 high). |
| `npm run happy-path` | 0 | `PASS 119ms`; wrote the sqlite file and `public/nodetrace-state.json`. |
| `npm run happy-path` (first attempt) | 1 | Discard — my own race: I launched it while `npm install` was still building `better-sqlite3`. `npm rebuild better-sqlite3` then exit 0. Not a repo defect; recorded so the ledger is complete. |
| `npm run smoke` | 0 | `smoke: PASS`, `cli smoke: PASS`, `mcp smoke: PASS`. |
| `npm run build` | 0 | `tsc --noEmit` + `vite build`, 1675 modules, 30.21s, 431.79 kB JS. |
| `npm run builder:smoke` | 0 | `builder access smoke: PASS`. |
| `npm run agent:scale:smoke` | 0 | `PASS 125 rows`. |
| `npm run capture:plan:smoke` | 0 | `capture plan smoke: PASS`. |
| `npm run trace-coach:sqlite` | 0 | `PASS 6 NodeRoom codebase steps (snapshot)` — see D3. |
| `npm run package:dry-run` | 0 | **111 files.** First recorded as 112; a re-run on a fresh clone reports `total files: 111` and exit 0. The exit code reproduces, the count did not. See the Correction below. |
| `npm run understand:noderoom` | **1** | Uncaught `Error: NodeRoom trace file missing: …` + raw stack. See D3. |
| `npm run capture:noderoom:real` | **1** | `NodeRoom source root not found: …`. See D3. |
| `npm run installer:next:e2e` | **1** | Target `next build` fails, 39.00s. See D2. |
| `npm audit --omit=dev` | **1** | 4 production advisories, 2 high / 2 moderate. See D6. |
| _three ad-hoc Playwright drives — overflow sweep, lens probe, a11y probe_ | 0 | **Not retained, and therefore not a command anyone can run.** This row originally named a file path that was literally an ellipsis, because there was no file to name: the three drives were throwaway scripts written to a scratch directory outside the clone, never committed, and they no longer exist. They produced the screenshots in `promotion/evidence/`, which survive, but the numeric readouts they printed do not. This is why conditions 4, 9 and 10 are UNVERIFIED. |

`npm run prepush` (aliased `npm run check`) chains ten of these with `&&`. Two
members are red, so the repo's own declared green bar is red. It was not re-run
end-to-end; every member was run individually and its exit code is above.

## Defect ledger

Open defects, most-impactful first. A defect is only listed once it has a
reproduction; a hunch is not a defect.

| # | Severity | Journey | Reproduction | Status |
|---|----------|---------|--------------|--------|
| D1 | Major | J2 | **The header is a tagged surface that does nothing.** After `npm run trace-coach:sqlite`, load `http://127.0.0.1:5187/` at 1280x900 and Ctrl-click anywhere in the hero — the `<h1>`, the launch card, any point inside `[data-nodetrace-surface="shell.statusStrip"]` (1236x330 px, the largest tagged region on the page). No panel, no message, no cursor change: `document.querySelector(".nt-panel")` stays null. Root cause, traced not guessed: `src/DemoDashboard.tsx:52` (`data-nodetrace-surface="shell.statusStrip"`) hardcodes the id, but `trace-coach-sqlite.mjs` replaces `state.surfaces` with six `workSurface.trace*` ids; `src/trace/TraceLensPanel.tsx:16-18` (`state.surfaces.find`) looks the id up in the registry and returns `null` when it misses. The click resolves, the panel refuses, nothing tells the user. Contrast: the same click on `workSurface.traceStrip` works. In the happy-path state — where `surfaces` still contains `shell.statusStrip` — the same click also works, so the failure only appears after the README's own Trace Coach commands. | Open |
| D2 | Major | J4 | ~~**The installer ships a target that cannot build.**~~ **FIXED in iteration 1**, and it had a second layer the baseline could not see: with the vendored renderer copied, `next build` compiled and then died in *prerender* with `ReferenceError: WebGL2RenderingContext is not defined`. See iteration 1 below. Original reproduction, preserved: `npm run installer:next:e2e` → phases 1-3 pass (`happy path PASS 2.59s`, `smoke PASS 3.15s`), phase 4 fails after 39.00s: `./src/nodetrace/LiveGraphRail.tsx  Module not found: Can't resolve '../../vendor/nodegraph-live/index.js'` and the same for `react.js`; `Build failed because of webpack errors`; exit 1. Root cause: `src/trace/LiveGraphRail.tsx:11-12` (`../../vendor/nodegraph-live/index.js`) imports the vendored NodeGraph Live build by relative path, but `bin/nodetrace.mjs:52-75` (`copyDir(join(packageRoot, "src", "trace")`) copies **only** `src/trace/` into the target — nothing copies `vendor/nodegraph-live/`, so `../../vendor/...` resolves to a path that does not exist in the target. The repo's own suites stay green because the repo itself has `vendor/`. This makes the README's headline `npx github:HomenShum/NodeTrace add` produce a broken application. | **Fixed** (iteration 1) |
| D3 | Major | J3 | **The UI claims provenance the receipt denies.** On a fresh clone the two documented prerequisites fail: `npm run understand:noderoom` exits 1 with `NodeRoom source root not usable: <parent>` and names the missing trace files (until iteration 2 below it threw a raw stack trace instead, and only after cloning and installing an external plugin first), and `npm run capture:noderoom:real` prints `NodeRoom source root not found: <parent>`. Both resolve the NodeRoom checkout from `sourceRoot = resolve(options["source-root"] ?? env.NODETRACE_SOURCE_ROOT ?? "..")` — i.e. they assume NodeRoom is a sibling directory of the clone, which the README never states, and the README's promised auto-clone covers the Understand-Anything tool, not the NodeRoom source. `npm run trace-coach:sqlite` then succeeds anyway and prints `(snapshot)`; `docs/eval/nodetrace-trace-coach-sqlite.json` records `"sourceMode": "snapshot"`. But `src/DemoDashboard.tsx:138` (`sourceModeLabel`) maps anything that is not `"live"` to the string **"full local checkout"**, so the rendered page asserts `full local checkout - HomenShum/noderoom` for a checkout that is not present — visible in `promotion/evidence/trace-coach-desktop-1280.png`. The same receipt asserts `captureModel: "actual code-browser source screenshots from real filesystem … + actual running NodeRoom Playwright screenshots"` in a run where the capture step exited 1; the assets are real but checked in from an earlier run, and no field separates "produced now" from "committed earlier". In a product whose entire pitch is provenance, this is the worst possible place to overstate. | Open |
| D4 | Major | J2, J3 | **The only way in is a modified mouse click.** `src/trace/TraceLensProvider.tsx:58` (`event.metaKey \|\| event.ctrlKey`) gates on the modifier keys and `event.button === 0`. Keyboard: 25 consecutive Tab presses at 1280x900 never reach anything that opens the lens — 17 landed stops in the happy-path state, 24 in the trace-coach state (12 focusable elements, cycled), and not one of them is an opener. Touch: at 375x812 with Chromium `hasTouch: true, isMobile: true`, tapping `[data-nodetrace-surface="workSurface.traceStrip"]` leaves `.nt-panel` null and no affordance is drawn (`j2-mobile-tap-no-lens.png`). Once open by mouse, the dialog is still not keyboard-usable: `role="dialog"` with no `aria-modal`, focus stays on `BODY`, and 6 further Tabs all land on `button.r-tracevu-rec` behind the panel (`a11y-lens-open-focus.png`). | Open |
| D5 | Minor | — | **Known API gap, carried in from the Wave 1 context note, confirmed by reading `db/schema.sql`.** `trace_proofs` has `source_label` and `source_url` but no `source_release`, `subject_id` or `object_id`, so a proof card cannot say which release of a source it came from, nor name the subject and object of the claim it is backing. Reproduce: `sqlite3 .nodetrace/nodetrace.sqlite '.schema trace_proofs'`, or read `public/nodetrace-state.json` — every proof row carries `sourceLabel`/`sourceUrl` and nothing else. Not user-visible today because no surface renders those fields; listed so Wave 2 does not rediscover it. | Open |
| D6 | Minor | J1 | ~~**Production dependency advisories, and they gate the repo's own prepush.**~~ **CLOSED, re-measured 2026-08-13** on a fresh `git clone --depth 20` of `main` at `3deb3a8`, Windows 11 / Node v22.22.2 / npm 10.9.7: `npm audit --omit=dev` exits **0** and prints `found 0 vulnerabilities`. Original reproduction, preserved: exit 1 with 4 advisories (2 high, 2 moderate), including GHSA-22jq-vg5j-6vgg in `ip-address` — IPv4-mapped/NAT64 misclassification that can bypass SSRF checks — and because `npm audit --omit=dev` is the last link in the `prepush` chain, that alone made `npm run check` red. What closed it: the `npm audit fix` lockfile bump recorded in `docs/SIMPLIFICATION_REPORT.md`, commit `633f1d6`, which moved `ip-address` 10.2.0 -> 10.5.0 and `hono` 4.12.25 -> 4.13.2 against advisory ranges `<=10.3.0` and `<=4.12.33`. The baseline row above still reproduces against the tree it describes: `npm audit --omit=dev --package-lock-only` over `8be0092`'s `package-lock.json` still prints all 4. Nothing here was fixed by this entry; the row was never re-run after the bump. | **Closed** (re-measured 2026-08-13) |
| D7 | Minor | J1, J3 | **Graph labels collide.** In the Live graph rail at 1280x900 in the happy-path state, `demo-artifact` and `workSurface.evidenceCarousel` overlap into unreadable text; at 375x812 `copilot.agentOperations` and `shell.status…` overlap. ForceAtlas2 places nodes without label-collision avoidance and the labels are not truncated. Visible in `happy-path-desktop-1280.png` and `happy-path-mobile-375.png`. | Open |
| D8 | Minor | J1 | **Nothing marks the missing Trace Coach.** Run only the README Happy Path (`npm install`, `npm run happy-path`, `npm run dev`) and load the page: `state.coach` is absent so `src/DemoDashboard.tsx:105` (`{coach && activeCoachStep ? (`) renders nothing between the hero and the graph rail, while the hero says "Coach steps **0**" and, one line below, "Seeded from real NodeRoom files, code-browser captures, selectors, DOMRects, running-app screenshots, and flow metadata" — a static string at `src/DemoDashboard.tsx:100` (`Seeded from real NodeRoom files`) that is rendered whether or not any of that is true. No empty state, and no pointer to `npm run trace-coach:sqlite`. | Open |
| D9 | **Critical** | proof pipeline | ~~**The capture script photographed a different checkout and reported PASS.**~~ **FIXED in iteration 3.** Reproduction, preserved and re-runnable as `npm run promotion:capture-identity`: with any other process holding 127.0.0.1:5187 — in the observed case a second NodeTrace checkout left running from an earlier session — `node scripts/capture-live-graph-rail.mjs` spawned `npm run dev`, which honours `vite.config.ts:9` (`port: 5187,`) **without `--strictPort`**, so vite moved to 5188 while the script kept fetching 5187. It then asserted only things true of any NodeTrace (`[data-testid="live-graph-rail"]` visible, `data-entity-count > 0`), printed `live graph rail capture: PASS (14 entities, 31 traversal edges)` — the *other* tree's counts, against this tree's real 10 / 15 — exited 0 and overwrote `docs/screenshots/live-graph-rail.png` with a picture of the other application. The evidence artifact was indistinguishable from a real one. `scripts/record-live-graph-rail.mjs` and `promotion/probes/j4-installed-target-proof.mjs` shared the hole; `--strictPort` alone does not close it, because when vite exits the foreign server still answers. | **Fixed** (iteration 3) |
| D10 | **Critical** | proof pipeline | ~~**The capture script photographed an empty canvas and reported PASS.**~~ **FIXED in iteration 4.** Found by the independent verifier of D9: the port fix held, and one of their three post-fix runs still wrote `docs/screenshots/live-graph-rail.png` with the node labels drawn, no node rings, no edges and Chromium's broken-image placeholder over the canvas box, while printing `live graph rail capture: PASS (10 entities, 15 traversal edges)`. Reproduction, preserved and re-runnable as `npm run promotion:capture-paint`: with the browser's WebGL contexts made to initialise and then draw nothing (`promotion/probes/lose-webgl-context.mjs`), the pre-fix `node scripts/capture-live-graph-rail.mjs` exits **0**, prints that same PASS line, and overwrites the artifact with a picture containing **0 coloured pixels** where a real one has 438 in 10 rings. Root cause: both checks it made were DOM checks — `data-entity-count` is React state and is right whether or not a pixel was drawn — and what followed them was `waitForTimeout(1_500)`, a sleep that cannot tell a settled graph from an empty one. It is not rare: the canvas came up dead on 7 of 14 loads here, because React StrictMode mounts the renderer, kills it and mounts it again, and the surviving instance is left with `isContextLost() === true`. `scripts/record-live-graph-rail.mjs` and `promotion/probes/j4-installed-target-proof.mjs` shared the hole, the latter with the same attribute-read-then-sleep. The committed `promotion/evidence/capture-identity-before-foreign-checkout.png` is empty in exactly this way. | **Fixed** (iteration 4) |

## Iterations

### Iteration 1 — 2026-08-13 — D2, the installed target could not build

- **Journey exercised:** J4 "Put it in the app I already have, without me
  hand-wiring it."

- **Observed (reproduced first, before any edit):** `npm run installer:next:e2e`
  on a fresh clone of `8004d9a`, Windows 11 / Node v22.22.2 / Next 15.5.23.
  Phases 1-3 pass (install 46.71s, happy path 1.13s, smoke 664ms); phase 4 fails
  after 31.37s with `./src/nodetrace/LiveGraphRail.tsx Module not found: Can't
  resolve '../../vendor/nodegraph-live/index.js'`, the same for `react.js`, and
  `Build failed because of webpack errors`. `docs/eval/nodetrace-next-e2e-smoke.json`
  recorded `ok: false` with `build.ok: false`. Exactly as the ledger describes.

- **Root cause, traced upstream rather than patched at the symptom.** The
  installer copies a hand-maintained list of paths — `bin/nodetrace.mjs:52-75`
  (`copyDir(join(packageRoot, "src", "trace")`).
  Anything the copied code reaches for *outside* that list resolves in this
  repository and nowhere else, and the target only discovers it at build time.
  Three distinct things were missing, and only the first was known:

  1. **A file that is imported was never copied.**
     `src/trace/LiveGraphRail.tsx:11-12` (`../../vendor/nodegraph-live/react.js`)
     imports the vendored renderer; nothing copied
     `vendor/`.
  2. **Packages that are imported were never declared.** The vendored renderer
     itself imports `sigma`, `graphology`, `graphology-layout-forceatlas2` and
     `@sigma/node-border`. `updatePackageJson` added only `better-sqlite3`,
     `lucide-react`, `react` and `react-dom`, so fixing (1) alone just moves the
     failure to `Can't resolve 'sigma'`. This is the same defect wearing a
     different hat: a second dependency list maintained by hand, next to the
     first one.
  3. **The generated Next page prerenders a browser-only renderer.** Once (1)
     and (2) were fixed the build compiled and then failed in *export*:
     `ReferenceError: WebGL2RenderingContext is not defined` while statically
     prerendering `/nodetrace`. This layer was invisible at baseline because the
     build never got far enough to reach it, and it cannot appear in this repo at
     all — the repo is Vite, which has no server render.

  Why the bug existed, in one sentence: **the installer's idea of "what NodeTrace
  is made of" was three hand-written lists that nothing checked against the code
  they were describing, and the repo's own green build could never disagree with
  them, because the repo has everything already.**

- **Fixed** (`bin/nodetrace.mjs`, no new dependency, no new abstraction):
  - `copyDir` now also ships `vendor/nodegraph-live/` into
    `<target>/src/nodetrace/vendor/nodegraph-live/`, and rewrites the import to
    `./vendor/nodegraph-live/` on the way, so the whole transplant stays inside
    the one directory the receipt already names.
  - `updatePackageJson` reads its version ranges from NodeTrace's own
    `package.json` (`withOwnRanges`) instead of a second list, and adds the four
    renderer packages. A missing range now throws at install time rather than
    shipping a target that cannot build.
  - The generated `/nodetrace` page loads the dashboard through
    `next/dynamic(..., { ssr: false })`. It fetches its state in an effect and
    draws with WebGL, so it had nothing to say on the server to begin with.

- **Re-proved in a real run and a real browser** —
  `node promotion/probes/j4-installed-target-proof.mjs` (`npm run promotion:j4`),
  which installs into a throwaway Next App Router app, runs the real `next
  build`, serves the built target with `next start` on 127.0.0.1:4302 and
  photographs `/nodetrace` in headless Chromium at 1280x900:
  - `promotion/evidence/j4-installed-next-target-1280.png` — the transplanted
    dashboard rendering inside a foreign Next application: hero, live sample
    card, and the Live graph rail drawing a real Sigma canvas.
  - `promotion/evidence/j4-installed-next-target.json` — all four installer
    phases `ok: true`, HTTP 200, `liveGraphRailPresent: true`, 10 entities /
    15 edges, 8 canvases, 0 console errors, 0 failed requests, 0 px horizontal
    overflow.
  This is the first time journey step 3 — "open `/nodetrace` in the target
  application" — has been reached at all; at baseline no target was ever built to
  open.

- **Regression check, confirmed failing before the fix.**
  `scripts/cli-smoke.mjs` now walks everything the installer copied and asserts
  every relative import resolves *inside the target*. Confirmed by stashing only
  `bin/nodetrace.mjs` back to `8004d9a` and re-running: `nodetrace cli smoke:
  FAIL`, exit 1, four issues — the two dangling imports in **both** the vite and
  the next target. Restored: `nodetrace cli smoke: PASS`, exit 0. It is a
  property check, not a check for this one file, so the next component added to
  `src/trace/` with an outside-the-copy import fails the smoke instead of the
  user's build; and it covers the vite target, which no suite built.
  `npm run installer:next:e2e` remains the end-to-end check and was red before
  and green after.

- **Tests:** `happy-path` 0, `smoke` 0 (3 suites, includes the new check),
  `builder:smoke` 0, `agent:scale:smoke` 0 (125 rows), `capture:plan:smoke` 0,
  `trace-coach:sqlite` 0, `installer:next:e2e` **0** (was 1), `build` 0
  (`tsc --noEmit` + vite build, 431.79 kB), `package:dry-run` 0 (111 files),
  `promotion:j4` 0. `npm audit --omit=dev` still exits 1 — that is D6, untouched
  and still open, so `npm run prepush` is still red at one of its ten members
  instead of two. *(Superseded: D6 closed later the same day, and `npm audit
  --omit=dev` now exits 0. See the second Correction below.)*

- **Conditions newly PASS:** 12. Conditions 1, 2 and 11 improve but do not pass:
  J1-J3 defects D1, D3, D4, D8 are still open, and `prepush` is still red at
  `npm audit`. *(Superseded for condition 11: `npm audit` is green and the whole
  `prepush` chain now exits 0. See the second Correction below.)*

- **Not fixed, and deliberately so:** the vite target is covered by the new
  import check but still has no end-to-end build proof in this repo; only the
  next target is built. Vite has no server render, so layer 3 cannot bite it,
  but that is reasoning, not a measurement.

### Iteration 2 — 2026-08-13 — J3's first prerequisite failed slowly, and in silence

- **Journey exercised:** J3 "Understand a codebase I did not write." Its first
  documented step is `npm run understand:noderoom`, which reads a NodeRoom
  checkout this repository does not contain.

- **Observed (reproduced first, before any edit).** An independent reader who had
  only this repository ran that command and watched it print nothing for minutes
  before failing. Reproduced here with the pre-fix script, a deliberately wrong
  `--source-root`, and a home directory holding no cached plugin: **12s wall
  clock, 0 bytes on stdout, exit 1** — and in those 12 seconds it had cloned
  `Egonex-AI/Understand-Anything` and run `pnpm install --frozen-lockfile` inside
  it. The cost is not bounded at 12s: a cold pnpm store adds the downloads and
  the `@understand-anything/core` build. None of that work could have helped,
  because the source root it was handed was already wrong.

- **Root cause, traced upstream rather than patched at the symptom.** Not a
  missing check — the check existed, in `selectTraceFiles`, and it produced the
  message the D3 row used to quote. It ran in the wrong order: `resolvePluginRoot` (which
  may clone) and `preparePlugin` (which installs and builds) sit at the top of
  the module, and the input those steps exist to serve was not read until after
  they had finished. The sibling script `scripts/capture-noderoom-real-assets.mjs`
  already validates its source root first and exits with one line; this script was
  the outlier.

- **Fixed** (`scripts/understand-anything-noderoom.mjs`, no new dependency, no new
  abstraction):
  - `requireNodeRoomSourceRoot` runs immediately after `--source-root` is
    resolved, before anything external is touched. It names the resolved path,
    how many of the six trace files are missing there, the first one, and the flag
    to pass — then exits 1 without a stack, the way `scripts/init-sqlite.mjs`
    already handles a missing native module.
  - The duplicate existence check inside `selectTraceFiles` is deleted. The rule
    is enforced once, at the earliest layer this script owns.
  - `runCommand` echoes `> pnpm install --frozen-lockfile` before it spawns. Every
    subprocess here is slow and has its output captured, so without that line the
    run is silent for as long as the slowest one takes.
  - `preparePlugin` announces the first-run install and build — the minutes-long
    step — and returns early when both are already present.

- **Re-proved by running it, both ways.** Wrong source root:
  `node scripts/understand-anything-noderoom.mjs --source-root <a directory that
  is not NodeRoom>` exits 1 in **142 ms** with the three-line message, and the
  bootstrap directory is never created — nothing was cloned. Right source root,
  against a real NodeRoom checkout: `understand-anything noderoom: PASS 6 trace
  files`, exit 0, 76s, with each of the three Understand-Anything scripts now
  visible as it runs. (Run with `--work`, `--graph-out` and `--json-out` pointed
  at a scratch directory, so the committed receipt still describes the committed
  run.)

- **Tests:** `npm run check` exit 0 in 249s, all eleven members — see the second
  Correction below.

- **Not fixed, and deliberately so:** D3's other half. The page still renders
  "full local checkout" for a snapshot (`src/DemoDashboard.tsx:138`
  (`sourceModeLabel`)), and this entry does not touch it.

### Iteration 3 — 2026-08-13 — D9, the capture script photographed a different checkout and called it PASS

- **Journey exercised:** none of J1-J4 directly. This is the pipeline every
  journey's proof runs through, which is why it is the worst place in the
  repository for a silent lie.

- **The human situation, before any jargon.** Somebody wants to know whether the
  live graph rail really works. They cannot watch it themselves, so they trust a
  screenshot and a line of output. A script starts the app, photographs the rail,
  and prints how many entities it saw. If that script photographs *a different
  copy of the app* — a second checkout the same person left running in another
  window — the screenshot still looks right, the counts still look plausible, and
  nothing anywhere says the picture is of the wrong tree. The reader ends up
  trusting a measurement of code they never changed.

- **Observed (reproduced first, before any edit), on this machine, in the wild.**
  Port 5187 was already held by a *second checkout of NodeTrace* from an earlier
  session (`…/scratchpad/wave3/coldread-NodeTrace`, pid 10652, serving its own
  Trace Coach state). In this clone, `node scripts/capture-live-graph-rail.mjs`
  printed:

      live graph rail capture: PASS (14 entities, 31 traversal edges -> docs/screenshots/live-graph-rail.png)

  exit **0**, and rewrote `docs/screenshots/live-graph-rail.png`
  (sha256 `9e77647176…` → `1ed894e78d…`). Independently measured on the same
  tree, at the same minute, on a port this process owned: **this checkout renders
  10 entities and 15 traversal edges**, and the state file the other server
  answered with (`sha256:003ed7d6e755…`, session `trace-coach-noderoom-sqlite`)
  is not the one on disk here (`sha256:9bb92d22ae06…`). The picture is committed
  as `promotion/evidence/capture-identity-before-foreign-checkout.png` — it says
  "14 entities · 31 of 31 relationships" and its node labels (`trace-coach`,
  `trace-tabs`, `workSurface.traceSteps`) belong to the other tree's state.

- **Root cause, traced upstream rather than patched at the symptom.** Three
  layers, all of which had to hold for the lie to be silent:
  1. `vite.config.ts:9` (`port: 5187,`) sets a default port, and the capture
     script spawned `npm run dev`, which honours it **without `--strictPort`**.
     Vite's documented behaviour when the port is busy is to take the next free
     one, printing a notice to a pipe nobody read. Our server went to 5188.
  2. The script then fetched `http://127.0.0.1:5187/` — the port it *asked* for,
     not the port it *got* — so every assertion after that point was measured
     against whatever else was listening.
  3. Every assertion it made (`[data-testid="live-graph-rail"]` visible,
     `data-entity-count > 0`) is true of any NodeTrace, including someone else's.
     Nothing asserted identity, so nothing could tell two checkouts apart.

  `--strictPort` alone does not close this. `scripts/record-live-graph-rail.mjs`
  already passed it and was still exposed: with the port busy, vite exits, and
  the script's `waitForServer` is answered by the foreign process instead. The
  guard has to be *"nothing else may hold this port"*, not *"our server must have
  this port or die"*.

- **Fixed at the seam all three callers route through** — one new module,
  `scripts/lib/proof-server.mjs`, replacing three copies of `waitForServer` and
  three of `killTree`:
  - `assertPortFree(port)` — bind it first; `EADDRINUSE` fails the run with a
    one-line message naming the port and the `NODETRACE_CAPTURE_PORT` escape
    hatch. Nothing external is started, no artifact is touched.
  - `startVite(port)` — always `--strictPort`, so our server owns the port it
    names or never starts.
  - `assertPageIsThisTree(page)` — the positive identity assertion, run before
    any artifact is written or any PASS is printed. `document.title` must be
    `NodeTrace`, and the `public/nodetrace-state.json` **the captured page itself
    fetched** must be byte-identical to the one on disk in this working tree.
    Title alone is useless here: the impostor was the same product, with the same
    title and the same testids. The state file carries a fresh millisecond
    timestamp from every `npm run happy-path`, so no other checkout can match it.
  - Callers: `scripts/capture-live-graph-rail.mjs` and
    `scripts/record-live-graph-rail.mjs` use all three;
    `promotion/probes/j4-installed-target-proof.mjs` takes `assertPortFree`,
    because it photographs an installed Next target on 4302 and had the same hole.

- **Re-proved by re-running the identical probe.** Same command, same machine,
  same foreign checkout still on 5187: `node scripts/capture-live-graph-rail.mjs`
  now exits **1** with *"port 5187 is already in use by another process —
  refusing to capture a page this checkout did not serve"*, and the artifact's
  sha256 is unchanged. With a port this process owns,
  `NODETRACE_CAPTURE_PORT=4702 node scripts/capture-live-graph-rail.mjs` exits 0:
  **`PASS (10 entities, 15 traversal edges)`** — this tree's real numbers, the
  same 10/15 the scorecard records for the happy-path state — and the picture,
  committed as `promotion/evidence/capture-identity-after-this-checkout.png`,
  shows this checkout's nodes (`nodetrace`, `schema`, `state`, `events`,
  `workSurface.evidenceCarousel`).

- **Regression check, and it was confirmed failing on the pre-fix tree.**
  `npm run promotion:capture-identity` runs
  `promotion/probes/capture-identity-regression.mjs`, which puts an impostor on
  the capture port — same title, same testid, `data-entity-count="4242"` — runs
  the real capture script against it, and requires a nonzero exit and an
  untouched artifact. Second phase, because a layer nobody watched run is a layer
  nobody has proved: it drives a real browser at the impostor and at a server
  started from this tree, and requires `assertPageIsThisTree` to throw on the
  first and pass on the second. Confirmed both ways by stashing **only** the
  three source edits and re-running: pre-fix **FAIL** (`exit 0`, `PASS (14
  entities, 31 traversal edges)`, artifact rewritten) — committed verbatim as
  `promotion/evidence/capture-identity-regression-prefix.json`; post-fix **PASS**
  — `promotion/evidence/capture-identity-regression.json`, which also records the
  identity assertion rejecting the impostor on a sha mismatch and accepting this
  tree.

- **Tests:** `npm run citations:check` exit 0, `npm run smoke` exit 0,
  `npm run build` exit 0. `npm run promotion:capture-identity` exit 0.

- **One mistake in this iteration, recorded rather than quietly fixed.** The
  first commit (`5a9345f`) shipped `promotion/evidence/capture-identity-regression.json`
  with `ok: false` — byte-identical to the `-prefix.json` beside it. The pre-fix
  run writes to the same path; it was copied to `-prefix.json` and never
  regenerated. Caught by reading the file back from the remote with
  `gh api …/contents/…`, not by trusting the push. Corrected in `a83bd29` by
  re-running the probe. The lesson is the same one this iteration is about: an
  evidence file is a claim until somebody re-reads it.

- **What this does NOT overturn.** The committed
  `docs/screenshots/live-graph-rail.png` at `062b19b` was checked against this
  finding and is genuine: it shows 10 entities / 15 relationships with this
  tree's node labels, which is what a correct capture of the happy-path state
  produces. No committed evidence in this repository is known to be foreign. The
  defect is that nothing *prevented* it, and for one run on 2026-08-13 nothing did.

### Iteration 4 — 2026-08-14 — D10, the capture script photographed an empty canvas and called it PASS

- **Journey exercised:** the proof pipeline, the same one D9 lives in. Found by
  the independent verifier of iteration 3: the port fix held, and one of their
  three post-fix runs still produced a screenshot with no graph in it.

- **The human situation, before any jargon.** Somebody wants to know whether the
  live graph rail really works, and they are looking at a screenshot because they
  cannot watch it themselves. The graph is drawn by the graphics card, on a
  canvas; the numbers beside it ("10 entities") are ordinary web page text. Those
  two can come apart. When the graphics context dies, the text stays exactly
  right and the canvas goes blank — so the script reads "10 entities", sleeps a
  second and a half for the layout to settle, photographs a white rectangle, and
  prints PASS. The reader sees numbers that match, a picture with nothing in it,
  and no reason to think the two disagree.

- **Observed (reproduced first, before any edit).** With the WebGL contexts made
  to initialise and then draw nothing — the injector at
  `promotion/probes/lose-webgl-context.mjs`, so the script under test is the one
  that ships — the pre-fix capture printed:

      live graph rail capture: PASS (10 entities, 15 traversal edges -> docs/screenshots/live-graph-rail.png)

  exit **0**, and overwrote the artifact with a picture containing **0 coloured
  pixels**: the labels drawn, no node rings, no edges. A real capture of the same
  state has 438 coloured pixels in exactly 10 rings. The committed
  `promotion/evidence/capture-identity-before-foreign-checkout.png` — kept in
  iteration 3 as the picture of the *wrong tree* — is empty in the same way, and
  is now also the exhibit for this defect: it has 0 coloured pixels and Chromium's
  broken-image placeholder in the corner of the canvas box.

- **How often it happens for real, measured rather than assumed.** Loading the
  dashboard 14 times in headless Chromium, the graph canvas came up dead **7
  times**. React StrictMode mounts the renderer, kills it and mounts it again,
  and that WebGL churn leaves the surviving instance with
  `isContextLost() === true` about half the time on this machine. Of the 8 loads
  allowed to reload, all 8 painted — 3 after exactly one reload, none needing a
  second.

- **Root cause, traced upstream rather than patched at the symptom.** Two layers:
  1. Both checks the script made are DOM checks. `data-entity-count` is React
     state, set from the trace events; it is right whether or not a pixel was
     ever drawn. The rail element is visible for the same reason.
  2. What followed the checks was `waitForTimeout(1_500)` — a sleep, chosen to
     out-wait ForceAtlas2 (`settleMs(10)` = 1020 ms). A sleep cannot distinguish
     a settled graph from an empty one; nothing in the script ever looked at the
     canvas.

- **Fixed, once, at the seam all three callers already route through.**
  `waitForPaintedGraph` in `scripts/lib/proof-server.mjs` screenshots the canvas
  box and counts the node rings *in the pixels*: they are the only coloured ink
  there, since labels are near-black and the edges and dot grid are grey. It
  waits for painted **and still** — the same rings in the same places two polls
  apart — which is the condition the 1500 ms sleep was guessing at, and it
  reloads the page up to twice when the canvas is dead, because that is measured
  to recover it. The three callers the scan found now use it:
  `scripts/capture-live-graph-rail.mjs`, `scripts/record-live-graph-rail.mjs` and
  `promotion/probes/j4-installed-target-proof.mjs`. The recorder gets its click
  targets from the same read — the ring centres — which deleted its
  label-pixel-clustering block: whatever is painted is what is clickable.

- **Re-proved.** `NODETRACE_CAPTURE_PORT=4803 node scripts/capture-live-graph-rail.mjs`
  exits 0 and prints `PASS (10 entities, 15 traversal edges, 10 node rings
  painted)`; the artifact it wrote, decoded, has 438 coloured pixels in 10 rings.
  `npm run record:live-graph` exits 0 with `10 node rings painted, node readout
  shown`. `npm run promotion:j4` exits 0 after 111 s and its report now carries
  `"paintedNodes": 10` beside `"entities": "10"` — read off the canvas, not out
  of the attribute.

- **Regression check, and it was confirmed failing on the pre-fix tree.**
  `npm run promotion:capture-paint` runs `promotion/probes/capture-paint-regression.mjs`:
  it **finds** the scripts that photograph the rail rather than consulting a list
  of them (any `.mjs` under `scripts/` or `promotion/probes/` that names the rail
  and writes a screenshot file or a video must call the gate), then runs the real
  capture script twice — once against the drawing-nothing browser, which must
  exit nonzero and leave the artifact byte-identical, and once untouched, which
  must exit 0 and report painted rings. A list would have missed
  `promotion/probes/j4-installed-target-proof.mjs`; the scan named it. Confirmed
  by stashing **only** the four source edits and re-running: pre-fix **FAIL**
  with seven issues — three ungated photographers, `exit 0`, `PASS (10 entities,
  15 traversal edges)` over an empty canvas, the artifact rewritten, and 0 rings
  reported on the healthy run — then post-fix **PASS**
  (`promotion/evidence/capture-paint-regression.json`).

- **Tests:** `npm run promotion:capture-paint` exit 0,
  `npm run promotion:capture-identity` exit 0 (iteration 3's gate still holds),
  `npm run promotion:j4` exit 0, `npm run smoke` exit 0,
  `npm run citations:check` exit 0, `npm run build` exit 0.

- **What this overturns.** Iteration 3 said of the foreign-checkout picture only
  that it belongs to another tree. It is also empty, and nothing in this
  repository could tell an empty picture from a full one until now. Every capture
  taken before this iteration was gated on numbers alone.

## Correction — 2026-08-13

Someone who did not run the baseline — a reviewer, an auditor, the next agent
picking this up cold — has to be able to check a claim without taking anyone's
word for it. That means they need two things for every number on the scorecard:
the recorded result, and the tool that produced it, both sitting in the
repository they just cloned. The baseline published three passing rows that
carried neither. Conditions 4, 9 and 10 stated their numbers in the reason
column and pointed at nothing: no screenshot, no JSON, no script. The commands
that measured them were written to a scratch directory outside the clone and
thrown away afterwards, so nobody — including the author — can run them again.
In gate terms, a measurement whose producer was not retained is **UNVERIFIED**,
never PASS: the measurement was real, the evidence is not. **Put plainly: a
number you cannot hand someone the means to re-check is a claim, not a result,
and it does not earn a pass.**

An adversarial re-run against the pushed tree confirmed 0 of the 3 PASS rows.
What changed, and why:

| Condition | Was | Now | Why |
|---|---|---|---|
| 4 — no horizontal overflow | PASS | UNVERIFIED | Claimed `scrollWidth - clientWidth` = 0 at 360/375/414/768/1024/1280/1440 px in two states — fourteen measurements — with no capture, no JSON and no script. Measured 0 overflow at those widths; sweep probe not retained. One of the fourteen is corroborated by the committed `happy-path-mobile-375.png` and `trace-coach-mobile-375.png`, which do show a clean single column at 375 px. Two screenshots are not a seven-width two-state sweep. |
| 9 — no unexplained console errors or failed requests | PASS | UNVERIFIED | Claimed 0 console errors, 0 `pageerror`, 0 failed requests, 0 HTTP >= 400 with nothing attached. Measured those zeroes across both states and the J1/J2/J3 drive; console and network probe not retained. Downgraded to UNVERIFIED rather than FAIL because nothing observed contradicted the zeroes — the failure is missing evidence, not a missed defect. |
| 10 — performance does not obstruct interaction | PASS | UNVERIFIED | Claimed DOMContentLoaded 290 ms / load 292 ms and 414 ms / 416 ms with nothing attached. Measured those timings on the two seeded states; navigation-timing probe not retained. |

**Scorecard: 3/12 PASS -> 0/12 PASS.** PASS none; FAIL 1, 2, 3, 5, 6, 11;
UNVERIFIED 4, 7, 8, 9, 10, 12.

Also corrected, and not part of the three rows:

- `npm run package:dry-run` was recorded as "0 | 112 files". Re-run on a fresh
  `git clone --depth 5` of `main`: exit 0, `total files: 111`. The exit code
  reproduces; the count does not. The count was taken from a working tree that
  had been used to run the whole suite, so it described that tree rather than
  the repository. Recorded as 111 above, with the original figure kept visible.
- The evidence row for the Playwright drives named a command whose filename was
  an ellipsis — `node promotion/... playwright drives`. A path nobody can type
  is not a command. It is now written out as what it actually was: three
  throwaway drives, not retained.

Nothing else moved. The six FAIL rows and the eight-entry defect ledger were
re-checked and reproduce as written; condition 7's refusal to count ad-hoc
observations as a Web Interface Guidelines review stands, and is the same rule
that produced these three downgrades. No product code was touched: this
correction changes what the scorecard claims, not what the application does.

What Wave 2 owes as a result: if conditions 4, 9 and 10 are to pass, they need
committed probes under `promotion/` writing committed output under
`promotion/evidence/` — an overflow sweep across the seven widths in both
seeded states, a console-and-network log across the J1/J2/J3 drive, and a
navigation-timing capture. Re-measuring without committing the tool would
reproduce exactly the failure this entry records.

## Correction — 2026-08-13, second

An independent reader who had never seen this repository ran it cold and traced
it end to end. They found three things wrong. One was a product defect, fixed in
iteration 2 above. **Two were this file describing a repository that no longer
exists** — which is the failure a promotion log is supposed to be immune to.

**1. D6 was fixed and this ledger never noticed.** The row said `npm audit
--omit=dev` exits 1 with 4 advisories, and that this alone kept `npm run check`
red. Re-run on a fresh `git clone --depth 20` of `main` at `3deb3a8`, Windows 11
/ Node v22.22.2 / npm 10.9.7: **exit 0, `found 0 vulnerabilities`.** Nothing in
this entry fixed it — commit `633f1d6` ran `npm audit fix`, moving `ip-address`
10.2.0 -> 10.5.0 and `hono` 4.12.25 -> 4.13.2 past the advisory ranges `<=10.3.0`
and `<=4.12.33`, and `docs/SIMPLIFICATION_REPORT.md` recorded that while this
ledger did not. The baseline row above is not wrong: `npm audit --omit=dev
--package-lock-only` over `8be0092`'s lockfile still prints all 4, so the
baseline still reproduces against the tree it describes. Only the open/closed
status was stale. Consequence: condition 11 in [PRODUCT_GOAL.md](PRODUCT_GOAL.md)
moves FAIL -> PASS and the scorecard reads 2/12.

**2. A citation named a helper that had been inlined away.** D1's root-cause
sentence cited `TraceLensPanel.tsx` doing `surfaceMeta(state.surfaces,
hit.surfaceId)`. The line range was still right; the symbol has not existed since
that lookup was inlined to `src/trace/TraceLensPanel.tsx:16-18`
(`state.surfaces.find`). A reader who opened the file to check the claim found no
such function, and no way to tell whether the defect had been fixed or the note
had rotted.

**Why nothing caught it, and what does now.** `npm run tours:check` verified the
three `.tours/` walkthroughs and nothing else: markdown citations were unchecked,
and the command was not in `prepush`. Both are fixed, and the mechanism is the
part worth copying — **a citation is checked against the text of the line it
names, never against the line number alone.** A line number that is merely in
range proves only that the file still has that many lines, which is exactly what
a rotted citation looks like.

- `scripts/tours-check.mjs` is now `scripts/citations-check.mjs`, run as
  `npm run citations:check`, and it is the third member of `prepush`.
- Every `path:line` in a markdown file here must be followed by the anchor that
  line contains, as `` `src/trace/TraceLensPanel.tsx:17` (`state.surfaces.find`) ``.
  The checker resolves the path, reads the cited lines, and fails when the anchor
  is not in them.
- Two forms that cannot be checked are rejected outright: prose line numbers
  ("the `useEffect` at line N", which names no file) and comma lists
  (**panel.tsx:73,91,99**, which the parser cannot resolve).
- Proved by knockout, both halves. Moving D1's citation to **21-23** — a range
  that exists in the file — fails with *"does not contain state.surfaces.find"*.
  Hand-editing a `.tours/` step's line from 17 to 19 fails with *"is out of
  date"*. Both restored; both green after.

**What the guard found that the reader had not.** It parsed 36 citations across
8 markdown files. Two more claims were wrong. **bin/nodetrace.mjs:48**, cited
twice as the installer's hand-maintained copy list, is a blank line — the list is
`bin/nodetrace.mjs:52-75` (`copyDir(join(packageRoot, "src", "trace")`). And
**TraceLensPanel.tsx:73,91,99** in [PRODUCT_GOAL.md](PRODUCT_GOAL.md) named the
`) : (` line above each `nt-empty` row rather than the rows themselves. Nine of
the 36 named a bare basename (**DemoDashboard.tsx:52**) that resolves to no file
from the repository root; they are written as full paths now, so a reader can
paste one into an editor and land on the line. All 62 citations this repository
now contains carry an anchor and are checked on every `npm run check`.

Nothing else moved. No product behaviour changed in this correction; the
iteration-2 script change is the only executable difference. The open rows of the
defect ledger (D1, D3, D4, D5, D7, D8) were re-read for stale citations and left
standing — they were **not** re-driven in a browser for this entry, so nothing
here is new evidence for or against them.
