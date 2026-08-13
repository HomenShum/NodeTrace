# Conventions

Observed from the code, not aspirational. Where the codebase is inconsistent,
this says so rather than picking a winner.

## Language choice is a rule, not a preference

- Code that runs in a **browser** is TypeScript (`.ts`, `.tsx`) and is
  type-checked by `tsc --noEmit`.
- Code that runs in **Node** is plain ES modules (`.mjs`) with no types.

This is not laziness. `scripts/init-sqlite.mjs` and everything under `src/trace/`
get copied verbatim into other people's repositories. A `.mjs` file runs there
immediately; a `.ts` file would drag a toolchain along with it.

## Naming

- **Surface ids** are dotted and camel-cased: `workSurface.traceStrip`,
  `shell.statusStrip`, `copilot.agentOperationStream`. The prefix is the area of
  the interface. They are opaque strings — nothing parses them.
- **Files** are `PascalCase.tsx` for React components, `camelCase.ts(x)` for
  everything else in `src/`, and `kebab-case.mjs` for Node scripts.
- **Database columns** are `snake_case`; the JavaScript objects that carry them
  are `camelCase`. The translation happens in the SQL, in the named parameters:
  `values (@surfaceId, @artifactId, ...)`. There is no ORM and no mapping layer.
- **npm scripts** are `colon:separated` by area (`capture:plan:smoke`,
  `trace-coach:sqlite`), except five that are single words.

## The five one-word npm scripts are a contract, not aliases

`dev`, `demo`, `doctor`, `check`, `proof` look like redundant aliases for
`happy-path`, `prepush` and `smoke`. They are not: `nodekit.yaml` declares them
under `commands:` and the reusable workflow in
`.github/workflows/node-platform-conformance.yml` verifies they exist. Deleting
them fails conformance. `clip:capture` is a genuine duplicate of
`walkthroughs:render` and is not in any contract.

## Command-line arguments

Every CLI uses `parseArgs` from `node:util`, with an explicit options table:

```js
const { values: options } = parseArgs({
  options: { db: { type: "string" }, state: { type: "string" }, "json-out": { type: "string" } },
});
```

Follow this when you add a script. Five hand-rolled parsers used to live here, in
two different dialects — one supported `--key=value` and one did not — and they
silently ignored typos. The standard-library parser rejects an unknown flag.

## Configuration precedence

Uniform across every script, in this order:

    command-line flag  ->  environment variable  ->  hard-coded default

```js
const captureRoot = resolve(options["capture-root"] ?? process.env.NODETRACE_CAPTURE_ROOT ?? "public/captures");
```

Environment variables are `NODETRACE_*` (`.env.example` lists them). The only one
that changes behaviour rather than paths is `NODETRACE_BUILDER_CAPABLE`.

## Scripts report, they do not throw

The checks follow one shape. Collect problems into an `issues` array, keep going,
write a JSON receipt to `docs/eval/`, then print every issue and set the exit
code:

```js
writeJson("docs/eval/nodetrace-smoke.json", { ok: issues.length === 0, completedAt, issues });
if (issues.length > 0) { console.error("nodetrace smoke: FAIL"); for (...) ...; process.exitCode = 1; }
else console.log("nodetrace smoke: PASS");
```

The receipts are committed. That is on purpose: the repository's claims about
itself are meant to be re-runnable and diffable, not taken on trust.

Output lines are `<name>: PASS` or `<name>: FAIL` followed by indented
`  - reason` lines. Log-scraping in CI depends on it.

## React

- Function components, hooks, no class components.
- No state library. `DemoDashboard` holds everything in `useState`; the lens uses
  one `createContext`.
- `useTraceLens()` throws if used outside its provider — deliberate, so a
  mis-mounted panel fails loudly rather than rendering empty.
- Props are declared inline (`{ state }: { state: NodeTraceState }`) rather than
  as named interfaces.
- Styling is hand-written CSS with a `nt-` prefix for panel classes and `r-tracevu-`
  for classes mirrored from NodeRoom. No CSS-in-JS, no framework.

## Comments

Sparse, and where they exist they explain **why**, usually naming the failure
that forced the code. Examples worth imitating:

- `bin/nodetrace.mjs:49` — why the vendored renderer is copied and its import rewritten
- `scripts/cli-smoke.mjs:113` — why the installed-import check exists
- `src/trace/LiveGraphRail.tsx:1` — why every edge is `traversal` and never `evidence`

Do not add comments that restate the code. Do add one when the answer to "why is
this here" is a bug that already happened.

## Commits

Long-form. A subject line, then prose explaining the situation, the root cause,
and what was measured. `git log` in this repository is documentation; read it
before assuming something is arbitrary.
