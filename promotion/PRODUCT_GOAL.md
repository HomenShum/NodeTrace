# Product goal — NodeTrace

## Who opens this, and what they are trying to finish

Someone is looking at a screen their software just produced — a panel, a card, a
strip of activity — and they need to know where it came from. Not "roughly which
feature", but: which file wrote it, what evidence backed it, what the machine did
in what order, and how sure it was. Today that answer lives in a log file they
would have to go read, and if they are a reviewer, an auditor, or a new teammate,
they may not be able to read it at all. Someone who *can* read it ends up
narrating the code to everyone who cannot.

The person who opens NodeTrace is the engineer who is tired of being that
narrator. They already have an application, and it already records what it does.
What they do not have is a way to let a person point at a thing on screen and get
the provenance back — the source, the confidence, the ordered steps — without
handing that person the repository. They arrive wanting to add that pointing
gesture to their own app in an afternoon, and they arrive suspicious, because
tools in this space usually demand a cloud account and an API key before they
will show you anything at all.

What they walk away holding, when it worked, is two things. First, proof they
watched with their own eyes: a running local page where holding Ctrl and clicking
a region opens a panel naming the source file, the evidence card, the confidence,
and the ordered runtime events behind that exact region — with no key, no
account, and no network. Second, the transplant: the same behaviour running
inside their own application, because a single command copied the components in,
wired a local database, and left a receipt saying it worked. The technical shape
of that is a portable React "Trace Lens" over a local SQLite trace schema
(`db/schema.sql`), installed by `npx github:HomenShum/NodeTrace add`. The point,
in one sentence a stranger can carry away: **NodeTrace lets a person click on a
thing an application drew and be told, on the spot and with sources, what
produced it.**

## The gate

This repo is judged by the twelve-condition PROMOTION gate, which lives in one
place and is not restated here:

**https://github.com/HomenShum/NodeKit/blob/main/templates/promotion/GATE.md**

Gate variant: `reduced` <!-- reduced = library/CLI judged on its demo
surface and quickstart; see the GATE's reduced-gate section -->

Scoring vocabulary is PASS / FAIL / **UNVERIFIED**, and UNVERIFIED is never PASS.

## Canonical journeys

The work queue lives in [PRODUCT_JOURNEYS.md](PRODUCT_JOURNEYS.md). A journey
without browser evidence is unfinished, however green the tests are.

## Loop state

Every iteration is recorded in [PROMOTION_LOG.md](PROMOTION_LOG.md) — journey
exercised, defect fixed, evidence path, conditions newly passing. Loop state
lives in git, never in an agent's memory, so any agent can resume the loop cold.

## Current scorecard

Scored 2026-08-13 against commit `8be0092`, in headless Chromium via Playwright
1.61 against `npm run dev` on `http://127.0.0.1:5187/`, on Windows 11 / Node
v22.22.2. Screenshots referenced below are in `promotion/evidence/`.

**Updated 2026-08-13 after iteration 1** (D2 fixed; see
[PROMOTION_LOG.md](PROMOTION_LOG.md)). Rows 1, 2, 11 and 12 moved. Only row 12
changed status, to PASS, and only because both halves of the artifact rule hold:
`promotion/probes/j4-installed-target-proof.mjs` is committed and re-runnable,
and it writes the committed `promotion/evidence/j4-installed-next-target-1280.png`
and `promotion/evidence/j4-installed-next-target.json`.

**Corrected 2026-08-13** after an adversarial re-run. A row may only be PASS
when both halves of the artifact rule hold: the output is committed at a path
this row names, *and* the script that produced it is committed and re-runnable
by someone who just cloned the repo. Three rows (4, 9, 10) cited numbers in
prose with neither half committed — the probes that produced them were
throwaway and were not retained — so they are now UNVERIFIED. The measurements
were real; the evidence is not. See the Correction section of
[PROMOTION_LOG.md](PROMOTION_LOG.md).

