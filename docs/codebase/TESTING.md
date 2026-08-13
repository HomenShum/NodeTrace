# Testing

## There is no test runner

No Vitest, no Jest, no Playwright Test. Every check is a standalone `.mjs` script
that collects problems into an array, writes a JSON receipt into `docs/eval/`,
prints `<name>: PASS` or `<name>: FAIL`, and sets an exit code. `npm run smoke`
chains three of them with `&&`; `npm run check` chains ten.

That is unusual but it is not the problem. The problem is what one of those
scripts asserts — see the last section.

## The commands

| Command | Runtime | What it actually proves |
|---|---|---|
| `npm run happy-path` | ~1s | SQLite applies, rows insert, the client JSON is written. |
| `npm run smoke` | ~15s | Three scripts: `smoke.mjs`, `cli-smoke.mjs`, `mcp-smoke.mjs`. |
| `npm run citations:check` | <1s | Every `.tours/` step and every `path:line` in a markdown file still names the line it claims, checked by anchor and not by line number. |
| `npm run capture:plan:smoke` | ~10s | A plan parses **and** one real headless capture runs end to end. |
| `npm run builder:smoke` | ~1s | The privileged-ownership example route gates on its token. |
| `npm run agent:scale:smoke` | ~2s | 125 trace rows insert and read back. |
| `npm run trace-coach:sqlite` | ~2s | The six-step NodeRoom walkthrough state builds. |
| `npm run installer:next:e2e` | ~4min | Installs into a throwaway Next.js app and runs a real `next build`. |
| `npm run build` | ~20s | `tsc --noEmit` then `vite build`. |
| `npm run package:dry-run` | ~2s | The published tarball's file list. |
| `npm audit --omit=dev` | ~3s | No production advisories. |
| `npm run promotion:j4` | ~5min | Installs, builds, serves and photographs `/nodetrace` in headless Chromium. Not in `check`. |

`npm run check` (alias for `prepush`) is the declared green bar. It runs the
first eleven rows above, `&&`-chained, so its exit code is the whole thing.

**Measured 2026-08-13, this commit: `npm run check` exits 0 in 249s**, on a
fresh clone under Windows 11 / Node v22.22.2 / npm 10.9.7. At the Wave 1 baseline
it exited 1 at two members; after the promotion loop's iteration 1, at one
(`npm audit`, since closed by a lockfile bump). It is green end to end.

## The checks worth knowing about

**`scripts/cli-smoke.mjs` → `validateInstalledImports`.** Walks every file the
installer copied into a throwaway target and asserts each relative import
resolves *inside that target*. It exists because of defect D2: a component
imported the vendored renderer by a path that was only correct in this
repository, every installed app failed at build time, and every check here stayed
green because this repository has the file. It is a property check, so the next
component added with an outside-the-copy import fails here rather than in a
user's build.

**`scripts/capture-plan-smoke.mjs` → `checkRealCapture`.** Serves an HTML page
over HTTP from inside the test, runs the capture CLI against it, and asserts the
manifest recorded `actual-code-browser-shiki`, `actual-app-playwright`, a real
DOMRect, and PNGs over 1 kB. Added during the Wave 3 reduction, because nothing
previously ran the capture engine — only its plans were parsed — and ~600 lines
were about to be edited. Knocked out during review by changing the recorded
`captureKind`; it went red, as it should.

**`scripts/installer-next-e2e-smoke.mjs`.** The only check that builds a real
target with a real framework. Four minutes, and worth every second: it is the
one that would have caught D2 before a user did.

## `scripts/smoke.mjs` is mostly not a test — read this before you rename anything

Of its 213 lines, roughly 80 assert that **files contain particular literal
strings**. Counted precisely:

| Pinned file | Literal strings it must contain |
|---|---:|
| `README.md` | 29 |
| `docs/WALKTHROUGH.md` | 15 |
| `scripts/trace-coach-sqlite.mjs` | 12 |
| `docs/PORTING.md` | 11 |
| `AGENTS.md` | 9 |
| `src/DemoDashboard.tsx` / `src/styles.css` — must NOT contain | 9 |
| `src/trace/TraceLensPanel.tsx` | 8 |
| `scripts/understand-anything-noderoom.mjs` | 7 |
| `src/DemoDashboard.tsx` / `src/styles.css` — must contain | 6 + 3 |
| `src/trace/TraceLensProvider.tsx` | 3 |
| **Total** | **112** |

Plus 28 assertions that particular files exist.

Concretely: `npm run smoke` goes red if you reword the sentence in `README.md`
containing `125-step QA-agent trace`, if you rename the function `renderIdeSvg`,
or if you reintroduce the CSS class `surfaceBand`. None of those are behaviour.

The effect is that the suite freezes the repository's prose and its identifier
names, and it is the largest single obstacle to changing anything here. The Wave
3 reduction deliberately deleted only things this file does not name, so that
"the suite stayed green" means something. Loosening it is real work with a real
risk of removing the handful of assertions in it that do check behaviour (state
keys, schema tables and columns, `package.json` bin and files entries), so it was
left alone and recorded in `CONCERNS.md` instead.

If you are about to rename something: grep `scripts/smoke.mjs` for it first.

## What nothing tests

- The **panel's rendering**. There is no component test anywhere. Every
  assertion about `TraceLensPanel` is a substring match on its source text.
- **Keyboard and touch access.** Open defect D4 was found by an ad-hoc Playwright
  probe that was never committed; nothing in the repository would notice it
  returning.
- **The unregistered-surface path** (defect D1) — a Ctrl-click on a surface the
  state does not list renders nothing, and no check covers it.
- **The Vite installer target's build.** Only the Next target is built end to end.
- `npm run understand:noderoom` and `npm run capture:noderoom:real`, which need a
  sibling NodeRoom checkout and exit 1 without one (defect D3).

## Adding a check

Copy the shape from `scripts/capture-plan-smoke.mjs`: collect `issues`, write a
receipt to `docs/eval/`, print PASS/FAIL, set `process.exitCode`. Add it to the
`prepush` chain only if it is fast and deterministic. If it needs a browser, say
so in its header comment — CI has one, a reviewer's laptop may not.

One rule from experience, written at the top of `capture-plan-smoke.mjs`: if your
check serves something over HTTP from its own process, do not drive the client
with `spawnSync`. It blocks the event loop, the server never answers, and the
failure looks like a bug in the code under test.
