/** A reviewer opens a saved trace, follows its evidence, and returns after interruptions. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { assertPortFree, assertPageIsThisTree, startPreview, waitForServer, waitForPaintedGraph, killTree } from "./lib/proof-server.mjs";

import { recordEntityCanvas, inspectEntityJob } from "./lib/entity-inspection-proof.mjs";

const port = Number(process.env.NODETRACE_CAPTURE_PORT ?? 4917);
const url = `http://127.0.0.1:${port}/`;
const out = path.resolve(process.env.NODETRACE_UI_EVIDENCE ?? `evidence/ui-readiness/runs/${new Date().toISOString().replaceAll(":", "-")}`);
mkdirSync(out, { recursive: true });
const sizes = [[320, 800], [360, 800], [390, 844], [768, 1024], [1024, 768], [1440, 960], [1920, 1080]];
const files = ["vendor/nodegraph-live/NodeGraph.d.ts", "scripts/lib/entity-inspection-proof.mjs", "vendor/nodegraph-live/NodeGraph.js", "src/DemoDashboard.tsx", "src/demoNavigation.ts", "src/demoState.ts", "src/styles.css", "src/trace/TraceLensPanel.tsx", "src/trace/TraceLensProvider.tsx", "src/trace/trace.css", "src/trace/LiveGraphRail.tsx", "package.json", "package-lock.json", "scripts/ui-readiness.mjs", "bin/nodetrace.mjs", ".gitattributes"];
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const sources = Object.fromEntries(files.map((file) => [file, sha(readFileSync(file))]));
const checks = [], captures = [], inputs = [];
const check = (name, pass, detail) => { checks.push({ name, pass: Boolean(pass), detail }); assert.ok(pass, name); };
const run = (script) => {
  const result = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", ["run", script], { encoding: "utf8", shell: process.platform === "win32" });
  writeFileSync(path.join(out, `${script.replaceAll(":", "-")}-${inputs.length}.log`), result.stdout + result.stderr);
  assert.equal(result.status, 0, `npm run ${script}`);
};
let browser, server, activePage;
const errors = [];
async function ready(page) { await page.waitForFunction(() => document.querySelector("[data-trace-inspect]")?.disabled === false); }
async function snap(page, name) {
  await page.evaluate(() => document.fonts.ready);
  const dom = await page.evaluate(() => ({ url: location.href, viewport: { width: innerWidth, height: innerHeight }, overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth, focus: document.activeElement?.outerHTML, headings: [...document.querySelectorAll("h1,h2,h3")].map((node) => ({ level: node.tagName, text: node.textContent })), modal: Boolean(document.querySelector("dialog:modal")) }));
  await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: !dom.modal });
  writeFileSync(path.join(out, `${name}.html`), await page.content());
  writeFileSync(path.join(out, `${name}.json`), JSON.stringify(dom, null, 2));
  captures.push({ name, ...dom, errors: [...errors] });
  check(`${name}: no document overflow`, dom.overflow <= 1, dom.overflow);
}
async function open(page, selector = "[data-trace-inspect]") {
  await page.locator(selector).last().click();
  await page.locator("dialog:modal").waitFor();
}
async function closed(page) { await page.locator("dialog").waitFor({ state: "detached" }); }
await assertPortFree(port);
try {
  browser = await chromium.launch();
  for (const seed of ["happy-path", "trace-coach:sqlite"]) {
    run(seed); run("build");
    const bytes = readFileSync("public/nodetrace-state.json"), state = JSON.parse(bytes);
    const assets = Object.fromEntries((state.coach?.steps ?? []).flatMap((step) => [step.sourceView.imagePath, step.uiCapture.screenshotPath, step.mapCapture.imagePath]).map((file) => [file, sha(readFileSync(path.join("public", file.replace(/^\//, ""))))]));
    inputs.push({ seed, sha256: sha(bytes), assets });
    writeFileSync(path.join(out, `${seed.replace(":", "-")}-input.json`), bytes);
    server = startPreview(port); await waitForServer(url);
    const context = await browser.newContext();
    await recordEntityCanvas(context);
    const page = activePage = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    for (const [width, height] of sizes) {
      await page.setViewportSize({ width, height });
      await page.goto(`${url}?unrelated=preserved#review`, { waitUntil: "load" }); await ready(page);
      await assertPageIsThisTree(page); await waitForPaintedGraph(page);
      const label = `${seed.replace(":", "-")}-${width}`;
      await snap(page, `${label}-overview`);
      await inspectEntityJob(page, state, { check, snap, label });
      check(`${label}: graph remains traversal history`, await page.locator(".liveGraphRailHead").innerText().then((text) => text.includes("never evidence")));
      if (state.coach) {
        check(`${label}: truthful snapshot`, (await page.locator(".coachSource").innerText()).includes("bundled snapshot"));
        for (const tab of ["steps", "flow", "raw", "overview"]) {
          await page.locator(`#coach-tab-${tab}`).click();
          check(`${label}: ${tab} owns visible panel`, await page.locator(`#coach-panel-${tab}`).isVisible());
        }
        await page.locator("#coach-tab-overview").focus(); await page.keyboard.press("End");
        check(`${label}: tab End selects Raw`, await page.locator("#coach-tab-raw").getAttribute("aria-selected") === "true");
        const raw = JSON.parse(await page.locator('[data-testid="trace-raw"]').innerText());
        check(`${label}: full recorded step including capture provenance`, JSON.stringify(raw.activeStep) === JSON.stringify(state.coach.steps[0]) || JSON.stringify(sort(raw.activeStep)) === JSON.stringify(sort(state.coach.steps[0])));
        await snap(page, `${label}-raw`);
        await page.reload(); await ready(page);
        check(`${label}: Raw survives reload`, await page.locator("#coach-tab-raw").getAttribute("aria-selected") === "true");
        await page.keyboard.press("Tab");
        await page.locator("#coach-tab-raw").focus(); await page.keyboard.press("Home");
        check(`${label}: tab Home selects Overview`, await page.locator("#coach-tab-overview").getAttribute("aria-selected") === "true");
        await page.getByTestId("trace-record").nth(1).click();
        check(`${label}: record selection in URL`, new URL(page.url()).searchParams.get("step") === state.coach.steps[1].id);
      } else {
        check(`${label}: empty state explains next command`, await page.locator(".coachEmpty").innerText().then((text) => text.includes("npm run trace-coach:sqlite")));
      }
      const opener = page.locator("[data-trace-inspect]").last();
      await opener.focus(); await page.keyboard.press("Enter"); await page.locator("dialog:modal").waitFor();
      check(`${label}: initial focus inside modal`, await page.evaluate(() => document.querySelector("dialog").contains(document.activeElement)));
      for (let i = 0; i < 12; i++) {
        await page.keyboard.press(i % 3 === 0 ? "Shift+Tab" : "Tab");
        check(`${label}: modal Tab ${i}`, await page.evaluate(() => document.querySelector("dialog").contains(document.activeElement)));
      }
      check(`${label}: public demo cannot enter builder mode`, await page.getByRole("button", { name: "Builder", exact: true }).count() === 0);
      await snap(page, `${label}-lens`);
      await page.keyboard.press("Escape"); await closed(page);
      check(`${label}: focus returns to opener`, await opener.evaluate((node) => node === document.activeElement));
      check(`${label}: unrelated query/hash survive`, new URL(page.url()).searchParams.get("unrelated") === "preserved" && new URL(page.url()).hash === "#review");
      await page.goBack(); await page.locator("dialog:modal").waitFor();
      await page.goForward(); await closed(page);
      check(`${label}: browser Back and Forward restore open/closed lens`, !new URL(page.url()).searchParams.has("surface"));
    }
    if (state.coach) {
      const long = structuredClone(state);
      long.traces[0] = { ...long.traces[0], actor: "Reviewer_" + "long-identifier-".repeat(14),
        surfaceId: "tool:" + "供应商🙂/".repeat(35), artifactId: "artifact_" + "a".repeat(520),
        id: "event_" + "e".repeat(510) };
      writeFileSync(path.join(out, "long-entity-input.json"), JSON.stringify(long, null, 2));
      for (const [width, height] of sizes) {
        await page.setViewportSize({ width, height });
        await page.route("**/nodetrace-state.json", route => route.fulfill({ json: long }));
        await page.goto(url); await ready(page); await waitForPaintedGraph(page);
        await inspectEntityJob(page, long, { check, snap, label: `long-entities-${width}` });
        await page.unrouteAll({ behavior: "wait" });
      }
      const empty = { ...state, traces: [] };
      await page.route("**/nodetrace-state.json", route => route.fulfill({ json: empty }));
      await page.goto(url); await ready(page);
      check("empty trace has no fictional graph or retained entity readout", await page.getByTestId("live-graph-rail").count() === 0 && await page.getByTestId("live-graph-node-events").count() === 0);
      await snap(page, "empty-trace-entities");
      await page.unrouteAll({ behavior: "wait" });
    }
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(`${url}?surface=not-registered`); await ready(page); await page.locator("dialog:modal").waitFor();
    check(`${seed}: unknown registry is visible and honest`, await page.locator("dialog").innerText().then((text) => text.includes("No registry entry") && text.includes("not-registered")));
    await snap(page, `${seed.replace(":", "-")}-unknown`); await page.keyboard.press("Escape"); await closed(page);
    await open(page);
    const textBox = await page.locator(".nt-about").first().boundingBox();
    await page.mouse.move(textBox.x + 10, textBox.y + 5); await page.mouse.down(); await page.mouse.move(4, 4); await page.mouse.up();
    check(`${seed}: selection drag does not dismiss`, await page.locator("dialog:modal").count() === 1);
    await page.mouse.click(4, 4); await closed(page);
    check(`${seed}: intentional backdrop click closes`, await page.locator("dialog").count() === 0);
    await page.goto(`${url}?surface=${encodeURIComponent(state.proofs[0].surfaceId)}`); await ready(page); await page.locator("dialog:modal").waitFor();
    if (!state.proofs[0].sourceUrl) check(`${seed}: absent source action is explicit`, await page.locator("dialog").innerText().then((text) => text.includes("Source opening is unavailable")));
    await page.keyboard.press("Escape"); await closed(page);

    if (state.coach) {
      for (const group of ["constructor", "__proto__"]) {
        const variant = structuredClone(state); variant.coach.steps[0].group = group;
        await page.route("**/nodetrace-state.json", (route) => route.fulfill({ json: variant }));
        await page.goto(url); await ready(page); await page.locator("#coach-tab-steps").click();
        check(`valid group ${group} remains usable`, (await page.locator("#coach-panel-steps").innerText()).includes(group));
        await page.unrouteAll({ behavior: "wait" });
      }
      // Repeated user interruptions, then a sustained session with accumulated browser history.
      await page.goto(url); await ready(page);
      const start = Date.now(); let cycles = 0;
      do {
        await page.getByTestId("trace-record").nth(cycles % state.coach.steps.length).click();
        await page.locator("#coach-tab-raw").click(); await open(page); await page.keyboard.press("Escape"); await closed(page);
        await page.goBack(); await page.locator("dialog:modal").waitFor(); await page.goForward(); await closed(page);
        check(`repeated review cycle ${cycles}`, await page.locator("#coach-tab-raw").getAttribute("aria-selected") === "true");
        cycles++;
      } while (cycles < 12 || Date.now() - start < 60_000);
      check("sustained review with accumulated history", cycles >= 12 && Date.now() - start >= 60_000, { cycles, elapsedMs: Date.now() - start });
    }
    await context.close(); killTree(server); server = null;
  }

  // Failure scenarios retain actual baseline fields and deliberately change only the trigger.
  server = startPreview(port); await waitForServer(url);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = activePage = await context.newPage(); page.on("pageerror", (error) => errors.push(error.message));
  const valid = JSON.parse(readFileSync("public/nodetrace-state.json", "utf8"));
  for (const [name, response] of [
    ["http-error", { status: 503, body: "unavailable" }],
    ["invalid-json", { status: 200, body: "{" }],
    ["missing-nested-field", { json: { ...valid, coach: { ...valid.coach, steps: [{ ...valid.coach.steps[0], uiCapture: {} }] } } }],
    ["unsafe-source", { json: { ...valid, proofs: [{ ...valid.proofs[0], sourceUrl: "javascript:alert(1)" }] } }],
    ["oversize", { status: 200, body: " ".repeat(1_048_577) }],
  ]) {
    await page.route("**/nodetrace-state.json", (route) => route.fulfill(response));
    await page.goto(`${url}?surface=${encodeURIComponent(valid.surfaces[0].id)}`);
    await page.getByRole("alert").waitFor();
    check(`${name}: failure does not invent a missing-data modal`, await page.locator("dialog").count() === 0);
    await snap(page, name);
    await page.unrouteAll({ behavior: "wait" });
    await page.getByRole("button", { name: "Retry loading trace" }).click(); await ready(page); await page.locator("dialog:modal").waitFor();
    check(`${name}: retry preserves original requested surface`, new URL(page.url()).searchParams.get("surface") === valid.surfaces[0].id);
    await page.keyboard.press("Escape"); await closed(page);
  }
  let release;
  const delayed = new Promise((resolve) => { release = resolve; });
  const stale = structuredClone(valid);
  stale.coach.steps[0].title = "STALE_ABANDONED_RESPONSE";
  await page.route("**/nodetrace-state.json", async (route) => { await delayed; await route.fulfill({ json: stale }).catch(() => {}); });
  await page.goto(`${url}?surface=${encodeURIComponent(valid.surfaces[0].id)}`, { waitUntil: "domcontentloaded" });
  await page.getByRole("status").waitFor();
  check("pending direct link does not claim registry absence", await page.locator("dialog").count() === 0 && (await page.getByRole("status").innerText()).includes("Loading"));
  await snap(page, "pending-direct-link");
  await page.getByRole("alert").waitFor({ timeout: 15_000 });
  check("request budget produces recoverable timeout", (await page.getByRole("alert").innerText()).includes("timed out"));
  // Retry can complete before the old response is released; it cannot overwrite the newer request.
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await page.getByRole("button", { name: "Retry loading trace" }).click(); await ready(page); await page.locator("dialog:modal").waitFor();
  release(); await page.waitForTimeout(300);
  check("late abandoned response cannot replace recovered state", await page.locator("dialog:modal").count() === 1 && (await page.getByRole("status").innerText()).includes("bundled snapshot") && !(await page.locator("body").innerText()).includes("STALE_ABANDONED_RESPONSE"));
  await page.keyboard.press("Escape"); await closed(page);
  const privileged = { ...valid, builderCapable: true, codeOwnership: [{ id: "host-only", surfaceId: valid.surfaces[0].id, ownerLabel: "PRIVILEGED_OWNER_SENTINEL" }] };
  await page.route("**/nodetrace-state.json", (route) => route.fulfill({ json: privileged }));
  await page.goto(`${url}?surface=${encodeURIComponent(valid.surfaces[0].id)}&mode=builder&builderCapable=true`); await ready(page); await page.locator("dialog:modal").waitFor();
  check("public JSON and URL cannot grant builder UI", await page.getByRole("button", { name: "Builder", exact: true }).count() === 0 && !(await page.locator("body").innerText()).includes("PRIVILEGED_OWNER_SENTINEL"));
  await context.close();
  check("no uncaught browser application errors", errors.length === 0, errors);
  for (const [file, hash] of Object.entries(sources)) check(`source stayed fixed: ${file}`, sha(readFileSync(file)) === hash);
  writeFileSync(path.join(out, "receipt.json"), JSON.stringify({ proof: "NODETRACE-USER-JOURNEY-01", ok: true, browser: browser.version(), sourceHashes: sources, inputs, checks, captures, caveats: ["Anonymous desktop Chromium with emulated viewports; no physical touch, screen-reader participant or alternate engine.", "No production, provider, human usability or final eight-dimension grade claim.", "Native graph layout can vary; input assets and traversal meaning are checked, not identical graph pixels.", "Public data producers must exclude privileged records before publishing; this demo cannot secure bytes already served."] }, null, 2));
  console.log(JSON.stringify({ ok: true, checks: checks.length, captures: captures.length, out }));
} catch (error) {
  await activePage?.screenshot({ path: path.join(out, "failure.png"), fullPage: true }).catch(() => {});
  writeFileSync(path.join(out, "failure.json"), JSON.stringify({ error: String(error.stack), sources, inputs, checks, captures, errors }, null, 2));
  throw error;
} finally { await browser?.close(); killTree(server); }

function sort(value) { return Array.isArray(value) ? value.map(sort) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, sort(value[key])])) : value; }
