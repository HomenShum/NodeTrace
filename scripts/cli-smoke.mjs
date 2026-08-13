import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createCaptureFixture } from "./capture-plan-fixture.mjs";

const issues = [];
const tempDir = mkdtempSync(join(tmpdir(), "nodetrace-cli-smoke-"));
const viteTarget = join(tempDir, "vite-app");
const nextTarget = join(tempDir, "next-app");

createTarget(viteTarget, "vite");
runInstall(viteTarget, ["--framework", "vite"]);
validateTarget(viteTarget, "vite", issues);

createTarget(nextTarget, "next");
runInstall(nextTarget, ["--framework", "next"]);
validateTarget(nextTarget, "next", issues);
runCaptureDryRun();

const report = {
  ok: issues.length === 0,
  completedAt: new Date().toISOString(),
  apiKeysRequired: false,
  frameworks: ["vite", "next"],
  issues,
};
writeJson("docs/eval/nodetrace-cli-smoke.json", report);
if (tempDir.startsWith(tmpdir())) rmSync(tempDir, { recursive: true, force: true });

if (issues.length > 0) {
  console.error("nodetrace cli smoke: FAIL");
  for (const issue of issues) console.error(`  - ${issue}`);
  process.exitCode = 1;
} else {
  console.log("nodetrace cli smoke: PASS");
}

function mkdirp(path) {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

function createTarget(targetDir, framework) {
  mkdirp(targetDir);
  const pkg = {
    name: `nodetrace-${framework}-target`,
    private: true,
    type: "module",
    scripts: { build: "node -e \"console.log('target build placeholder')\"" },
    dependencies: framework === "next" ? { next: "^15.0.0", react: "^19.0.0", "react-dom": "^19.0.0" } : {},
  };
  writeFileSync(join(targetDir, "package.json"), `${JSON.stringify(pkg, null, 2)}\n`);
  if (framework === "next") {
    mkdirp(join(targetDir, "src", "app"));
    writeFileSync(join(targetDir, "src", "app", "page.tsx"), "export default function Page() { return null; }\n");
  } else {
    mkdirp(join(targetDir, "src"));
    writeFileSync(join(targetDir, "src", "main.tsx"), "console.log('target app');\n");
  }
}

function runInstall(targetDir, extraArgs) {
  const result = spawnSync(process.execPath, ["bin/nodetrace.mjs", "add", "--target", targetDir, "--skip-install", "--skip-verify", ...extraArgs], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  if (result.status !== 0) issues.push(`nodetrace add failed for ${targetDir}: ${[result.stdout, result.stderr].join("\n").slice(-1200)}`);
}

function runCaptureDryRun() {
  const { planPath } = createCaptureFixture(tempDir);
  for (const command of [
    ["bin/nodetrace.mjs", "capture", "--plan", planPath, "--dry-run"],
    ["bin/nodetrace-capture.mjs", "--plan", planPath, "--dry-run"],
  ]) {
    const result = spawnSync(process.execPath, command, {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    if (result.status !== 0) issues.push(`capture dry run failed for ${command[0]}: ${[result.stdout, result.stderr].join("\n").slice(-1200)}`);
  }
}

function validateTarget(targetDir, framework, issues) {
  for (const file of [
    "src/nodetrace/TraceLensPanel.tsx",
    "src/nodetrace/TraceLensProvider.tsx",
    "src/nodetrace-demo/DemoDashboard.tsx",
    "db/nodetrace.schema.sql",
    "scripts/nodetrace-init.mjs",
    "scripts/nodetrace-smoke.mjs",
    framework === "next" ? "src/app/nodetrace/page.tsx" : "nodetrace.html",
    "docs/NODETRACE_INTEGRATION.md",
    ".nodetrace/setup-receipt.json",
  ]) {
    if (!existsSync(join(targetDir, file))) issues.push(`${framework} missing ${file}`);
  }
  const pkg = JSON.parse(readFileSync(join(targetDir, "package.json"), "utf8"));
  for (const script of ["nodetrace:dev", "nodetrace:happy-path", "nodetrace:smoke"]) {
    if (!pkg.scripts?.[script]) issues.push(`${framework} package missing ${script}`);
  }
  const panel = readFileSync(join(targetDir, "src/nodetrace/TraceLensPanel.tsx"), "utf8");
  const provider = readFileSync(join(targetDir, "src/nodetrace/TraceLensProvider.tsx"), "utf8");
  for (const required of ["Business proof", "Runtime trace", "Code ownership", "Review", "Builder", "Query", "Mutation", "Skill"]) {
    if (!panel.includes(required)) issues.push(`${framework} panel missing ${required}`);
  }
  for (const required of ["data-nodetrace-surface", "data-noderoom-surface"]) {
    if (!provider.includes(required)) issues.push(`${framework} provider missing ${required}`);
  }
  validateInstalledImports(targetDir, framework, issues);
}

// The installer copies a hand-listed set of paths. Anything the copied code
// imports from outside that set resolves in this repo and nowhere else, and the
// target only finds out at build time (see D2). Check it here instead.
function validateInstalledImports(targetDir, framework, issues) {
  for (const root of ["src/nodetrace", "src/nodetrace-demo"]) {
    const rootDir = join(targetDir, root);
    if (!existsSync(rootDir)) continue;
    for (const entry of readdirSync(rootDir, { recursive: true })) {
      const file = join(rootDir, String(entry));
      if (!/\.(tsx?|jsx?|mjs)$/.test(file) || !statSync(file).isFile()) continue;
      for (const match of readFileSync(file, "utf8").matchAll(/(?:from|import)\s+"(\.[^"]*)"/g)) {
        if (resolvesInTarget(dirname(file), match[1])) continue;
        const shown = relative(targetDir, file).replaceAll("\\", "/");
        issues.push(`${framework} ${shown} imports ${match[1]}, which the installer never copied into the target`);
      }
    }
  }
}

function resolvesInTarget(fromDir, specifier) {
  const base = resolve(fromDir, specifier);
  return ["", ".ts", ".tsx", ".js", ".jsx", ".css", "/index.ts", "/index.tsx", "/index.js"]
    .some((suffix) => existsSync(base + suffix) && statSync(base + suffix).isFile());
}

function writeJson(path, value) {
  const parent = dirname(path);
  mkdirp(parent);
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}
