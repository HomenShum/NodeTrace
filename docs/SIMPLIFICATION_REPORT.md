# Simplification report

Measured on Windows 11, Node v22.22.2, npm 10, on 2026-08-13.

**Before** is commit `f24dfd5` (the tree as the product loop left it). **After** is
this commit. Every row names the command that produced it; run them yourself.
Where a tool does not fit this stack the row says so instead of being blank.

## The numbers

| Measure | Before | After | Change | Evidence command |
|---|---:|---:|---:|---|
| Hand-written production files | 36 | 36 | 0 | `git ls-files -- src bin db scripts examples promotion/probes \| wc -l` |
| Hand-written production lines | 7492 | 7241 | -251 | `git ls-files -- src bin db scripts examples promotion/probes \| xargs wc -l \| tail -1` |
| Vendored third-party files | 21 | 11 | -10 | `git ls-files -- vendor \| wc -l` |
| Vendored third-party bytes | 130,254 | 72,256 | -57,998 | `git ls-files -- vendor \| xargs wc -c \| tail -1` |
| Direct dependencies | 18 | 18 | 0 | `node -e "const p=require('./package.json');console.log(Object.keys(p.dependencies).length+Object.keys(p.devDependencies).length)"` |
| Unused files | 5 | 6 | +1 | `npx knip` — the extra one is `.dependency-cruiser.cjs`, a tool config knip does not recognise. See below. |
| Unused exports | 22 | 21 | -1 | `npx knip` |
| Unused exported types | 10 | 10 | 0 | `npx knip` |
| Duplicate blocks | 16 | 11 | -5 | `npx jscpd src bin scripts db examples` |
| Duplicate percentage (JavaScript) | 3.49% | 2.30% | -1.19pp | `npx jscpd src bin scripts db examples` |
| Duplicate percentage (all formats) | 2.36% | 1.54% | -0.82pp | `npx jscpd src bin scripts db examples` |
| Circular dependencies | 0 | 0 | 0 | `npx dependency-cruiser --validate .dependency-cruiser.cjs --output-type err src bin scripts db examples promotion` |
| Capture editor-mode branches | 5 | 1 | -4 | `grep -cE 'editor\.mode ===\|editorMode !==' src/capture/codebaseCapture.mjs` (three accepted modes plus two manifest branches, now one guard) |
| Capture `editor` config knobs | 9 | 2 | -7 | `sed -n '/^    editor: {/,/^    },/p' src/capture/codebaseCapture.mjs` |
| Hand-rolled CLI argument parsers | 5 | 0 | -5 | `grep -rl 'function parseArgs' src scripts bin \| wc -l` |
| Production advisories | 4 (2 high, 2 moderate) | 0 | -4 | `npm audit --omit=dev` |
| Canonical workflow suite | exit 1 | **exit 0** | green | `npm run check` |
| Browser workflow probe | pass | pass | — | `npm run promotion:j4` |
| Production bundle, JS | 431.79 kB | 431.06 kB | -0.73 kB | `npm run build` |
| Production bundle, CSS | 15.07 kB | 15.07 kB | 0 | `npm run build` |
| Published package files | 111 | 110 | -1 | `npm run package:dry-run` |
| Additions / deletions, code | — | +322 / -592 | net -270 | `git diff --shortstat f24dfd5 HEAD -- src bin scripts db examples vendor promotion/probes package.json` |
| Additions / deletions, docs and tours | — | +1600 / -23 | this packet | `git diff --shortstat f24dfd5 HEAD -- docs .tours` |

Two rows need reading carefully.

**Published package files went down by only 1** because eleven code and sourcemap
files left and ten documentation files arrived. `docs/` is in the package's
`files` list, so this packet ships. Code shipped: -11.

**`npm run check` is the headline.** It chains ten commands with `&&`, so exit 0
is a claim about all ten. At the Wave 1 baseline it was red at two members; after
the product loop's iteration 1, red at one. It is now green end to end for the
first time.

### Rows where a tool does not fit this stack

| Row | Value |
|---|---|
| Test-suite pass count | not applicable — there is no test runner. The repository's checks are standalone `.mjs` scripts chained by `npm run check`; the meaningful number is that chain's exit code, reported above. |
| Bundle analyzer output | not applicable — no analyzer is installed. Vite's own build output is the only bundle measurement, and it is reported above. |
| Type coverage | not applicable — only `src/**.ts(x)` is TypeScript. Everything in `bin/` and `scripts/` is untyped `.mjs` by design (see `docs/codebase/CONVENTIONS.md`). |

---

## What was deleted

**1. Ten sourcemap files in `vendor/nodegraph-live/` (58 kB).**
`*.js.map` and `*.d.ts.map` for a pre-built third-party bundle. They point at
TypeScript sources this repository does not contain, so no debugger could ever
have used them — and `bin/nodetrace.mjs` copied all ten into every application
the installer touched. The `//# sourceMappingURL=` footers were stripped with
them so nothing dangles.

