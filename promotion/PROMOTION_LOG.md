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
| D1 | Major | J2 | **The header is a tagged surface that does nothing.** After `npm run trace-coach:sqlite`, load `http://127.0.0.1:5187/` at 1280x900 and Ctrl-click anywhere in the hero — the `<h1>`, the launch card, any point inside `[data-nodetrace-surface="shell.statusStrip"]` (1236x330 px, the largest tagged region on the page). No panel, no message, no cursor change: `document.querySelector(".nt-panel")` stays null. Root cause, traced not guessed: `DemoDashboard.tsx:52` hardcodes the id `shell.statusStrip`, but `trace-coach-sqlite.mjs` replaces `state.surfaces` with six `workSurface.trace*` ids; `TraceLensPanel.tsx:16-18` does `surfaceMeta(state.surfaces, hit.surfaceId)` and returns `null` when it misses. The click resolves, the panel refuses, nothing tells the user. Contrast: the same click on `workSurface.traceStrip` works. In the happy-path state — where `surfaces` still contains `shell.statusStrip` — the same click also works, so the failure only appears after the README's own Trace Coach commands. | Open |
| D2 | Major | J4 | **The installer ships a target that cannot build.** `npm run installer:next:e2e` → phases 1-3 pass (`happy path PASS 2.59s`, `smoke PASS 3.15s`), phase 4 fails after 39.00s: `./src/nodetrace/LiveGraphRail.tsx  Module not found: Can't resolve '../../vendor/nodegraph-live/index.js'` and the same for `react.js`; `Build failed because of webpack errors`; exit 1. Root cause: `src/trace/LiveGraphRail.tsx:11-12` imports the vendored NodeGraph Live build by relative path, but `bin/nodetrace.mjs:48` copies **only** `src/trace/` into the target — nothing copies `vendor/nodegraph-live/`, so `../../vendor/...` resolves to a path that does not exist in the target. The repo's own suites stay green because the repo itself has `vendor/`. This makes the README's headline `npx github:HomenShum/NodeTrace add` produce a broken application. | Open |
| D3 | Major | J3 | **The UI claims provenance the receipt denies.** On a fresh clone the two documented prerequisites fail: `npm run understand:noderoom` throws `Error: NodeRoom trace file missing: <parent>/src/ui/panels/Artifact.tsx` with a raw stack trace, and `npm run capture:noderoom:real` prints `NodeRoom source root not found: <parent>`. Both resolve the NodeRoom checkout from `sourceRoot = resolve(options["source-root"] ?? env.NODETRACE_SOURCE_ROOT ?? "..")` — i.e. they assume NodeRoom is a sibling directory of the clone, which the README never states, and the README's promised auto-clone covers the Understand-Anything tool, not the NodeRoom source. `npm run trace-coach:sqlite` then succeeds anyway and prints `(snapshot)`; `docs/eval/nodetrace-trace-coach-sqlite.json` records `"sourceMode": "snapshot"`. But `DemoDashboard.tsx:138` maps anything that is not `"live"` to the string **"full local checkout"**, so the rendered page asserts `full local checkout - HomenShum/noderoom` for a checkout that is not present — visible in `promotion/evidence/trace-coach-desktop-1280.png`. The same receipt asserts `captureModel: "actual code-browser source screenshots from real filesystem … + actual running NodeRoom Playwright screenshots"` in a run where the capture step exited 1; the assets are real but checked in from an earlier run, and no field separates "produced now" from "committed earlier". In a product whose entire pitch is provenance, this is the worst possible place to overstate. | Open |
| D4 | Major | J2, J3 | **The only way in is a modified mouse click.** `TraceLensProvider.tsx:58` gates on `event.metaKey \|\| event.ctrlKey` and `event.button === 0`. Keyboard: 25 consecutive Tab presses at 1280x900 never reach anything that opens the lens — 17 landed stops in the happy-path state, 24 in the trace-coach state (12 focusable elements, cycled), and not one of them is an opener. Touch: at 375x812 with Chromium `hasTouch: true, isMobile: true`, tapping `[data-nodetrace-surface="workSurface.traceStrip"]` leaves `.nt-panel` null and no affordance is drawn (`j2-mobile-tap-no-lens.png`). Once open by mouse, the dialog is still not keyboard-usable: `role="dialog"` with no `aria-modal`, focus stays on `BODY`, and 6 further Tabs all land on `button.r-tracevu-rec` behind the panel (`a11y-lens-open-focus.png`). | Open |
| D5 | Minor | — | **Known API gap, carried in from the Wave 1 context note, confirmed by reading `db/schema.sql`.** `trace_proofs` has `source_label` and `source_url` but no `source_release`, `subject_id` or `object_id`, so a proof card cannot say which release of a source it came from, nor name the subject and object of the claim it is backing. Reproduce: `sqlite3 .nodetrace/nodetrace.sqlite '.schema trace_proofs'`, or read `public/nodetrace-state.json` — every proof row carries `sourceLabel`/`sourceUrl` and nothing else. Not user-visible today because no surface renders those fields; listed so Wave 2 does not rediscover it. | Open |
| D6 | Minor | J1 | **Production dependency advisories, and they gate the repo's own prepush.** `npm audit --omit=dev` exits 1 with 4 advisories (2 high, 2 moderate), including GHSA-22jq-vg5j-6vgg in `ip-address` — IPv4-mapped/NAT64 misclassification that can bypass SSRF checks. `npm audit --omit=dev` is the last link in the `prepush` chain, so this alone makes `npm run check` red. `npm audit fix` is offered. | Open |
| D7 | Minor | J1, J3 | **Graph labels collide.** In the Live graph rail at 1280x900 in the happy-path state, `demo-artifact` and `workSurface.evidenceCarousel` overlap into unreadable text; at 375x812 `copilot.agentOperations` and `shell.status…` overlap. ForceAtlas2 places nodes without label-collision avoidance and the labels are not truncated. Visible in `happy-path-desktop-1280.png` and `happy-path-mobile-375.png`. | Open |
| D8 | Minor | J1 | **Nothing marks the missing Trace Coach.** Run only the README Happy Path (`npm install`, `npm run happy-path`, `npm run dev`) and load the page: `state.coach` is absent so `DemoDashboard.tsx:105` renders nothing between the hero and the graph rail, while the hero says "Coach steps **0**" and, one line below, "Seeded from real NodeRoom files, code-browser captures, selectors, DOMRects, running-app screenshots, and flow metadata" — a static string at `DemoDashboard.tsx:100` that is rendered whether or not any of that is true. No empty state, and no pointer to `npm run trace-coach:sqlite`. | Open |

## Iterations

_none yet — Wave 1 is measurement only._

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
