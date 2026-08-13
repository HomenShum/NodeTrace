import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

// The page the fixture's UI step photographs. It is served over HTTP by the
// caller, because a capture screenshots a running app, never a file on disk.
export const FIXTURE_APP_HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>capture fixture</title></head>
<body style="margin:0;font:16px system-ui">
  <section data-nodetrace-surface="workSurface.traceStrip"
           style="width:320px;height:120px;background:#123;color:#fff;padding:16px">
    Trace strip
  </section>
</body></html>
`;

/**
 * Build a throwaway capture plan on disk.
 *
 * Pass `appUrl` to get a plan the capture engine can actually run: the UI step
 * then photographs that URL. Leave it out and the UI step is marked
 * `dry-run-only`, which is all a plan-validation check needs.
 */
export function createCaptureFixture(rootDir, { appUrl } = {}) {
  const sourceRoot = join(rootDir, "capture-source");
  const captureRoot = join(rootDir, "capture-output");
  const sourceFile = join(sourceRoot, "src", "ui", "panels", "Artifact.tsx");
  const planPath = join(rootDir, "capture-plan.json");
  mkdirp(dirname(sourceFile));
  mkdirp(captureRoot);
  writeFileSync(sourceFile, [
    "export function Artifact() {",
    "  return <section data-nodetrace-surface=\"workSurface.traceStrip\">Trace</section>;",
    "}",
    "",
  ].join("\n"));
  writeFileSync(planPath, `${JSON.stringify({
    id: "nodetrace-smoke-capture",
    sourceRepo: "local-fixture",
    sourceRoot,
    captureRoot,
    manifestPath: join(captureRoot, "manifest.json"),
    assetPathPrefix: "captures",
    editor: { mode: "code-browser" },
    ...(appUrl ? { app: { name: "capture-fixture", url: appUrl } } : {}),
    steps: [
      {
        id: "fixture-trace-strip",
        source: {
          filePath: "src/ui/panels/Artifact.tsx",
          anchor: "data-nodetrace-surface",
          before: -1,
          after: 2,
        },
        ui: {
          selector: "[data-nodetrace-surface=\"workSurface.traceStrip\"]",
          ...(appUrl ? { actions: [{ type: "goto" }] } : { captureKind: "dry-run-only" }),
        },
      },
    ],
  }, null, 2)}\n`);
  return { planPath, sourceRoot, captureRoot };
}

function mkdirp(path) {
  mkdirSync(path, { recursive: true });
}
