# NodeTrace developer handoff

A developer can inspect saved trace events, source captures and proof records in the source demo, or install the portable trace UI in an existing React application. NodeTrace does not run an agent or certify the claims shown in imported records.

## Run and verify

Use Node 22 and `npm ci`, then `npm run happy-path` and `npm run dev` for the local SQLite sample. `npm run trace-coach:sqlite` prepares the bundled guided snapshot. The source-repository commands for new captures require a real NodeRoom checkout; the snapshot does not imply that checkout exists.

Run `npm run check` for the repository package, capture and installed Next checks. Run `node scripts/ui-readiness.mjs` for the rendered state/history/keyboard/recovery journey at seven widths. It creates its own preview, exercises both seed states and stores timestamped evidence. Do not run a second build concurrently. The source state request is bounded and has explicit timeout/retry; public producers remain responsible for excluding privileged records before publishing their JSON.

For a separate application, follow README and the CLI-generated `docs/NODETRACE_INTEGRATION.md`. The installed demo explicitly selects installed guidance: `npm run nodetrace:happy-path` regenerates its local sample. Guided source/UI captures are not included in that generated sample. The installer preserves existing dependency ranges; a fresh Next 15.5.25 consumer was installed, built and exercised. An installed Vite build was not part of this final narrow review.

## Reviewed changes and proof

The repair adds ordinary inspection controls, a native keyboard modal with reliable focus return, demo-owned deep links/history, connected keyboard tabs, readable ink, bounded state validation and recovery, and truthful source/installed guidance. Builder authority is not read from URL parameters or public state. Source captures, event semantics and vendored graph layout are preserved.

See `evidence/portfolio-ui-repair-20260905/README.md` for the exact receipts and screenshots. Independent review passed 808 source-journey checks and 52 installed checks. Smoke/citations and actual Next installation/build pass. Quiet lab accessibility/performance passes; the previous slower run and two adjudicated WIG probe failures remain visible. Thirteen implementation hashes in the journey receipt must match before reusing that evidence.

## Remaining readiness work

This is a reviewed local repair, not a whole-product readiness certificate. Narrow graph labels can still clip or overlap, and the inherited development-tool advisory needs a separate compatible lock repair. Full visual/design/responsive/interaction/accessibility/performance/usage/alignment grades, physical touch, a fresh human usability session, deployment and shared integration are pending. The source demo's graph/capture claims do not certify arbitrary consumer data or a production system.
