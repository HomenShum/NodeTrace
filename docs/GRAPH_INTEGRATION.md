# Graph integration: what the live rail renders, and what it refuses to

NodeTrace records what an agent-native app *did* — SQLite rows describing
phases of work. The vendored NodeGraph Live renderer
(`vendor/nodegraph-live/`, NodeGraph commit 8242a83) draws relationships in
three trust classes, and the distinction is the point of that library
(`vendor/nodegraph-live/graph-model.d.ts`):

- **`evidence`** — a MEASURED relationship; the weight came from an external
  system of record and owns the width channel.
- **`traversal`** — interaction history; "telemetry about us, not evidence
  about the world", constant width, lighter ink.
- **`assertion`** — a curated claim carrying a complete source receipt
  (`source`, `release`, `subjectId`, `objectId`, `url`), rendered with a badge.

This document maps NodeTrace's real event taxonomy onto that grammar, states
what the current wiring (`src/trace/LiveGraphRail.tsx`, commit cdf3cb5) feeds
and deliberately refuses, and names the exact schema changes that would let a
NodeTrace row honestly earn a higher trust class.

## (a) The event taxonomy, and the trust class each event earns

The trace event schema is `trace_events` in `db/schema.sql`: `id`,
`session_id`, `trace_id`, `step_id`, `surface_id`, `artifact_id`,
`element_id`, `phase`, `actor`, `status`, `summary`, `duration_ms`, plus
workpaper-reference JSON columns (`input_refs_json`, `output_refs_json`,
`evidence_refs_json`, `mutation_refs_json`, `approval_refs_json`,
`eval_ref_json`, `receipt_hashes_json`). The event *kind* is the `phase`
column. The happy path (`scripts/init-sqlite.mjs`, run by
`npm run happy-path`) emits four events, one per phase:

| Event (`phase`) | Emitted by | Entities extracted by `LiveGraphRail.entitiesFor()` | Anything MEASURED? | Trust class earned |
| --- | --- | --- | --- | --- |
| `schema` — "Applied generic SQLite trace schema" | `scripts/init-sqlite.mjs` | `actor: nodetrace`, `tool: workSurface.traceStrip`, `step: schema` | No. `duration_ms` (13) is self-reported timing, not a count from a system of record. | `traversal` only — co-occurrence in one event, no measured magnitude. |
| `proof` — "Inserted source-backed business proof" | `scripts/init-sqlite.mjs` | `actor: nodetrace`, `tool: workSurface.evidenceCarousel`, `artifact: demo-artifact`, `step: proof` | No. The proof row it *describes* has `confidence: 0.98`, but that is a stated score, not an external measurement, and the event itself carries no number. | `traversal` only. |
| `events` — "Wrote bounded runtime trace rows" | `scripts/init-sqlite.mjs` | `actor: nodetrace`, `tool: copilot.agentOperationStream`, `step: events` | No. | `traversal` only. |
| `state` — "Published client-safe trace state JSON" | `scripts/init-sqlite.mjs` | `actor: nodetrace`, `tool: shell.statusStrip`, `step: state` | No. | `traversal` only. |

Everything in the table is unmeasured telemetry, so everything renders as
traversal. That is not a limitation of the wiring — it is the wiring telling
the truth. The renderer's own gate (`vendor/nodegraph-live/session.d.ts`,
`observe()`) is: "Exactly two participants plus a measured conjunction
produce evidence. Three or more participants, or a pair with no measurement,
produce only traversal telemetry." Every NodeTrace event extracts three or
four entities and passes no measurement, so it fails the evidence gate twice
over.

The four phases yield 10 distinct entities (1 actor, 4 tools, 1 artifact,
4 steps) and 15 traversal edges — the numbers on the rail header and in the
`capture:live-graph` gate.

The workpaper-reference columns deserve a note, because their names promise
more than their type delivers: `evidence_refs_json` holds
`TraceWorkpaperRef` rows (`src/trace/types.ts`) — `refId`, `kind`, `label`,
`uri`, `hash`, `redacted`. That is a *pointer to* evidence (a file, a URL, a
hash), not a measurement. There is no numeric field anywhere in the type, so
no workpaper ref can currently justify an evidence edge either.

## (b) What today's wiring feeds, and what it refuses