**2. `src/trace/surfaces.ts` (39 lines, 1 file, 2 public exports).**
`DEFAULT_SURFACES` was a byte-identical copy of the surface list in
`scripts/init-sqlite.mjs:40`, used for one thing: to populate the placeholder
state during the millisecond before the real state file arrives. Claiming five
registered surfaces before any data has loaded is wrong information, so the
placeholder now says `surfaces: []`, which is true. `surfaceMeta` was a
three-line array lookup with exactly one caller, so it moved into that caller.

**3. Two schema migrations for a database this project never shipped.**
`ensureOwnershipColumns` in `scripts/init-sqlite.mjs` added
`query_ref`/`mutation_ref`/`skill_ref` to `trace_code_ownership` if missing.
`ensureCoachSchema` in `scripts/trace-coach-sqlite.mjs` dropped and recreated the
coach tables if `step_label` was missing. `git show 59b844b:db/schema.sql` shows
all four columns present in the commit that created the tables. There has never
been a release whose schema lacked them.

**4. `editor.mode: "desktop"` and `editor.mode: "web"` — 365 lines and 7 config
knobs from `src/capture/codebaseCapture.mjs`.**
The largest deletion, and the one worth arguing about, so here is the argument.

These two modes drove **VS Code** to produce source screenshots: about twenty
functions of DOM automation against VS Code for the Web's private markup
(`expandVsCodeExplorerFolder`, `scrollUntilVsCodeExplorerRow`,
`setVsCodeExplorerScrollTop`, `dismissVsCodeDialog`, …), plus a PowerShell script
that screenshots a desktop window by title, plus `symlinkSync` junction creation,
plus seven `editor.*` plan fields that only they read.

Evidence they were unreachable, not merely unused: no committed capture plan sets
them (`examples/real-codebase-capture/noderoom.capture.json` is `code-browser`,
`scripts/capture-plan-fixture.mjs` is `code-browser`,
`scripts/capture-noderoom-real-assets.mjs` defaulted to `code-browser`), no check
runs them, no CI job runs them, and neither could — CI has no VS Code.

Reuse-ladder rung (b), *does this repository already contain it*: yes. The
`code-browser` mode renders the same file's same line range with Shiki, headless,
with no editor installed, identically in CI and on a laptop. The README already
said as much. Two more implementations of "screenshot some code" were kept alive
in case somebody wanted a VS Code chrome around it.

`normalizeCapturePlan` now rejects any other mode by name, so a plan written
against the old options gets a sentence explaining the situation rather than a
mysterious `undefined`.

**5. Nine `nodetrace capture` CLI flags and environment knobs** that only fed the
removed modes: `--editor-capture`, `--code-cli`, `NODETRACE_CODE_CLI`,
`NODETRACE_EDITOR_CAPTURE`, `--vscode-port`, and the `editor.url` / `editor.host`
/ `editor.userDataDir` / `editor.extensionsDir` plan fields.

## What custom code was replaced by an existing capability

**Five hand-rolled command-line argument parsers → `parseArgs` from `node:util`.**

`scripts/init-sqlite.mjs`, `scripts/trace-coach-sqlite.mjs`,
`scripts/understand-anything-noderoom.mjs`,
`scripts/capture-noderoom-real-assets.mjs` and `src/capture/codebaseCapture.mjs`
each carried their own ~17-line loop over `process.argv`. They were not even the
same parser: `trace-coach-sqlite.mjs` supported `--key=value` and
`init-sqlite.mjs` did not, which is the kind of difference a reader discovers by
being wrong.

`node:util` has had `parseArgs` since Node 18 and this package already requires
Node ≥ 20 — reuse-ladder rung (c), the standard library. Each call site now
declares its own options table, which doubles as documentation of what the script
accepts.

**One behaviour change, stated plainly:** the hand-rolled parsers silently
ignored unknown flags. `parseArgs` rejects them. `node scripts/init-sqlite.mjs --json-ou x`
used to run and write nothing; it now exits with
`ERR_PARSE_ARGS_UNKNOWN_OPTION`. That is stricter than before, and it is the
behaviour you want from a script whose whole job is writing files to paths you
named.

## What was added, and why each addition was necessary

Additions are debt unless they buy something. Four were made.

**1. A real end-to-end check of the capture engine** (`checkRealCapture` in
`scripts/capture-plan-smoke.mjs`, ~45 lines). Required by the refactoring rule:
*add a characterization test before refactoring an important path that lacks
protection*. Before it, nothing ran the capture engine — `capture-plan-smoke` and
`mcp-smoke` both stopped at plan validation. It now serves a page over HTTP from
inside the check, runs the real CLI against it in headless Chromium, and asserts
the manifest recorded `actual-code-browser-shiki`, `actual-app-playwright`, a real
DOMRect, and PNGs over 1 kB. Verified by knockout: changing the recorded
`captureKind` to `generated-placeholder` turns it red.

