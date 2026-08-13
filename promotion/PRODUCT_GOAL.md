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

| # | Condition | Status | Evidence / reason |
|---|-----------|--------|-------------------|
| 1 | Journeys succeed end-to-end in a real browser | FAIL | J1, J2 and now **J4** drive to completion (`happy-path-desktop-1280.png`, `j2-lens-tracestrip-desktop.png`, `j4-installed-next-target-1280.png`). J3 still reaches its screen only through an undocumented snapshot fallback — both prerequisite commands the README names fail (`npm run understand:noderoom` exit 1, `npm run capture:noderoom:real` exit 1). Defects D1, D3, D4 in PROMOTION_LOG.md. |
| 2 | No critical or major usability defect open | FAIL | Three majors still open with reproductions: D1 the header surface is a silent no-op on Ctrl-click, D3 the UI claims a "full local checkout" the receipt calls `"snapshot"`, D4 the Trace Lens has no keyboard or touch path. D2 (the installed target could not build) is fixed in iteration 1. See the defect ledger. |
| 3 | Mobile and desktop both intentional | FAIL | Layout is genuinely responsive — single column at 375px, zero overflow (`happy-path-mobile-375.png`, `trace-coach-mobile-375.png`). But the product's only interaction is `metaKey/ctrlKey`-modified mouse click (`src/trace/TraceLensProvider.tsx:58` (`event.metaKey \|\| event.ctrlKey`)), which a touch device cannot produce. Tapping a tagged surface under Chromium touch emulation (375x812, `hasTouch`, `isMobile`) leaves the panel closed and shows no affordance: `j2-mobile-tap-no-lens.png`. Mobile is reflowed, not designed. |
| 4 | No horizontal overflow at supported widths | UNVERIFIED | Measured 0 px of `documentElement.scrollWidth - clientWidth` at 360, 375, 414, 768, 1024, 1280 and 1440 px in both the happy-path and trace-coach states — fourteen measurements — but **the sweep probe was not retained**: no script, no JSON, nothing committed, so no third party can re-run a single one of them. Corroborated at exactly one of the fourteen by committed captures: `happy-path-mobile-375.png` and `trace-coach-mobile-375.png` show a clean single column with no horizontal cut-off at 375 px. Two screenshots are not a seven-width two-state sweep. Downgraded from PASS 2026-08-13. |
| 5 | Loading/empty/success/error/agent-running designed | FAIL | Success and locked states are deliberate (`nt-locked` code-ownership notice, `nt-empty` rows in `src/trace/TraceLensPanel.tsx:74-100` (`nt-empty nt-locked`)), and a loading seed exists (`src/DemoDashboard.tsx:8-21` (`const seedState: NodeTraceState = {`)). The empty state is not: after the README's own Happy Path, `state.coach` is absent, so `src/DemoDashboard.tsx:105` (`{coach && activeCoachStep ? (`) renders **nothing at all** where the Trace Coach belongs — while the hero above it simultaneously reads "Coach steps 0" and "Seeded from real NodeRoom files, code-browser captures, selectors, DOMRects, running-app screenshots". Nothing tells the reader to run `npm run trace-coach:sqlite`. See `happy-path-desktop-1280.png`. |
| 6 | Keyboard and basic accessibility pass | FAIL | Observed in the rendered page: (a) 25 consecutive Tab presses never reach the Trace Lens — there is no keyboard opener at all, only modified mouse click; (b) with the panel open, `role="dialog"` carries no `aria-modal`, focus stays on `BODY`, and 6 further Tab presses all land on `button.r-tracevu-rec` *behind* the dialog (`a11y-lens-open-focus.png`); (c) 4 elements carry `role="tab"` but the page has 0 `role="tabpanel"`, no `aria-controls`, and ArrowRight does not move tab focus; (d) heading order jumps H1 → H3, only 2 headings on the page; (e) `.r-tracevu-rec-meta` renders 10.5 px at `rgb(137,149,166)` on white ≈ 3.0:1, under the 4.5:1 AA floor for small text. |
| 7 | Web Interface Guidelines: no major unresolved | UNVERIFIED | No Web Interface Guidelines review was run in Wave 1. The findings recorded under conditions 5 and 6 are ad-hoc observations, not that review, and must not be read as a substitute for it. |
| 8 | Web-quality audit: no major unresolved | UNVERIFIED | No Lighthouse / axe / Core Web Vitals audit was run. Installing an audit toolchain was out of scope for a baseline that must not modify the tree. Navigation timings were captured (see condition 10) but a timing is not an audit. |
| 9 | No unexplained console errors or failed requests | UNVERIFIED | Measured 0 console errors, 0 `pageerror`, 0 failed requests and 0 HTTP >= 400 across both states and the full J1/J2/J3 drive, with the only console output being 4 WebGL performance warnings — `GL Driver Message (OpenGL, Performance, GL_CLOSE_PATH_NV, High): GPU stall due to ReadPixels` — from Sigma's renderer inside the Live graph rail, self-silencing after the fourth. **The console and network probe was not retained** and no console or request log was committed, so the four zeroes and the four warnings are prose, not evidence. Downgraded from PASS 2026-08-13. |
| 10 | Performance does not obstruct interaction | UNVERIFIED | Measured navigation timing of DOMContentLoaded 290 ms / load 292 ms in the happy-path state and 414 ms / 416 ms with the 6-step Trace Coach mounted; the graph rail laid out 10 entities / 15 edges and then 14 entities / 31 edges without blocking paint, and Overview/Steps/Minimap/Raw switching and seven viewport resizes were all immediate. **The navigation-timing probe was not retained** and no timing JSON was committed, so every number here is unciteable and nobody can re-measure the drive. Downgraded from PASS 2026-08-13. |
| 11 | Tests and build green | **PASS** | Re-measured 2026-08-13 on a fresh `git clone --depth 20` of `main` at `3deb3a8`, Windows 11 / Node v22.22.2 / npm 10.9.7: `npm run check` (aliased `npm run prepush`) **exits 0 end to end in 249s**, all eleven members green, including the last one that used to be red — `npm audit --omit=dev`, now `found 0 vulnerabilities` (D6, closed by the `npm audit fix` lockfile bump in `633f1d6`). Its receipts are committed under `docs/eval/`, and the producer is `npm run check` itself, in `package.json`, re-runnable from a fresh clone. Was FAIL: the gate was red at **one** of its ten members, `npm audit --omit=dev` exiting 1 with 4 production advisories (2 high, 2 moderate) including GHSA-22jq-vg5j-6vgg in `ip-address`. |
| 12 | Verified in the rendered app, not inferred from code | **PASS** | Iteration 1 fixed D2 and re-proved it by *running the installed application*, not by reading the diff: `promotion/probes/j4-installed-target-proof.mjs` installs NodeTrace into a throwaway Next App Router app, runs the real `next build`, serves the built output with `next start` on 127.0.0.1:4302 and photographs `/nodetrace` in headless Chromium. Output `promotion/evidence/j4-installed-next-target-1280.png` (the dashboard and a live Sigma canvas rendering inside a foreign application) and `promotion/evidence/j4-installed-next-target.json` (four installer phases ok, HTTP 200, 10 entities / 15 edges, 0 console errors, 0 failed requests). Producer and output are both committed and re-runnable from a fresh clone as `npm run promotion:j4`. |

**Status: NOT PROMOTED** — 2/12 PASS.

PASS: 11, 12. FAIL: 1, 2, 3, 5, 6. UNVERIFIED: 4, 7, 8, 9, 10.
(Was recorded as 3/12 on 2026-08-13 with 4, 9 and 10 PASS; corrected the same
day to 0/12 when a re-run found no committed producer or output behind any of
them. Iteration 1, the same day, earned 12 with both halves committed. Condition
11 followed on re-measurement: the gate's last red member had been fixed in
`633f1d6` and nothing re-ran it — see the second Correction in
[PROMOTION_LOG.md](PROMOTION_LOG.md).)

Iteration 1 also measured, inside the installed Next target only, 0 px of
horizontal overflow at 1280 px and 0 console errors / 0 failed requests — both
with a committed producer and committed output. Conditions 4 and 9 stay
UNVERIFIED anyway: 4 asks for a seven-width two-state sweep of this product's own
surfaces and 9 asks for the whole J1/J2/J3 drive, and one width on one page of a
different application is neither.
