import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const frames = [
  { path: "docs/screenshots/nodetrace-dashboard.png", duration: 2.8 },
  { path: "docs/screenshots/nodetrace-trace-lens.png", duration: 2.8 },
];
const mp4 = "docs/walkthroughs/nodetrace-walkthrough.mp4";
const gif = "docs/walkthroughs/nodetrace-walkthrough.gif";
const receipt = "docs/walkthroughs/nodetrace-walkthrough-receipt.json";
const expectedDurationSeconds = frames.reduce((total, frame) => total + frame.duration, 0);
const durationToleranceSeconds = 0.5;
const verifyOnly = process.argv.includes("--verify-only");
const outputs = [
  {
    path: mp4,
    codec: "h264",
    width: 960,
    frameRate: 12,
    frameRateTolerance: 0.001,
    filter: "scale=960:-2,fps=12,format=yuv420p",
    options: ["-movflags", "+faststart"],
  },
  {
    path: gif,
    codec: "gif",
    width: 720,
    frameRate: 8,
    frameRateTolerance: 0.5,
    filter: "fps=8,scale=720:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse",
    options: [],
  },
];

main();

function main() {
  for (const frame of frames) {
    if (!existsSync(frame.path)) throw new Error(`missing walkthrough source frame ${frame.path}`);
  }
  if (verifyOnly) {
    for (const output of outputs) {
      if (!existsSync(output.path)) throw new Error(`missing walkthrough output ${output.path}`);
      verifyMedia(output);
    }
    const expected = `${JSON.stringify(buildReceipt(), null, 2)}\n`;
    const actual = existsSync(receipt)
      ? readFileSync(receipt, "utf8").replace(/\r\n?/g, "\n")
      : "";
    if (actual !== expected) {
      const index = [...expected].findIndex((character, offset) => character !== actual[offset]);
      throw new Error(
        `${receipt} is stale at byte ${index}; run npm run walkthroughs:render ` +
          `(expected ${JSON.stringify(expected.slice(index, index + 80))}, ` +
          `received ${JSON.stringify(actual.slice(index, index + 80))})`,
      );
    }
    console.log(`walkthrough media: PASS ${mp4} ${gif} ${receipt}`);
    return;
  }
  ensureParent(mp4);
  ensureParent(gif);
  const tempDir = mkdtempSync(`${tmpdir()}/nodetrace-walkthrough-`);
  try {
    const listPath = `${tempDir}/frames.txt`;
    writeFileSync(listPath, concatList(frames));
    run("ffmpeg", [
      "-y",
      "-f", "concat",
      "-safe", "0",
      "-i", listPath,
      "-vf", outputs[0].filter,
      ...outputs[0].options,
      mp4,
    ]);
    run("ffmpeg", [
      "-y",
      "-i", mp4,
      "-vf", outputs[1].filter,
      ...outputs[1].options,
      gif,
    ]);
    for (const output of outputs) verifyMedia(output);
    ensureParent(receipt);
    writeFileSync(receipt, `${JSON.stringify(buildReceipt(), null, 2)}\n`, "utf8");
    console.log(`walkthrough media: PASS ${mp4} ${gif} ${receipt}`);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function buildReceipt() {
  return {
    schemaVersion: "nodetrace.walkthrough-receipt/v1",
    sources: frames.map((frame) => ({
      path: frame.path,
      durationSeconds: frame.duration,
      sha256: sha256(frame.path),
    })),
    outputs,
    expectedDurationSeconds,
    durationToleranceSeconds,
  };
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function verifyMedia(expected) {
  const result = spawnSync(
    "ffprobe",
    [
      "-v", "error",
      "-select_streams", "v:0",
      "-show_entries", "stream=codec_name,width,height,avg_frame_rate",
      "-show_entries", "format=duration",
      "-of", "json",
      expected.path,
    ],
    { encoding: "utf8" },
  );
  if (result.status !== 0) {
    throw new Error(`ffprobe failed for ${expected.path}: ${result.stderr || result.stdout}`);
  }
  const payload = JSON.parse(result.stdout);
  const stream = payload.streams?.[0];
  const duration = Number(payload.format?.duration);
  const frameRate = fraction(stream?.avg_frame_rate);
  const failures = [];
  if (stream?.codec_name !== expected.codec) failures.push(`codec ${stream?.codec_name}`);
  if (stream?.width !== expected.width) failures.push(`width ${stream?.width}`);
  if (!Number.isInteger(stream?.height) || stream.height <= 0) failures.push(`height ${stream?.height}`);
  if (Math.abs(frameRate - expected.frameRate) > expected.frameRateTolerance) {
    failures.push(`frame rate ${frameRate}`);
  }
  if (!Number.isFinite(duration) ||
      Math.abs(duration - expectedDurationSeconds) > durationToleranceSeconds) {
    failures.push(`duration ${duration}`);
  }
  if (failures.length > 0) {
    throw new Error(`${expected.path} violates walkthrough contract: ${failures.join(", ")}`);
  }
}

function fraction(value) {
  const [numerator, denominator] = String(value ?? "").split("/").map(Number);
  return denominator ? numerator / denominator : Number.NaN;
}

function concatList(items) {
  const lines = [];
  for (const item of items) {
    lines.push(`file '${ffmpegPath(resolve(item.path))}'`);
    lines.push(`duration ${item.duration}`);
  }
  lines.push(`file '${ffmpegPath(resolve(items.at(-1).path))}'`);
  return `${lines.join("\n")}\n`;
}

function ffmpegPath(path) {
  return path.replace(/\\/g, "/").replace(/'/g, "'\\''");
}

function ensureParent(path) {
  const parent = dirname(path);
  if (parent && parent !== ".") mkdirSync(parent, { recursive: true });
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`${command} failed: ${[result.stdout, result.stderr].join("\n").slice(-2000)}`);
  }
}