**Updated 2026-08-14 after iteration 5.** Rows 3, 4, 5, 6, 7, 8, 9 and 10 were
re-measured on a fresh clone at `78d7f2c`, Windows 11 / Node v22.22.2, served by
`vite preview` over `dist/` on `http://127.0.0.1:4910/`. Every row on this
scorecard is now PASS or FAIL; **none is UNVERIFIED**. The rows that moved, and
which way, are listed under the status line below.

| # | Condition | Status | Evidence / reason |
|---|-----------|--------|-------------------|
| 1 | Journeys succeed end-to-end in a real browser | FAIL | J1, J2 and now **J4** drive to completion (`happy-path-desktop-1280.png`, `j2-lens-tracestrip-desktop.png`, `j4-installed-next-target-1280.png`). J3 still reaches its screen only through an undocumented snapshot fallback — both prerequisite commands the README names fail (`npm run understand:noderoom` exit 1, `npm run capture:noderoom:real` exit 1). Defects D1, D3, D4 in PROMOTION_LOG.md. |
| 2 | No critical or major usability defect open | FAIL | Three majors still open with reproductions: D1 the header surface is a silent no-op on Ctrl-click, D3 the UI claims a "full local checkout" the receipt calls `"snapshot"`, D4 the Trace Lens has no keyboard or touch path. D2 (the installed target could not build) is fixed in iteration 1. See the defect ledger. |
| 3 | Mobile and desktop both intentional | FAIL | Layout is genuinely responsive — single column at 375px, zero overflow, now measured with a committed probe (row 4). But the product's only interaction is `metaKey/ctrlKey`-modified mouse click (`src/trace/TraceLensProvider.tsx:58` (`event.metaKey \|\| event.ctrlKey`)), which a touch device cannot produce. Tapping a tagged surface under Chromium touch emulation (375x812, `hasTouch`, `isMobile`) leaves the panel closed and shows no affordance: `j2-mobile-tap-no-lens.png`. New in this iteration, with a committed producer: at 375 px **6 of 12 controls are under the 44 px touch minimum** — all four coach tabs at 33 px high, `button "fit"` at 28x22, the rail's checkbox at 13x13 (`promotion/evidence/wig-review.json`, `measurements.hitTargets`, from `npm run promotion:wig`). Mobile is reflowed, not designed. |
| 4 | No horizontal overflow at supported widths | **PASS** | Re-measured 2026-08-14 with a committed probe, which is what the row was missing. `npm run promotion:sweep` (`promotion/probes/surface-sweep.mjs`) writes `promotion/evidence/surface-sweep.json`: `documentElement.scrollWidth - clientWidth` is **0 px at 360, 375, 414, 768, 1024, 1280, 1440 and 2560 px, in both seeded states, and again at all eight widths with the Trace Lens dialog open** — 32 measurements, max overflow 0. The eighth width and the dialog pass are new: the guidelines ask for ultra-wide, and a dialog is the usual way a page starts overflowing. Was UNVERIFIED: the same zeroes were measured at baseline by a throwaway script that no third party could re-run. |
| 5 | Loading/empty/success/error/agent-running designed | FAIL | Success and locked states are deliberate (`nt-locked` code-ownership notice, `nt-empty` rows in `src/trace/TraceLensPanel.tsx:74-100` (`nt-empty nt-locked`)), and a loading seed exists (`src/DemoDashboard.tsx:8-21` (`const seedState: NodeTraceState = {`)). The empty state is not: after the README's own Happy Path, `state.coach` is absent, so `src/DemoDashboard.tsx:105` (`{coach && activeCoachStep ? (`) renders **nothing at all** where the Trace Coach belongs — while the hero above it simultaneously reads "Coach steps 0" and "Seeded from real NodeRoom files, code-browser captures, selectors, DOMRects, running-app screenshots". Nothing tells the reader to run `npm run trace-coach:sqlite`. Still FAIL, but no longer on prose: `npm run promotion:wig` measures the gap at **18 px between hero and rail with no coach panel in the DOM** and captures it as `promotion/evidence/wig-happy-path-empty-coach-slot.png` (finding M7, `content.all-states-designed`). Also `happy-path-desktop-1280.png`. |
| 6 | Keyboard and basic accessibility pass | FAIL | Observed in the rendered page at baseline, and re-measured 2026-08-14 with two committed producers. Keyboard, from `npm run promotion:wig`: **0 of 12 focusable elements open the Trace Lens on Enter**, 40 Tab presses (13 distinct stops) never reach an opener; with the panel open, `src/trace/TraceLensPanel.tsx:28` (`role="dialog"`) carries no `aria-modal`, focus stays on `<body>`, and **4 of the next 6 Tabs land behind the panel**; 4 elements carry `role="tab"` with **0 `role="tabpanel"` and 0 `aria-controls`**; headings run **h1 → h3**, 0 skip links. Machine-checkable a11y, from `npm run promotion:web-quality`: axe-core 4.13.0 reports **`color-contrast` (serious) on 6 nodes in the happy-path state and 19 in the trace-coach state**, plus `heading-order` (moderate) in both; Lighthouse accessibility 0.92 / 0.95. Evidence: `promotion/evidence/wig-review.json`, `axe-happy-path.json`, `axe-trace-coach.json`, `a11y-lens-open-focus.png`. |
| 7 | Web Interface Guidelines: no major unresolved | **FAIL** | Review performed 2026-08-14 against Vercel's Web Interface Guidelines, fetched live from `https://vercel.com/design/guidelines` (HTTP 200) and kept verbatim at `promotion/evidence/web-interface-guidelines.txt`. **7 major findings of 17 checks**: no keyboard path into the product's only flow; a dialog that leaves focus behind it; a 407803 px² tagged region that swallows clicks; tabs, active step and open panel all `useState` with nothing in the URL; `role="tab"` with no tabpanel; four text styles at 2.48–3.81:1; and a screen that renders nothing where the Trace Coach belongs. Write-up: [WIG_REVIEW.md](WIG_REVIEW.md). Producer `promotion/probes/wig-review.mjs` (`npm run promotion:wig`), output `promotion/evidence/wig-review.json` plus three captures — both halves committed. **This is a review, not an audit**: six of the seven majors are reported by neither Lighthouse nor axe — for the same page and state those tools name exactly two problems, `color-contrast` and `heading-order` — and no Lighthouse number was used to reach any WIG finding. Was UNVERIFIED (no review had been run). |
| 8 | Web-quality audit: no major unresolved | **FAIL** | Audit run 2026-08-14 against the built bundle (`vite preview` over `dist/`) in both seeded states, by `npm run promotion:web-quality` (`promotion/probes/web-quality-audit.mjs`). Lighthouse 13.4.1: performance **0.80 / 0.81**, accessibility **0.92 / 0.95**, best-practices **1.00 / 1.00**; Core Web Vitals LCP **2158 ms**, CLS **0.000**, TBT **774 ms / 687 ms**. axe-core 4.13.0: **2 violations in each state**, `color-contrast` (serious) on **6** then **19** nodes and `heading-order` (moderate). **4 major findings**: the serious contrast violation in both states, and TBT over the 600 ms threshold in both. Committed output: `promotion/evidence/lighthouse-happy-path.json`, `lighthouse-trace-coach.json`, `axe-happy-path.json`, `axe-trace-coach.json`, and the summary `web-quality-audit.json`, which carries the exact command lines. Was UNVERIFIED ("installing an audit toolchain was out of scope"); both toolchains are pinned in the probe and installed on demand by npx. |
| 9 | No unexplained console errors or failed requests | **PASS** | Re-measured 2026-08-14 with a committed probe. `npm run promotion:sweep` drives J1 (load + painted rail), J2 (Ctrl-click the lens, read it, Escape) and J3 (all four coach tabs) in both seeded states while recording every console message, `pageerror`, failed request and HTTP >= 400: **0 unexplained console errors or warnings, 0 page errors, 0 failed requests, 0 HTTP >= 400** in both states. The only console output is 4 warnings per state, all matching one explained pattern carried in the probe with its reason — `GL Driver Message … GPU stall due to ReadPixels` from Sigma's renderer, a driver performance notice that self-silences after the fourth. Anything not matching an explained pattern fails the run, so the allowlist cannot quietly grow. Output `promotion/evidence/surface-sweep.json`. Was UNVERIFIED: the same zeroes were measured at baseline by a probe that was not retained. |
| 10 | Performance does not obstruct interaction | **PASS** | Re-measured 2026-08-14 with a committed probe, on the surface where interaction exists. `npm run promotion:sweep` records, per state: DOMContentLoaded **216 ms / 257 ms**, longest single main-thread task during load **74 ms / 67 ms** (2 long tasks, 146 ms / 125 ms total), Ctrl-click to panel visible **77 ms / 76 ms**, tab click to pane visible **72 ms** — every interaction an order of magnitude inside the 200 ms the probe fails at. **The counter-measurement, recorded rather than hidden:** condition 8's Lighthouse run reports TBT 774 ms / 687 ms and calls it major. Both are true and they are not in conflict — Lighthouse's default emulation is a mid-tier mobile device with 4x CPU throttling, and this row is measured unthrottled on the desktop surface. It is scored PASS because on that surface interaction is measurably not obstructed, and because on touch there is no interaction to obstruct at all (condition 3: the lens has no touch path). If emulated mid-tier mobile is later declared a supported device, this row should be re-scored against condition 8's number. Output `promotion/evidence/surface-sweep.json`. Was UNVERIFIED: the baseline's timing probe was not retained. |
| 11 | Tests and build green | **PASS** | Re-measured 2026-08-13 on a fresh `git clone --depth 20` of `main` at `3deb3a8`, Windows 11 / Node v22.22.2 / npm 10.9.7: `npm run check` (aliased `npm run prepush`) **exits 0 end to end in 249s**, all eleven members green, including the last one that used to be red — `npm audit --omit=dev`, now `found 0 vulnerabilities` (D6, closed by the `npm audit fix` lockfile bump in `633f1d6`). Its receipts are committed under `docs/eval/`, and the producer is `npm run check` itself, in `package.json`, re-runnable from a fresh clone. Was FAIL: the gate was red at **one** of its ten members, `npm audit --omit=dev` exiting 1 with 4 production advisories (2 high, 2 moderate) including GHSA-22jq-vg5j-6vgg in `ip-address`. |
| 12 | Verified in the rendered app, not inferred from code | **PASS** | Iteration 1 fixed D2 and re-proved it by *running the installed application*, not by reading the diff: `promotion/probes/j4-installed-target-proof.mjs` installs NodeTrace into a throwaway Next App Router app, runs the real `next build`, serves the built output with `next start` on 127.0.0.1:4302 and photographs `/nodetrace` in headless Chromium. Output `promotion/evidence/j4-installed-next-target-1280.png` (the dashboard and a live Sigma canvas rendering inside a foreign application) and `promotion/evidence/j4-installed-next-target.json` (four installer phases ok, HTTP 200, 10 entities / 15 edges, 0 console errors, 0 failed requests). Producer and output are both committed and re-runnable from a fresh clone as `npm run promotion:j4`. |

