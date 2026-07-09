# Long-Running QA Agent Example

This example is the coding-agent prompt for teams that want to inject NodeTrace
into a demo app with a long-running QA, browser, or workflow agent.

```text
Install NodeTrace into this app.

Run:
npx github:HomenShum/NodeTrace add --framework vite
# or, for Next App Router:
npx github:HomenShum/NodeTrace add --framework next

Keep the no-key happy path green first:
npm run nodetrace:happy-path
npm run nodetrace:smoke
npm run build

Then adapt our QA agent run state into NodeTraceState:
- one trace_sessions row per QA run
- one trace_surfaces row per visible product surface
- one trace_events row per agent step, tool call, retry, browser action, or receipt
- one trace_proofs row per user-facing claim/evidence card
- no codeOwnership in public client state unless builderCapable is server verified

For 100+ step runs, keep the full ledger durable server-side and expose a bounded
client window for the clicked surface. The bundled Trace Lens renders the newest
six relevant rows for the clicked surface and keeps Builder ownership gated.

If Builder mode is allowed, serve ownership through a privileged server route
with componentRef, queryRef, mutationRef, skillRef, and testRef. Do not put file
paths, query names, mutation names, skill paths, raw prompts, cookies, or tokens
into public state.

Done:
npm run nodetrace:happy-path
npm run nodetrace:smoke
npm run build
Cmd/Ctrl-click a tagged QA surface and verify Review mode opens without secrets.
```

Repo proof:

```bash
npm run agent:scale:smoke
```

That smoke builds a 125-step QA-agent trace fixture, verifies the public state
does not expose Builder ownership, and confirms the Trace Lens remains bounded.