**2. `scripts/tours-check.mjs` and `npm run tours:check`.** The CodeTour files
point at line numbers, and line numbers rot. So the tours are generated from a
table of (file, literal anchor, description) and this script re-resolves every
anchor; a moved anchor is a hard failure. Verified by knockout: renaming
`const meta = state.surfaces.find` turns it red with the file and anchor named.

**3. This documentation packet** — `docs/START_HERE.md`,
`docs/SIMPLIFICATION_REPORT.md`, `docs/codebase/*.md`, `.tours/*.tour`. No
documentation application, no Docusaurus, no Storybook. Markdown and validated
tours.

**4. `.dependency-cruiser.cjs`** (13 lines). The circular-dependency row above
is only a measurement if somebody else can run it, and `dependency-cruiser`
needs a rules file. Committing it costs one `knip` false positive — knip counts
it as an unused file because it does not recognise the tool — which is why the
unused-files row goes from 5 to 6 rather than being quietly rescoped.

## Findings left unresolved, with the reason

**`scripts/smoke.mjs` pins 112 literal strings across five files.** The single
largest obstacle to changing anything here: 29 required substrings in
`README.md`, 15 in `docs/WALKTHROUGH.md`, 12 identifiers inside
`scripts/trace-coach-sqlite.mjs`, 9 strings that must *not* appear in
`src/DemoDashboard.tsx`. Renaming a function or rewording a sentence turns the
suite red.

Not fixed because loosening assertions during a structural refactor is precisely
the move that hides a regression, and this file mixes real behaviour checks
(state keys, schema tables and columns, `package.json` bin and files entries)
into the same list. Splitting them is its own change deserving its own review.
The reduction worked around it instead: **every deletion above is of something
`smoke.mjs` does not name**, which is what makes "the suite stayed green"
evidence rather than a formality. Full table in `docs/codebase/TESTING.md`,
suggested fix in `docs/codebase/CONCERNS.md`.

**`knip` still reports 5 unused files, 21 unused exports and 10 unused types.**
Explained rather than chased. Twenty-six of them are inside
`vendor/nodegraph-live/`, a pre-built third-party bundle nobody should edit — and
its five `.d.ts` files are load-bearing for `tsc --noEmit` even though knip
cannot see it, so deleting them breaks the build. The rest are `src/trace/index.ts`,
which is the public API of a library designed to be copied into another
repository; a consumer building a `NodeTraceState` needs those types. A `knip.json`
narrowing the scope would have made the after-number look better while changing
nothing, so none was added — the evidence command is identical at both ends.

**`clip:capture` duplicates `walkthroughs:render` exactly.** Left because
removing it touches `README.md` and `docs/FEATURE_PROOF_STORYBOARD.md`, both of
which `smoke.mjs` pins.

**`docs/walkthroughs/nodetrace-walkthrough.mp4`** is a 5.6-second slideshow of two
committed PNGs, and CI installs `ffmpeg` and enforces byte-identical regeneration
to keep it, while the genuinely informative recording
(`docs/screenshots/live-graph-rail.gif`, the app actually running) costs nothing.
Left: both the file and its generator are pinned by `smoke.mjs`.

**`playwright` is a devDependency that shipped code imports.** Changing it is a
packaging decision with a real cost either way (moving it to `dependencies`
downloads browsers for every consumer). Documented in
`docs/codebase/CONCERNS.md` rather than decided unilaterally.

**Defects D1, D3, D4, D5, D7, D8 remain open.** They belong to the product loop
in `promotion/PROMOTION_LOG.md`, and the refactoring rules forbid mixing feature
or behaviour work into a structural change. Two ledger items did close here,
both as consequences of reduction work rather than as separate fixes: **D6**
(production advisories, closed by `npm audit fix`, lockfile only) and the third
copy of the surface registry named in **D1**'s root-cause analysis — though D1's
user-visible symptom is untouched and still reproduces.

## Behaviour preserved — how that was checked

After every deletion batch: `npm run smoke` (three scripts), `npm run build`
(`tsc --noEmit` + `vite build`). At the end: the full `npm run check` chain,
exit 0, and `npm run promotion:j4`, which installs NodeTrace into a throwaway
Next.js application, runs a real `next build`, serves it and photographs
`/nodetrace` in headless Chromium.

The one deliberate behaviour change is the unknown-flag rejection described
above. The one deliberate capability removal is `editor.mode` `desktop`/`web`.
Both are stated rather than buried; if either is wrong, it is wrong visibly.