`src/trace/LiveGraphRail.tsx` feeds every `RuntimeTraceRow` from
`public/nodetrace-state.json` (itself read back from
`.nodetrace/nodetrace.sqlite`) into a `GraphSession` as interaction history,
keyed by the row's own `id` so replaying an event cannot inflate an edge.

The refusals, verbatim from commit cdf3cb5's body:

> session.observe() with no
> measured count, so every edge is a constant-width traversal edge and no
> evidence edge can appear. assertEdge is never called — traces are
> telemetry, not curated claims, and the rail caption says so. Clicking a
> node lists the trace event ids that produced it.

Concretely:

- **Fed**: entity co-occurrence (`actor`, `tool`/surface, optional
  `artifact`, `step`/phase per event), event ids for provenance readout,
  visit counts (surfaced as text only — the renderer deliberately never maps
  visits to size, colour or opacity).
- **Refused**: any `measuredCount` argument to `observe()` (so the evidence
  path is unreachable), any `assertEdge()` call (so no badge, no receipt),
  and any use of `duration_ms` or `confidence` as an edge weight. Timing and
  self-assessed confidence are not measurements of the world.

## (c) Named API gaps: what would unlock the next trust class

**Evidence edges** need a measured magnitude with a source. Two changes, one
on each side of the boundary:

1. `trace_events` (`db/schema.sql`) and `RuntimeTraceRow`
   (`src/trace/types.ts`) have no field for a measured count. The unlock is a
   pair of columns/fields — `measured_count integer` and
   `measurement_source_url text` (the literal re-issuable URL or query the
   count came from), or equivalently a `value: number` + `source: string`
   extension to `TraceWorkpaperRef` so an `evidence_refs_json` entry can
   carry the number it points at. Without the source URL the number is just
   an assertion wearing a costume; with it, an independent process can
   re-issue the probe.
2. Even then, `observe()` only grants evidence to **exactly two
   participants**. `LiveGraphRail.entitiesFor()` extracts 3–4 entities per
   event, so a measured event would still need to name *which pair* the
   measurement is about (e.g. `measured_pair` referencing two of the
   extracted entities) rather than smearing one number across every edge of
   a clique.

**Assertion edges** need a complete replay receipt. The renderer's
`AssertionReceipt` (`vendor/nodegraph-live/graph-model.d.ts`) requires
`source`, `release`, `subjectId`, `objectId`, `url`. The closest existing
row is `trace_proofs` (`db/schema.sql`) / `TraceProof`
(`src/trace/types.ts`): it already has `source_label` and `source_url`, but
it is missing all three of the fields that make a claim auditable —

- `source_release` (a **versioned** release of the curating system; the
  happy-path proofs cite `db/schema.sql` with no version at all),
- `subject_id` / `object_id` (stable identifiers for **both endpoints**; a
  proof row today names one surface, not a relationship between two
  entities),
- and `source_url` would have to become mandatory (the happy path writes
  `""`).

Add those three columns to `trace_proofs` and the corresponding fields to
`TraceProof`, and a proof row becomes constructible as
`session.assertEdge(subject, object, receipt)` — a badged, curated claim
whose receipt a reviewer can open. `confidence: real` does not survive this
translation, and should not: the receipt grammar has no confidence field
because a curated claim is either in the named release or it is not.

**Trace events themselves should never upgrade.** An event that says "I ran
phase `state`" is telemetry however many columns are added to it. The upgrade
path runs through measurements (evidence) and curated proofs (assertions),
not through decorating the activity log.

## (d) The next honest upgrade

The next honest upgrade is not to make trace events look stronger — it is to
give `trace_proofs` the three receipt fields it is missing
(`source_release`, `subject_id`, `object_id`, plus a mandatory
`source_url`) and then render proofs, not traces, as `assertEdge()` calls
beside the traversal rail. Proofs are already the curated layer of NodeTrace
— human-shaped claims with a named source — so they are the one row type
whose semantics match the assertion grammar; the schema is just short of a
complete receipt. That change keeps the epistemic split visible in a single
panel: faint constant-width traversal edges for what the system did, badged
assertion edges for what someone is willing to claim with a versioned,
re-openable source — and still zero evidence edges until some NodeTrace row
carries a number measured against an external system of record together with
the URL that re-measures it.
