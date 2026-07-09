import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { createCaptureFixture } from "./capture-plan-fixture.mjs";

const issues = [];
const tempDir = mkdtempSync(join(tmpdir(), "nodetrace-mcp-smoke-"));
const { planPath } = createCaptureFixture(tempDir);
const client = new Client({ name: "nodetrace-mcp-smoke", version: "0.0.0" }, { capabilities: {} });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: ["bin/nodetrace-mcp.mjs"],
  cwd: process.cwd(),
  stderr: "pipe",
});

try {
  await client.connect(transport);
  const tools = await client.listTools();
  for (const required of ["validate_capture_plan", "capture_codebase"]) {
    if (!tools.tools.some((tool) => tool.name === required)) issues.push(`missing MCP tool ${required}`);
  }
  const result = await client.callTool({
    name: "validate_capture_plan",
    arguments: {
      planPath,
      cwd: process.cwd(),
    },
  });
  const text = result.content?.[0]?.text ?? "";
  if (!text.includes('"ok": true') || !text.includes('"steps": 1')) issues.push(`unexpected MCP validate result: ${text}`);
} catch (error) {
  issues.push(error instanceof Error ? error.message : String(error));
} finally {
  await client.close().catch(() => undefined);
  rmSync(tempDir, { recursive: true, force: true });
}

if (issues.length > 0) {
  console.error("nodetrace mcp smoke: FAIL");
  for (const issue of issues) console.error(`  - ${issue}`);
  process.exitCode = 1;
} else {
  console.log("nodetrace mcp smoke: PASS");
}
