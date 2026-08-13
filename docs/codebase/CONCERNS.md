# Concerns

Known problems, worst first. Each one has a reproduction or a citation; a hunch
is not a concern. Items marked **D<n>** are the product loop's defect ledger in
`promotion/PROMOTION_LOG.md` and belong to that loop, not to this one.

---

## 1. The test suite pins prose and identifier names

**Not a defect in the product. The largest obstacle to working on it.**

`scripts/smoke.mjs` asserts that 112 literal strings appear in specific files —
29 in `README.md`, 15 in `docs/WALKTHROUGH.md`, 12 identifiers inside
`scripts/trace-coach-sqlite.mjs`, 9 strings that must *not* appear in
`src/DemoDashboard.tsx`, and so on. See the table in `TESTING.md`.

Reproduce: rename `renderIdeSvg` in `scripts/trace-coach-sqlite.mjs`, or reword
the README sentence containing `125-step QA-agent trace`. `npm run smoke` exits 1.

Why it matters: a new engineer's first rename produces a red build with an error
message about a README. It also means the suite cannot distinguish "you broke
something" from "you renamed something", which is the property a test suite
exists to have.

Why it was not fixed here: loosening assertions during a refactor is exactly the
move that hides a regression, and this one has real checks mixed in with the
prose pins (state keys, schema tables and columns, `package.json` bin and files
entries). Separating them is its own change with its own review. The Wave 3
reduction worked around it instead — every deletion was of something this file
does not name, which is why "smoke stayed green" is meaningful evidence rather
than a formality.

Suggested fix, for whoever takes it: split `smoke.mjs` into
`smoke.mjs` (state, schema, package shape, file existence) and a separate
docs-link check, keep every assertion verbatim in the move, then argue about the
docs check on its own merits.

---

## 2. A missing state file fails silently, in the browser and in the panel

Two silent failures on the same path.

`src/DemoDashboard.tsx:34` — if `public/nodetrace-state.json` is missing or
unparseable, the `.catch` swaps in a placeholder with an empty surface list. The
page renders normally. Nothing tells the user that no data loaded.

`src/trace/TraceLensPanel.tsx:17-19` — if the clicked surface id is not in
`state.surfaces`, the component returns `null`. The click was consumed
(`preventDefault` + `stopPropagation` already ran), so the user gets no panel, no
message, and no cursor change. **This is defect D1**, and it is reachable from the
README's own instructions: `npm run trace-coach:sqlite` replaces the surface
registry, and the page header is still tagged `shell.statusStrip`.

Both are one small change each. Neither was made here because Wave 3 is
structural and mixing a UI behaviour change into it would make the "behaviour
preserved" claim unverifiable.

---

## 3. The lens can only be opened with a mouse — D4

`src/trace/TraceLensProvider.tsx:58` requires `metaKey || ctrlKey` plus
`button === 0`. Measured at the Wave 1 baseline: 25 consecutive Tab presses reach
no opener; a tap at 375x812 with touch emulation leaves `.nt-panel` null. Once
open, the dialog has `role="dialog"` without `aria-modal`, focus stays on `BODY`,
and Tab lands on buttons behind the panel.

For a product whose whole pitch is "anyone can check this claim", keyboard-only
and touch users cannot check anything.

---

## 4. Two documented commands fail on a fresh clone — D3

`npm run understand:noderoom` and `npm run capture:noderoom:real` resolve their
source as `options["source-root"] ?? NODETRACE_SOURCE_ROOT ?? ".."`, i.e. they
assume a checkout of `HomenShum/noderoom` sits beside this one. The README does
not say to create it. On a fresh clone the first throws
`Error: NodeRoom trace file missing: …` with a raw stack trace and the second
prints `NodeRoom source root not found: …`.

Neither is in `npm run check`, so the green bar does not depend on them — but
both are printed on the demo page as instructions to run.

---

## 5. The page claims provenance the receipt denies — D3, second half

`src/DemoDashboard.tsx:138` maps any `sourceMode` that is not `"live"` to the
words **"full local checkout"**. After `npm run trace-coach:sqlite` on a fresh
clone, `docs/eval/nodetrace-trace-coach-sqlite.json` records
`"sourceMode": "snapshot"` — there is no checkout — and the page nonetheless
renders `full local checkout - HomenShum/noderoom`.

In a product about provenance this is the worst possible place to overstate.

---

## 6. Playwright is a devDependency that shipped code imports

`src/capture/codebaseCapture.mjs` is listed in `package.json` `files` and is
reached by two of the three published binaries, and it imports `playwright`,
which is declared under `devDependencies`. A consumer who installs the package
and runs a real capture gets
`Missing dependency: install Playwright before running nodetrace capture.`

The import is dynamic and the message is deliberate, so nothing crashes — but the
package does not declare what its own CLI needs. Either move `playwright` to
`dependencies` (heavy: it downloads browsers) or declare it as an
`optionalDependency` or `peerDependency` and say so in the README.

## 7. Smaller things, listed so nobody rediscovers them

- **The surface registry exists in two places.** `scripts/init-sqlite.mjs:40` and
  `scripts/trace-coach-sqlite.mjs:57` each hold their own list. A third copy in
  `src/trace/surfaces.ts` was deleted in the Wave 3 reduction. The remaining two
  describe genuinely different sets, so they are not duplicates — but nothing
  checks that a surface tagged in the DOM is registered by whichever script last
  wrote the state, which is what makes D1 possible.
- **`foreign_keys = ON` is set in `trace-coach-sqlite.mjs` and not in
  `init-sqlite.mjs`.** Inconsistent rather than wrong; the inserts are ordered
  correctly either way.
- **`clip:capture` duplicates `walkthroughs:render`** exactly, and unlike `demo`,
  `doctor`, `check` and `proof` it is not required by `nodekit.yaml`. It is
  referenced from `README.md` and `docs/FEATURE_PROOF_STORYBOARD.md`, so deleting
  it is a three-file change nobody has made.
- **`docs/walkthroughs/nodetrace-walkthrough.mp4`** is a 5.6-second slideshow of
  two committed PNGs, and CI installs `ffmpeg` and enforces byte-identical
  regeneration to keep it. The genuinely informative recording is
  `docs/screenshots/live-graph-rail.gif`, which shows the app running.
- **`knip` reports 5 unused files and 31 unused exports.** All of them are
  explained: the 5 files and 21 of the exports are inside
  `vendor/nodegraph-live/`, a pre-built third-party bundle, and its `.d.ts` files
  are load-bearing for `tsc` even though knip cannot see it. The remaining
  exports and all 10 unused types are `src/trace/index.ts`, which is the public
  API of a library meant to be copied into another repository — a consumer
  building a `NodeTraceState` needs those types. Neither group is dead code.
- **No error boundary anywhere.** A throw inside `DemoDashboard` blanks the page.
- **The Vite installer target is never built.** Only the Next target has an
  end-to-end build proof; the Vite path is covered by the import check alone.