**Status: NOT PROMOTED** — 5/12 PASS.

PASS: 4, 9, 10, 11, 12. FAIL: 1, 2, 3, 5, 6, 7, 8. UNVERIFIED: none.

**Iteration 5 — 2026-08-14 — every remaining UNVERIFIED row is now observed.**
Five rows move, in both directions, and the direction is the point: 4, 9 and 10
UNVERIFIED -> PASS because the probes the 2026-08-13 Correction said Wave 2 owed
are now written, committed and re-runnable; 7 and 8 UNVERIFIED -> **FAIL**
because the reviews they name were finally run and the product failed them.
A gate that only ever moves rows upward is not measuring anything. Nothing in
the product was changed in this iteration: it is a measurement pass, and a
measurement pass that repairs what it finds cannot be re-run against the tree it
described. Producers and outputs, all committed and runnable from a fresh clone:

| Command | Producer | Output | Rows |
|---|---|---|---|
| `npm run promotion:sweep` | `promotion/probes/surface-sweep.mjs` | `promotion/evidence/surface-sweep.json` | 4, 9, 10 |
| `npm run promotion:wig` | `promotion/probes/wig-review.mjs` | `promotion/evidence/wig-review.json` + 3 PNGs, write-up [WIG_REVIEW.md](WIG_REVIEW.md) | 7, and evidence for 3, 5, 6 |
| `npm run promotion:web-quality` | `promotion/probes/web-quality-audit.mjs` | `lighthouse-*.json`, `axe-*.json`, `web-quality-audit.json` | 8, and evidence for 6 |

