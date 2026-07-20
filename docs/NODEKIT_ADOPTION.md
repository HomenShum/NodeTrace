# NodeKit adoption

NodeTrace is registered as a NodeKit `standalone-package` and maps its current
portable trace UI, SQLite schema, installer, capture CLI, and MCP surface without
moving them into a new directory tree.

## Current conformance level

- **L1 registered:** `nodekit.yaml` declares the repository identity, ownership,
  lifecycle commands, no-key path, environment status, and proof boundary.
- **L2 mapped:** the manifest identifies NodeTrace as the owner of
  `nodetrace.trace-ui-store` and as a consumer of the canonical NodeAgent event
  and trace-workpaper concepts plus ProofLoop certification.

NodeTrace does **not** run a product agent, so it intentionally has no
`nodeagent.yaml`. It renders and stores portable trace state supplied by host
applications. It must not vendor a NodeAgent runtime or define a competing event
protocol.

## Contract boundaries

| Concern | Current truth |
| --- | --- |
| Trace presentation and generic SQLite storage | Owned by NodeTrace |
| Runtime event envelope | Registered dependency on `nodeagent.event/v1`; host adapters may map events into UI rows, but NodeTrace does not yet ship a canonical event translator |
| Trace workpaper contract | Consumed from `nodeagent.trace/v1`; NodeAgent remains the target owner while migration is incomplete |
| Environment | Existing optional `NODETRACE_*` variables remain documented in `.env.example`; alignment to `nodeplatform.env/v1` is planned |
| Certification receipt | ProofLoop owns `proofloop.receipt/v1` |
| NodeTrace setup and eval JSON | Local evidence only; it is not yet a `proofloop.receipt/v1` implementation |

For that reason, `nodekit.yaml` declares `proof.receiptSchema: null`. The
`npm run proof` gate verifies NodeTrace's existing happy path, smoke suites, and
build without claiming canonical receipt compatibility.

## Commands

```bash
npm run demo
npm run doctor
npm run check
npm run proof
```

From a sibling NodeKit checkout, validate the repository contract with:

```bash
node ../node-platform/src/cli.mjs repo check --repo-root .
```
