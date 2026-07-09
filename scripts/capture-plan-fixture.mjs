import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export function createCaptureFixture(rootDir) {
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
          captureKind: "dry-run-only",
        },
      },
    ],
  }, null, 2)}\n`);
  return { planPath, sourceRoot, captureRoot };
}

function mkdirp(path) {
  mkdirSync(path, { recursive: true });
}
