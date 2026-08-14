# Web Interface Guidelines review — NodeTrace

Condition 7 of the [PROMOTION gate](https://github.com/HomenShum/NodeKit/blob/main/templates/promotion/GATE.md).
**Verdict: FAIL — 7 major findings.** Previously UNVERIFIED, because no review
had been run.

## What this is, in plain language

A guidelines review is a person sitting with a checklist of interface rules,
opening the product, and trying each rule against what is actually on screen.
Can I reach that with the keyboard? Is the focus ring visible? Is this grey text
readable? Does refreshing the page bring me back to what I was looking at? It is
not a score, and it is not a tool run. It is a list of the places where the
product and the checklist disagree.

**The checklist:** Vercel's Web Interface Guidelines — the authority
[SKILLS.md](SKILLS.md) already names for the interface-review axis. Fetched from
`https://vercel.com/design/guidelines` on 2026-08-13, HTTP 200, 534124 bytes, and
kept verbatim at [`promotion/evidence/web-interface-guidelines.txt`](evidence/web-interface-guidelines.txt)
so a reader can see exactly what was reviewed against instead of taking a summary
of it on trust.

**The surface:** the built bundle (`vite preview` over `dist/`), at 1280x900,
with a 375x812 pass for touch hit targets, in both seeded states — the README
Happy Path and the six-step Trace Coach that `npm run trace-coach:sqlite` mounts.
Two states because they are two different pages: the `role="tab"` strip and the
record list do not exist in the first one.

**The producer:** `npm run promotion:wig`
([`promotion/probes/wig-review.mjs`](probes/wig-review.mjs)), which measures every
finding below in the rendered page and writes
[`promotion/evidence/wig-review.json`](evidence/wig-review.json). Both halves are
committed, so a stranger who just cloned this repo can re-derive every number
here.

## Why this is not the Lighthouse run, and cannot be replaced by one

Condition 8 is the web-quality audit. It asks *does this page break a
machine-checkable WCAG rule, and how fast does it load*. This review asks a
different question — *is this interface built the way a careful team builds one*
— and most of the answers are not machine-checkable at all.

Six of the seven majors below score a clean 1.00 in every Lighthouse category:
Lighthouse has no opinion about a product whose only interaction is a modified
mouse click, a dialog that leaves focus behind it, a 407803 px² region that
swallows clicks, four tabs whose state cannot be linked or refreshed, a tablist
with no panels, or a screen that renders nothing where its main feature belongs.
NodeTrace's accessibility score is 0.92–0.95 **while** its one flow is
unreachable without a mouse.

The one place the two overlap is contrast, and even there they are separate
measurements: axe reports it as a WCAG violation, and the review computes the
ratio itself from `getComputedStyle` with the composited backdrop, so this
finding stands on its own number.

## Findings

Severity is major when a stranger trying to finish a real job is blocked or
misled; minor when the interface is worse than it should be but the job still
completes.

### Major

**M1 — Keyboard works everywhere.** *"Keyboard works everywhere. All flows are
keyboard-operable & follow the WAI-ARIA Authoring Patterns."*

Measured in the rendered page: **0 of 12 focusable elements open the Trace Lens
when Enter is pressed on them**, and 40 consecutive Tab presses (13 distinct
stops) never reach an opener. The lens is the product; the only way in is
`src/trace/TraceLensProvider.tsx:58` (`event.metaKey || event.ctrlKey`), a
modified mouse click. Evidence:
[`wig-keyboard-no-opener.png`](evidence/wig-keyboard-no-opener.png),
`measurements.keyboard` in the report.

**M2 — Manage focus.** *"Manage focus. Use focus traps, move & return focus
according to the WAI-ARIA Patterns."*

The dialog at `src/trace/TraceLensPanel.tsx:28` (`role="dialog"`) opens with
`document.activeElement` still on `<body>` and no `aria-modal`. Of the 6 Tab
presses after it opens, **2 land inside the panel and 4 land on controls behind
it** — measured in order: `button "fit"`, `input`, `button.nt-close "Close Trace
Lens"`, `a "Open source"`, `body`, `button.r-tracevu-rec`. A keyboard user
tabbing through an open dialog walks straight out the back of it. Evidence:
[`wig-lens-open-focus-outside.png`](evidence/wig-lens-open-focus-outside.png),
`measurements.dialogFocus`.

**M3 — No dead zones.** *"No dead zones. If part of a control looks interactive,
it should be interactive. Don't leave users guessing where to interact."*

**1 of the 2 tagged regions swallows the Ctrl-click and renders nothing**:
`shell.statusStrip`, **407803 px²** at 1280x900 — the largest region on the page,
the entire hero — with `cursor: auto` and no affordance of any kind. This is
defect D1 in [PROMOTION_LOG.md](PROMOTION_LOG.md), and the guidelines name the
rule it breaks.

**M4 — URL as state / deep-link everything.** *"URL as state. Persist state in
the URL so share, refresh, Back/Forward navigation work."* and *"Deep-link
everything. Filters, tabs, pagination, expanded panels, anytime `useState` is
used."*

Switching to the Raw JSON tab leaves the URL **byte-identical**, and a reload
returns to Overview (raw pane present after reload: `false`). The coach tab, the
active step and the open lens are all `useState`; none is shareable, none
survives refresh, and Back does not undo any of them. For a product whose entire
pitch is showing a colleague where a claim came from, a provenance panel that
cannot be linked is the wrong default.

**M5 — Semantics before ARIA.** *"Semantics before ARIA. Prefer native elements
(button, a, label, table), before `aria-*`."*, with the WAI-ARIA Authoring
Patterns requirement from the Interactions section.

**4 elements carry `role="tab"`** at `src/DemoDashboard.tsx:196`
(`role="tablist"`), and the page has **0 `role="tabpanel"` and 0
`aria-controls`**. The tablist announces a widget whose panels do not exist, so
assistive technology is told about a relationship the DOM cannot express, and the
Authoring Patterns' arrow-key behaviour is absent too.

**M6 — Minimum contrast.** *"Minimum contrast. Prefer APCA over WCAG 2 for more
accurate perceptual contrast."*

Four text styles fall under the WCAG 2 AA floor for their size, each computed
from the element's own colour against its composited backdrop:

| Selector | Size | Colour on backdrop | Ratio | AA floor |
|---|---|---|---|---|
| `.r-tracevu-rec-meta` | 10.5 px | `rgb(137,149,166)` on `rgb(239,230,231)` | **2.48:1** | 4.5:1 |
| `.heroStats span` | 10 px | `rgb(137,149,166)` on `rgb(248,250,252)` | **2.90:1** | 4.5:1 |
| `.heroStats small` | 10 px | `rgb(137,149,166)` on `rgb(248,250,252)` | **2.90:1** | 4.5:1 |
| `.r-tracevu-rec-sub` | 11.5 px | `rgb(104,117,138)` on `rgb(239,230,231)` | **3.81:1** | 4.5:1 |

`.eyebrow` was sampled too and passes at 6.87:1, so this is a specific failure,
not a palette that is dark everywhere. The affected text is the step metadata and
the hero's own statistics — the numbers a reader is there to read.

**M7 — All states designed / no dead ends.** *"All states designed. Empty,
sparse, dense, & error states."* and *"No dead ends. Every screen offers a next
step or recovery path."*

After the README's own Happy Path, `src/DemoDashboard.tsx:105`
(`{coach && activeCoachStep ? (`) renders **nothing** where the Trace Coach
belongs — **18 px of empty space** between the hero and the graph rail — while
the hero one line above reads "Coach steps **0**" and, in the same card, claims
"Seeded from real NodeRoom files, code-browser captures, selectors, DOMRects,
running-app screenshots, and flow metadata". Nothing on screen names the command
that would fill it. Evidence:
[`wig-happy-path-empty-coach-slot.png`](evidence/wig-happy-path-empty-coach-slot.png).

### Minor

**m1 — Match visual & hit targets.** 2 of 12 controls are under 24 px on their
short side at 1280 px (`button "fit"` 28x22, the graph rail's `input` 13x13);
6 of 12 are under 44 px at 375 px, including all four coach tabs at 33 px high.

**m2 — Announce async updates.** 0 `aria-live` / `role=status` / `role=alert`
regions. The panel opening, the tab switch and the state fetch all happen
silently for a screen reader.

**m3 — Headings & skip link.** Heading levels in DOM order are **h1 → h3** (one
skipped level; only two headings on the page) and there are **0** skip links.

**m4 — Shield verbatim content from translation.** 3 `<code>`/`<pre>` nodes carry
npm commands, file paths and raw JSON; **0** carry `translate="no"`, so browser
auto-translate will rewrite the commands the hero tells you to run.

**m5 — Browser UI matches your background / set the appropriate color-scheme.**
`<meta name="theme-color">` absent; `<html>` computes `color-scheme: normal`.

### Pass

- **Clear focus.** All 12 controls draw a visible ring while focused. Recorded as
  a pass with a caveat that is itself a measurement: the page's stylesheets
  contain **0** `:focus` or `:focus-visible` selectors, so every ring here is the
  browser's default. It is correct by accident and disappears the first time
  anyone writes `outline: none`.
- **Icon-only buttons are named.** 0 of 1 unnamed — the lens close button carries
  `aria-label="Close Trace Lens"`. Measured with the panel **open**; measuring it
  closed reports "0 of 0", a pass earned by not looking.
- **Labels everywhere.** The page's single form control is an
  `<input type=checkbox>` inside the vendored graph renderer, and it is labelled.

### Not applicable, with the measurement that shows why

- **Animations — honour `prefers-reduced-motion`.** **0** elements on the page
  have a CSS transition or animation. There is no motion to reduce.
- **Forms — the rest of the section.** No form, no submit, no validation; the one
  checkbox above is the whole of it.
- **Links are links.** 0 anchors with the lens closed (the panel adds one real
  `<a>`), and the URL never changes at all — there is no navigation here to have
  got wrong. This is the same fact as M4 seen from the other side.

## What would close this

M3 and M7 are already the ledger's D1 and D8. M1 and M2 are D4. M4, M5 and M6 are
new to this review. Nothing here was fixed in this pass — a review that fixes
what it finds cannot be re-run against the tree it described.
