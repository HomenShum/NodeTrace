import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { createCaptureFixture } from "./capture-plan-fixture.mjs";

const tempDir = mkdtempSync(join(tmpdir(), "nodetrace-capture-plan-smoke-"));
const reportPath = "docs/eval/nodetrace-capture-plan-smoke.json";
const issues = [];

try {
  const { planPath } = createCaptureFixture(tempDir);
  const result = spawnSync(process.execPath, ["bin/nodetrace.mjs", "capture", "--plan", planPath, "--dry-run"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  if (result.status !== 0) {
    issues.push([result.stdout, result.stderr].join("\n").slice(-1200));
  } else if (!result.stdout.includes("nodetrace capture dry run: PASS 1 steps")) {
    issues.push(`unexpected dry-run output: ${result.stdout}`);
  }
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

writeJson(reportPath, {
  ok: issues.length === 0,
  completedAt: new Date().toISOString(),
  fixture: "local disposable capture plan",
  issues,
});

if (issues.length > 0) {
  console.error("nodetrace capture plan smoke: FAIL");
  for (const issue of issues) console.error(`  - ${issue}`);
  process.exitCode = 1;
} else {
  console.log("nodetrace capture plan smoke: PASS");
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}
