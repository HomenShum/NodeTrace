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

## 2. Failed loads and missing registry entries have candidate recovery paths — D1

A reviewer must be told when evidence cannot load. The pre-repair UI substituted
an empty loading seed after a failed fetch, and a missing surface registry entry
made the panel return nothing. Those observations remain in the historical
promotion reports.

The 2026-09-04 candidate calls `src/demoState.ts:31`
(`export async function loadDemoState`) to check HTTP status, cap the read at
1 MiB and validate nested render fields. The dashboard supplies a ten-second
abort timeout and displays an error with **Retry loading trace**. Loading and
ready states are distinct; an obsolete request cannot replace current state.

`src/trace/TraceLensPanel.tsx:30` (`const meta = state.surfaces.find`) now permits
an absent registry entry and displays **Surface unavailable** with instructions
to load matching data. It does not invent the missing registration or evidence.
**D1: repaired candidate, pending final independent UI judge.** The original
failed observations have not been rescored.

---

## 3. Normal entry and modal focus replace the mouse-only path — D4

The earlier measurements found no opener after repeated Tab presses or a mobile
tap; focus stayed behind the role-only panel. The candidate's header and coach
use `src/DemoDashboard.tsx:147` (`function InspectTraceButton`) to call the
existing `useTraceLens().openHit` API from a normal button. The provider's
Ctrl/Cmd-click shortcut remains available. Hosts can supply their own buttons
through that API without adopting the demo's routing policy.

The panel calls `src/trace/TraceLensPanel.tsx:21` (`dialog.showModal()`) to make
the background inert. It focuses Close, wraps Tab between its available controls
and restores the opener after Escape, Close or a backdrop gesture. Source
opening is an actual URL, a supplied host callback, or an explicit unavailable
message. **D4: repaired candidate, pending final independent UI judge.** Source
inspection alone does not certify keyboard, physical touch or screen-reader use.

---

## 4. New NodeRoom captures still require an actual source checkout — D3

`npm run understand:noderoom` and `npm run capture:noderoom:real` use
`--source-root`, then `NODETRACE_SOURCE_ROOT`, then the parent directory to find
NodeRoom. A fresh NodeTrace clone does not supply that separate checkout.
The commands can therefore fail until the operator provides the source and its
required dependencies. The README now states that prerequisite explicitly.
Auto-cloning the Understand-Anything tool does not clone the NodeRoom source.

For the bundled walkthrough, `npm run trace-coach:sqlite` can use the committed
snapshot and captures without claiming that it produced a fresh capture. The
candidate's empty-state instructions distinguish those jobs. Capture CLI and
receipt semantics are outside this UI repair; this note does not close all of D3.

---

## 5. Snapshot labels, empty states and URL selection have candidate repairs

`src/DemoDashboard.tsx:165` (`const sourceModeLabel =`) labels the loaded coach
as **captured checkout** or **bundled snapshot**. The happy-path sample says no
coach captures are loaded and gives the snapshot setup command. The old claim
that a snapshot was a full local checkout is preserved only as historical
failure evidence. The UI displays saved captures; it does not start an agent or
new capture. These D3/D8 content repairs remain pending final UI judgment.

`src/demoNavigation.ts:31` (`export function useDemoNavigation`) owns step, tab
and lens query parameters in the demo. It restores selection on reload and
Back/Forward, normalizing invalid steps after data arrives. The portable provider
keeps its existing API, and installed hosts retain their own navigation policy.

Public JSON is data, never a grant of builder authority. The loader strips code
ownership and forces Review mode even if an input file claims capability.
Hosts must obtain capability from server-verified identity and send a safe
privileged projection. A public file or URL flag cannot replace that contract.

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

- **The surface registry exists in two places.** `scripts/init-sqlite.mjs:40`
  (`const surfaces = [`) and `scripts/trace-coach-sqlite.mjs:57`
  (`const surfaces = [`) each hold their own list. A third copy in
  `src/trace/surfaces.ts` was deleted in the Wave 3 reduction. The remaining two
  describe genuinely different sets, so they are not duplicates — but nothing
  checks that a surface tagged in the DOM is registered by whichever script last
  wrote the state. The candidate reports that mismatch visibly; the underlying
  datasets remain separate.
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
- **`knip` reports 6 unused files and 31 unused exports.** All of them are
  explained: five of the files and 21 of the exports are inside
  `vendor/nodegraph-live/`, a pre-built third-party bundle, and its `.d.ts` files
  are load-bearing for `tsc` even though knip cannot see it. The remaining
  exports and all 10 unused types are `src/trace/index.ts`, which is the public
  API of a library meant to be copied into another repository — a consumer
  building a `NodeTraceState` needs those types. The sixth file is
  `.dependency-cruiser.cjs`, a tool config knip does not recognise as one.
  None of it is dead code.
- **No error boundary anywhere.** A throw inside `DemoDashboard` blanks the page.
- **The Vite installer target is never built.** Only the Next target has an
  end-to-end build proof; the Vite path is covered by the import check alone.
