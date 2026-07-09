# NodeTrace Feature Proof Storyboard

This storyboard governs the README walkthrough assets:

- `docs/walkthroughs/nodetrace-walkthrough.gif`
- `docs/walkthroughs/nodetrace-walkthrough.mp4`

The clip is a proof artifact. It should make the Trace Lens value legible without requiring the viewer to read the full implementation: a visible UI surface maps to a trace, the trace maps to proof cards and runtime events, and the setup path is reproducible without keys.

## Proof Contract

The walkthrough should prove five things:

1. **No-key install path** - a Vite or Next target can receive NodeTrace without provider keys.
2. **Tagged UI surfaces** - visible app regions carry stable surface identifiers.
3. **Trace Lens interaction** - Cmd/Ctrl-click opens a lens tied to the selected surface.
4. **Proof/runtime split** - business proof cards and runtime trace rows are visible as separate evidence regions.
5. **Builder safety** - code ownership and generated-code access stay gated.

## Story Beats

1. **Dashboard overview** - show the no-key sample app and the surfaces available for inspection.
2. **Surface selection** - show a tagged surface selected from the UI.
3. **Trace Lens overlay** - show the panel with business proof, runtime trace, and ownership state.
4. **Trace Coach evidence** - point to NodeRoom real-codebase capture artifacts when discussing deeper source-to-UI debugging.
5. **Receipt handoff** - bind the visual claim to `happy-path`, `smoke`, builder, agent-scale, capture-plan, and trace-coach receipts.

## Capture Command

```bash
npm run clip:capture
```

The command regenerates both README media files from checked-in source screenshots. It requires `ffmpeg` on `PATH`.

## Validation Checklist

- `npm run happy-path`
- `npm run smoke`
- `npm run builder:smoke`
- `npm run agent:scale:smoke`
- `npm run capture:plan:smoke`
- `npm run trace-coach:sqlite`
- `npm run clip:capture`
- `npm run build`

## Follow-Up Integration

- Publish NodeTrace adoption tasks into NodeTasks: install, tag surface, seed trace rows, open lens, verify proof/runtime split, and capture real-codebase evidence.
- Use NodeGraph to visualize trace causality: surface, trace, proof card, runtime event, mutation, source file, screenshot, and receipt nodes.
- Use feature-proof-studio when refreshing public media so the final README clip can include cursor movement, labels, and route/state beats.
