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

| # | Condition | Status | Evidence / reason |
|---|-----------|--------|-------------------|
| 1 | Journeys succeed end-to-end in a real browser | FAIL | J1 and J2 drive to completion (`happy-path-desktop-1280.png`, `j2-lens-tracestrip-desktop.png`). J3 reaches its screen only through an undocumented snapshot fallback — both prerequisite commands the README names fail (`npm run understand:noderoom` exit 1, `npm run capture:noderoom:real` exit 1). J4 fails outright: `npm run installer:next:e2e` exit 1, target `next build` cannot resolve `../../vendor/nodegraph-live/index.js`. Defects D1–D4 in PROMOTION_LOG.md. |
| 2 | No critical or major usability defect open | FAIL | Four majors open with reproductions: D1 the header surface is a silent no-op on Ctrl-click, D2 the installed target cannot build, D3 the UI claims a "full local checkout" the receipt calls `"snapshot"`, D4 the Trace Lens has no keyboard or touch path. See the defect ledger. |
| 3 | Mobile and desktop both intentional | FAIL | Layout is genuinely responsive — single column at 375px, zero overflow (`happy-path-mobile-375.png`, `trace-coach-mobile-375.png`). But the product's only interaction is `metaKey/ctrlKey`-modified mouse click (`src/trace/TraceLensProvider.tsx:58`), which a touch device cannot produce. Tapping a tagged surface under Chromium touch emulation (375x812, `hasTouch`, `isMobile`) leaves the panel closed and shows no affordance: `j2-mobile-tap-no-lens.png`. Mobile is reflowed, not designed. |
| 4 | No horizontal overflow at supported widths | PASS | `documentElement.scrollWidth - clientWidth` measured at 360, 375, 414, 768, 1024, 1280 and 1440 px in both the happy-path and trace-coach states: **0 px at every width, both states**. |
| 5 | Loading/empty/success/error/agent-running designed | FAIL | Success and locked states are deliberate (`nt-locked` code-ownership notice, `nt-empty` rows in `TraceLensPanel.tsx:73,91,99`), and a loading seed exists (`DemoDashboard.tsx:8-21`). The empty state is not: after the README's own Happy Path, `state.coach` is absent, so `DemoDashboard.tsx:105` renders **nothing at all** where the Trace Coach belongs — while the hero above it simultaneously reads "Coach steps 0" and "Seeded from real NodeRoom files, code-browser captures, selectors, DOMRects, running-app screenshots". Nothing tells the reader to run `npm run trace-coach:sqlite`. See `happy-path-desktop-1280.png`. |
| 6 | Keyboard and basic accessibility pass | FAIL | Observed in the rendered page: (a) 25 consecutive Tab presses never reach the Trace Lens — there is no keyboard opener at all, only modified mouse click; (b) with the panel open, `role="dialog"` carries no `aria-modal`, focus stays on `BODY`, and 6 further Tab presses all land on `button.r-tracevu-rec` *behind* the dialog (`a11y-lens-open-focus.png`); (c) 4 elements carry `role="tab"` but the page has 0 `role="tabpanel"`, no `aria-controls`, and ArrowRight does not move tab focus; (d) heading order jumps H1 → H3, only 2 headings on the page; (e) `.r-tracevu-rec-meta` renders 10.5 px at `rgb(137,149,166)` on white ≈ 3.0:1, under the 4.5:1 AA floor for small text. |
| 7 | Web Interface Guidelines: no major unresolved | UNVERIFIED | No Web Interface Guidelines review was run in Wave 1. The findings recorded under conditions 5 and 6 are ad-hoc observations, not that review, and must not be read as a substitute for it. |
| 8 | Web-quality audit: no major unresolved | UNVERIFIED | No Lighthouse / axe / Core Web Vitals audit was run. Installing an audit toolchain was out of scope for a baseline that must not modify the tree. Navigation timings were captured (see condition 10) but a timing is not an audit. |
| 9 | No unexplained console errors or failed requests | PASS | Across both states and the full J1/J2/J3 drive: **0 console errors, 0 `pageerror`, 0 failed requests, 0 HTTP >= 400**. The only console output is 4 WebGL performance warnings — `GL Driver Message (OpenGL, Performance, GL_CLOSE_PATH_NV, High): GPU stall due to ReadPixels` — emitted by Sigma's WebGL renderer inside the Live graph rail, self-silencing after the fourth. Explained, not unexplained. |
| 10 | Performance does not obstruct interaction | PASS | Navigation timing: DOMContentLoaded 290 ms / load 292 ms in the happy-path state, 414 ms / 416 ms with the 6-step Trace Coach mounted. The graph rail laid out 10 entities / 15 edges and then 14 entities / 31 edges without blocking paint; the Trace Lens rendered inside the 900 ms poll after the click; Overview/Steps/Minimap/Raw switching and seven viewport resizes were all immediate. Nothing observed obstructed an interaction. Watch item, not a failure: the ReadPixels GPU stalls under condition 9. |
| 11 | Tests and build green | FAIL | Tests and build individually pass — `happy-path` 0, `smoke` 0 (3 suites), `builder:smoke` 0, `agent:scale:smoke` 0 (125 rows), `capture:plan:smoke` 0, `trace-coach:sqlite` 0, `build` 0 (tsc --noEmit + vite build, 1675 modules), `package:dry-run` 0. But the repo's own declared gate, `npm run prepush` (aliased `npm run check`), is red at two of its ten members: `installer:next:e2e` exits 1 (D2) and `npm audit --omit=dev` exits 1 with 4 production advisories, 2 high / 2 moderate, including GHSA-22jq-vg5j-6vgg in `ip-address`. |
| 12 | Verified in the rendered app, not inferred from code | UNVERIFIED | Nothing to score: this is a baseline and contains no improvements. Every FAIL above was observed in the rendered application rather than inferred, but the condition asks about verified *improvements*, and there are none yet. Wave 2 makes this scoreable. |

**Status: NOT PROMOTED** — 3/12 PASS.
