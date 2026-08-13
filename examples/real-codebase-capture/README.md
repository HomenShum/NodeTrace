# Real Codebase Capture

This example makes NodeTrace capture proof reusable outside NodeRoom. A coding
agent edits a JSON plan, then runs the CLI or MCP tool to capture:

- actual source screenshots rendered from real files
- actual running-app screenshots
- live DOMRects from stable selectors
- a manifest that a trace UI can ingest

## CLI

```bash
npx github:HomenShum/NodeTrace capture --plan examples/real-codebase-capture/noderoom.capture.json --dry-run
npx github:HomenShum/NodeTrace capture --plan examples/real-codebase-capture/noderoom.capture.json
```

After npm publication:

```bash
npx @homenshum/nodetrace capture --plan examples/real-codebase-capture/noderoom.capture.json
npx nodetrace-capture --plan examples/real-codebase-capture/noderoom.capture.json
```

Use `--app-url http://127.0.0.1:PORT/` when the target app is already running.

## MCP

Local MCP clients can run:

```json
{
  "mcpServers": {
    "nodetrace-capture": {
      "command": "npx",
      "args": ["-y", "-p", "github:HomenShum/NodeTrace", "nodetrace-mcp"]
    }
  }
}
```

The MCP server exposes:

- `validate_capture_plan`: checks files, anchors, paths, and output locations.
- `capture_codebase`: runs the full real source plus running-app capture.

## Porting Checklist

1. Set `sourceRoot` to the repo being explained.
2. Set `app.startCommand` or pass `--app-url`.
3. Add stable app selectors such as `data-testid`, `data-nodetrace-surface`, or `data-noderoom-surface`.
4. For each step, set `source.filePath` and either `source.anchor` or `source.startLine`/`source.endLine`.
5. For each step, set `ui.selector` and any `ui.actions` needed to reach that state.
6. Run `--dry-run`, then run the full capture.
7. Inspect PNGs before committing the manifest.

`editor.mode` is `code-browser`, and that is the only mode. It renders real
repository files with Shiki in a local browser page, so a capture needs no
editor installed and runs the same headless in CI as on a laptop.
