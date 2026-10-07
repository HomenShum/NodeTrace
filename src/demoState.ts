import { z } from "zod";
import type { NodeTraceState } from "./trace";

// Validate the public file once, before any component indexes nested render fields.
const text = z.string().max(100_000);
const number = z.number().finite();
const identity = { id: text, surfaceId: text, artifactId: text.optional(), elementId: text.optional() };
const sourceUrl = z.union([z.literal(""), z.string().url().refine((url) => /^https?:\/\//i.test(url), "Source must use HTTP or HTTPS")]).optional().transform((value) => value || undefined);
const step = z.object({
  ...identity, order: number, stepLabel: text, group: text.optional(), title: text, narrative: text,
  sourceView: z.object({ imagePath: text, repositoryRoot: text, activeFile: text, folderTree: z.array(text), highlightStartLine: number, highlightEndLine: number, captureKind: text.optional() }),
  codeBlock: z.object({ filePath: text, startLine: number, endLine: number, snippet: text }),
  uiCapture: z.object({ selector: text, rect: z.object({ x: number, y: number, width: number, height: number }), screenshotPath: text, alt: text, captureKind: text.optional() }),
  mapCapture: z.object({ imagePath: text, graphPath: text, model: text }),
  diagram: z.object({ kind: z.enum(["mermaid", "sequence", "graph"]), nodeId: text, source: text }),
});
const stateSchema = z.object({
  generatedAt: text,
  session: z.object({ id: text, title: text, status: text, summary: text }),
  surfaces: z.array(z.object({ id: text, label: text, proofAvailable: z.boolean(), about: text })).max(2_000),
  proofs: z.array(z.object({ ...identity, title: text, detail: text, status: z.enum(["verified", "needs_review", "missing", "ready"]), confidence: number.min(0).max(1), sourceLabel: text, sourceUrl }).passthrough()).max(2_000),
  traces: z.array(z.object({ ...identity, phase: text, actor: text, summary: text, status: z.enum(["ok", "running", "blocked", "error", "ready"]), durationMs: number }).passthrough()).max(2_000),
  coach: z.object({
    mode: z.enum(["campaign", "sandbox"]), activeStepId: text, sourceRepo: text, sourceMode: z.enum(["live", "snapshot"]),
    steps: z.array(step).max(2_000),
    graphNodes: z.array(z.object({ id: text, label: text, kind: z.enum(["schema", "query", "mutation", "component", "effect", "runtime"]) }).passthrough()).max(2_000),
    graphEdges: z.array(z.object({ id: text, from: text, to: text, label: text })).max(2_000),
  }).optional(),
});

export async function loadDemoState(signal: AbortSignal): Promise<NodeTraceState> {
  const response = await fetch("./nodetrace-state.json", { cache: "no-store", signal });
  if (!response.ok) throw new Error(`State request failed (HTTP ${response.status}).`);
  const reader = response.body?.getReader();
  if (!reader) throw new Error("The state response has no body.");
  const decoder = new TextDecoder();
  let body = "";
  let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 1_048_576) {
        await reader.cancel();
        throw new Error("The state file exceeds the 1 MiB demo limit.");
      }
      body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();
  } finally {
    reader.releaseLock();
  }
  let json: unknown;
  try { json = JSON.parse(body); } catch { throw new Error("The state file is not valid JSON."); }
  const parsed = stateSchema.safeParse(json);
  if (!parsed.success) throw new Error("The state file is missing or has invalid trace fields. Regenerate it with the setup command below.");
  // Public JSON is data, never a grant of privileged host capability.
  return { ...parsed.data, builderCapable: false, codeOwnership: [] };
}
