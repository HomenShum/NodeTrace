# Stack

Everything here is checkable against `package.json` and `tsconfig.json`.

## Runtime and language

- **Node 20 or newer** (`package.json` `engines.node: ">=20"`). Two things
  actually depend on that floor: `node:util`'s `parseArgs`, used by every CLI in
  the repository, and top-level `await` in `bin/nodetrace-mcp.mjs`.
- **ES modules everywhere** (`"type": "module"`). There is no CommonJS file.
- **TypeScript 5.7** for the browser code only, and **never emitted**: the build
  is `tsc --noEmit && vite build`, so TypeScript is a checker and Vite is the
  compiler. `tsconfig.json` sets `strict: true` and `noEmit: true`.
- **Plain `.mjs`, no types**, for everything that runs in Node: `bin/`,
  `scripts/`, `src/capture/`. This split is the single most surprising thing
  about the repository and it is deliberate — the Node-side files are copied
  verbatim into other people's projects, and a copied file that needs a
  TypeScript toolchain is a file that cannot be copied.

## Browser

| Package | Why it is here |
|---|---|
| `react` 19, `react-dom` 19 | The panel is a React component; that is the product. |
| `lucide-react` | Icons in the panel and demo. |
| `sigma` 3, `graphology`, `graphology-layout-forceatlas2`, `@sigma/node-border` | Not imported by our source at all. They are the peer requirements of `vendor/nodegraph-live/`, the pre-built graph renderer the live rail draws with. |

## Node side

| Package | Why it is here |
|---|---|
| `better-sqlite3` | Synchronous SQLite. Every write path uses it. Native module — it compiles on install, which is the most common first-run problem. |
| `@modelcontextprotocol/sdk` | The stdio MCP server in `bin/nodetrace-mcp.mjs`. |
| `zod` 4 | Declares the MCP tools' input schemas. Used nowhere else. |
| `shiki` 4 | Syntax-highlights real source files into HTML so the capture engine can photograph them. Imported dynamically at `src/capture/codebaseCapture.mjs`. |
| `playwright` (dev) | Drives headless Chromium for captures and browser probes. |
| `vite` 6, `@vitejs/plugin-react` (dev) | Dev server and production build. |

## One packaging inconsistency, stated rather than hidden

`playwright` is a **devDependency**, but `src/capture/codebaseCapture.mjs` — which
ships in the published package and is reached by the `nodetrace-capture` and
`nodetrace-mcp` binaries — imports it. A consumer who installs
`@homenshum/nodetrace` and runs a real capture gets the message
`Missing dependency: install Playwright before running nodetrace capture.` That
message is deliberate and the import is dynamic, so nothing crashes, but the
package does not declare what its own CLI needs. Recorded in `CONCERNS.md`.

## Build outputs

- `npm run build` → `dist/`, currently 431 kB of JavaScript and 15 kB of CSS
  (uncompressed; 122 kB gzipped). Most of that weight is the Sigma/graphology
  graph renderer.
- `npm run package:dry-run` → 100 files, 3.8 MB packed. The bulk is committed
  PNG and MP4 evidence under `docs/` and `public/captures/`, not code.

## What is deliberately absent

No test runner (Vitest, Jest, Playwright Test). No linter or formatter config.
No state manager. No router. No CSS framework — `src/styles.css` and
`src/trace/trace.css` are hand-written. No CI matrix; one Ubuntu job.