(Was recorded as 3/12 on 2026-08-13 with 4, 9 and 10 PASS; corrected the same
day to 0/12 when a re-run found no committed producer or output behind any of
them. Iteration 1, the same day, earned 12 with both halves committed. Condition
11 followed on re-measurement: the gate's last red member had been fixed in
`633f1d6` and nothing re-ran it — see the second Correction in
[PROMOTION_LOG.md](PROMOTION_LOG.md).)

**Iteration 3 — 2026-08-13 — no row moves, and that is the honest answer.**
Every capture script in this repository could photograph a *different checkout*
of this same application and report PASS with that other tree's numbers (D9,
fixed in iteration 3). The capture scripts and `promotion/probes/j4-installed-target-proof.mjs`
now refuse a port they do not own, and the two rail scripts additionally require
the captured page to have loaded this tree's own `public/nodetrace-state.json`
before any artifact is written. This makes the evidence behind rows 4, 9, 10 and
12 *harder to fake*; it does not add evidence, so no status changes. The
committed `docs/screenshots/live-graph-rail.png` was checked against the finding
and is genuine (10 entities / 15 relationships, this tree's node labels). New
producer and outputs, both committed and re-runnable from a fresh clone as
`npm run promotion:capture-identity`: `promotion/probes/capture-identity-regression.mjs`,
`promotion/evidence/capture-identity-regression.json` (post-fix) and
`promotion/evidence/capture-identity-regression-prefix.json` (the same probe on
the pre-fix tree, `ok: false`).

**Iteration 4 — 2026-08-14 — no row moves either, for the same reason.** The
capture scripts checked the rail's numbers and then slept for the layout, so a
graph canvas that never painted was photographed and reported as PASS — the
numbers are React state and stay right through a dead WebGL context (D10, found
by the verifier of D9 and fixed in iteration 4). All three scripts that
photograph the rail now count the node rings in the pixels before anything is
written. Again this makes the evidence harder to fake rather than adding any, so
no status changes; what it does change is that `docs/screenshots/live-graph-rail.png`
and `promotion/evidence/j4-installed-next-target-1280.png` are now regenerated
by runs that reported 10 painted rings, not 10 counted entities. New producer and
outputs, committed and re-runnable as `npm run promotion:capture-paint`:
`promotion/probes/capture-paint-regression.mjs`,
`promotion/evidence/capture-paint-regression.json` (post-fix) and
`promotion/evidence/capture-paint-regression-prefix.json` (the same probe on the
pre-fix tree, `ok: false`, seven issues).

Iteration 1 also measured, inside the installed Next target only, 0 px of
horizontal overflow at 1280 px and 0 console errors / 0 failed requests — both
with a committed producer and committed output. Conditions 4 and 9 stay
UNVERIFIED anyway: 4 asks for a seven-width two-state sweep of this product's own
surfaces and 9 asks for the whole J1/J2/J3 drive, and one width on one page of a
different application is neither.
