# NodeKit adoption

A developer adding trace inspection to an existing application needs to know
which package owns the display and which runtime supplies its records.
NodeTrace owns the portable trace UI, generic SQLite storage, installer,
capture CLI and MCP capture tools. The host application supplies its runtime,
authorization and trace data.

This ownership map complements [START_HERE.md](START_HERE.md),
[AGENT_TRACE_ADOPTION.md](AGENT_TRACE_ADOPTION.md) and the
[current developer handoff](../HANDOFF.md). It describes declared boundaries,
not a completed protocol migration or product certification.

## Declared ownership

`nodekit.yaml` registers a `standalone-package`, owning
`nodetrace.trace-ui-store` and consuming the repository, event, workpaper and
certification contracts. NodeTrace has no product-agent definition:
`nodeagent.yaml` is not required for this display/storage package.

| Concern | Current implementation boundary |
| --- | --- |
| Trace presentation and generic SQLite storage | Owned by NodeTrace; portable to host applications |
| Runtime event envelope | Manifest consumes `nodeagent.event-protocol`; hosts map their records into NodeTrace state. A canonical `nodeagent.event/v1` translator remains unimplemented |
| Trace workpaper | Optional display fields are documented in [TRACE_WORKPAPER_STANDARD.md](TRACE_WORKPAPER_STANDARD.md); declaring consumption does not establish full `nodeagent.trace/v1` compatibility |
| Environment | Optional `NODETRACE_*` variables are listed in [.env.example](../.env.example); alignment to `nodeplatform.env/v1` is planned |
| Certification receipt | `proof.receiptSchema: null`; setup and eval JSON are local evidence, not a `proofloop.receipt/v1` implementation |

An imported trace row can describe an action without proving that action was
correct. Keep source-backed proof separate from runtime telemetry and serve
Builder-only records only after the host verifies access.

## Commands and proof scope

Use the scripts already defined in [package.json](../package.json):

| Command | Actual scope |
| --- | --- |
| `npm run demo` / `npm run doctor` | Generate the local SQLite happy path |
| `npm run proof` | Run the temporary SQLite happy-path and documentation/schema smoke, installer CLI smoke and MCP smoke |
| `npm run check` | Run `prepush`: happy path, smoke, citations, Builder safety, 125-step fixture, capture-plan proof, bundled coach, installed Next build, repository build, package dry run and production dependency audit |
| `npm run dev` | Start the local Vite service |

`npm run proof` includes a temporary SQLite initialization through its smoke
script; it does not run the build or full `prepush` gate. The 125-step fixture
is a bounded scenario check, not sustained production proof. Fresh external-app
captures require a real checkout and the separate capture commands described
in README; bundled captures do not establish a fresh run.

If the sibling checkout directory is named `NodeKit`, the repository-contract
command is:

```bash
node ../NodeKit/src/cli.mjs repo check --repo-root .
```

Use the actual sibling path when it differs. Contract conformance, package
verification and rendered UI acceptance are separate judgments. Current UI
grades and remaining user/device/deployment work are recorded in
[HANDOFF.md](../HANDOFF.md).
