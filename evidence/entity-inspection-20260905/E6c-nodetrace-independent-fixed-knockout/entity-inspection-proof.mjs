import { waitForPaintedGraph } from "./proof-server.mjs";

/** Instrument real glyph draws; cleared canvases cannot retain earlier evidence. */
export async function recordEntityCanvas(context) {
  await context.addInitScript(() => {
    const frames = new WeakMap();
    const proto = CanvasRenderingContext2D.prototype;
    const draw = proto.fillText, clear = proto.clearRect;
    proto.clearRect = function (...args) {
      frames.delete(this.canvas);
      return clear.apply(this, args);
    };
    proto.fillText = function (text, x, y, ...rest) {
      const result = draw.call(this, text, x, y, ...rest);
      if (!this.canvas.matches(".sigma-labels,.sigma-hovers")) return result;
      const m = this.measureText(text), t = this.getTransform();
      const box = this.canvas.getBoundingClientRect();
      const scaleX = box.width / this.canvas.width, scaleY = box.height / this.canvas.height;
      const glyph = { text: String(text), x: (t.a * (x - m.actualBoundingBoxLeft) + t.e) * scaleX,
        y: (t.d * (y - m.actualBoundingBoxAscent) + t.f) * scaleY,
        width: t.a * (m.actualBoundingBoxLeft + m.actualBoundingBoxRight) * scaleX,
        height: t.d * (m.actualBoundingBoxAscent + m.actualBoundingBoxDescent) * scaleY,
        canvasWidth: box.width, canvasHeight: box.height, supportedTransform: t.b === 0 && t.c === 0 };
      const frame = frames.get(this.canvas) ?? new Map();
      if (frame.size >= 10000) throw new Error("Canvas proof exceeds its current-frame record budget");
      frame.set(`${text}\0${x}\0${y}`, glyph);
      frames.set(this.canvas, frame);
      return result;
    };
    window.__nodeTraceEntityFrame = () => [...document.querySelectorAll(".sigma-labels,.sigma-hovers")]
      .flatMap((canvas) => [...(frames.get(canvas)?.values() ?? [])])
      .filter((item, index, all) => all.findIndex((other) => other.text === item.text &&
        other.x === item.x && other.y === item.y) === index);
  });
}

export async function assertEntityFrame(page, check, label) {
  const frame = await page.evaluate(() => window.__nodeTraceEntityFrame());
  check(`${label}: current canvas has painted labels`, frame.length > 0, frame);
  check(`${label}: every painted glyph is inside its canvas`, frame.every((r) => r.supportedTransform &&
    r.x >= 0 && r.y >= 0 && r.x + r.width <= r.canvasWidth + 0.01 &&
    r.y + r.height <= r.canvasHeight + 0.01), frame);
  const collisions = frame.flatMap((a, i) => frame.slice(i + 1).filter((b) =>
    a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y)
    .map((b) => [a, b]));
  check(`${label}: painted labels do not collide`, collisions.length === 0, collisions);
  return frame;
}

/** A reviewer reaches every real entity, then checks a painted node by pointer. */
export async function inspectEntityJob(page, state, { check, snap, label }) {
  const expected = new Map();
  for (const row of state.traces) {
    const names = [`actor: ${row.actor}`, `tool: ${row.surfaceId}`, `step: ${row.phase}`];
    if (row.artifactId) names.push(`artifact: ${row.artifactId}`);
    for (const name of names) {
      const ids = expected.get(name) ?? [];
      if (!ids.includes(row.id)) ids.push(row.id);
      expected.set(name, ids);
    }
  }
  const select = page.getByRole("combobox", { name: "Entity", exact: true });
  check(`${label}: one named native entity selector`, await select.count() === 1);
  const options = await select.locator("option").evaluateAll((items) => items.slice(1).map((item) => item.textContent));
  check(`${label}: every and only actual entity is available`, JSON.stringify([...options].sort()) === JSON.stringify([...expected.keys()].sort()));
  async function selectedResult(name, phase) {
    const result = page.getByTestId("live-graph-node-events");
    const split = name.indexOf(": "), kind = name.slice(0, split), fullName = name.slice(split + 2);
    check(`${label}-${phase}: full identity ${name}`, await result.locator("strong").textContent() === name);
    check(`${label}-${phase}: exact producing events ${name}`, JSON.stringify(await result.locator("li code").allTextContents()) === JSON.stringify(expected.get(name)));
    const detail = page.getByTestId("nodegraph-selection");
    check(`${label}-${phase}: both panels identify the current entity`, (await detail.locator("dd").first().textContent()).trim() === `${fullName} · ${kind}`);
    check(`${label}-${phase}: visits agree with producing records`, parseInt(await detail.getByTestId("visits-readout").textContent(), 10) === expected.get(name).length);
    check(`${label}-${phase}: counts remain unknown`, await detail.getByTestId("count-readout").textContent() === "unknown — not measured");
    check(`${label}-${phase}: full identity and events fit their panels`, await page.evaluate(() =>
      document.documentElement.scrollWidth <= innerWidth + 1 &&
      [...document.querySelectorAll('[data-testid="live-graph-node-events"], [data-testid="nodegraph-selection"]')]
        .every(node => node.scrollWidth <= node.clientWidth + 1)));
  }
  if (!expected.size) {
    check(`${label}: empty graph disables selection`, await select.isDisabled());
    check(`${label}: empty graph has no stale event result`, await page.getByTestId("live-graph-node-events").count() === 0);
    await snap(page, `${label}-empty`);
    return;
  }
  await page.locator("[data-trace-inspect]").last().focus();
  let reached = false;
  for (let i = 0; i < 100; i++) {
    await page.keyboard.press("Tab");
    if (await select.evaluate((node) => node === document.activeElement)) { reached = true; break; }
  }
  check(`${label}: natural Tab reaches entity selection`, reached);
  await page.keyboard.press("Home");
  for (const [index, name] of options.entries()) {
    await page.keyboard.press("ArrowDown");
    await selectedResult(name, "keyboard");
    if (name.length > 100) await snap(page, `${label}-long-entity-${index}`);
  }
  const focus = await select.evaluate((node) => ({ focused: node === document.activeElement,
    outline: getComputedStyle(node).outlineWidth, height: node.getBoundingClientRect().height }));
  check(`${label}: entity control has visible focus and 44px height`, focus.focused && parseFloat(focus.outline) >= 2 && focus.height >= 44, focus);
  await snap(page, `${label}-keyboard-entity`);
  await page.keyboard.press("Tab");
  const fit = page.getByTestId("nodegraph-fit");
  check(`${label}: natural next focus reaches Fit`, await fit.evaluate((node) => node === document.activeElement));
  check(`${label}: Fit has a 44px target`, await fit.evaluate((node) => node.getBoundingClientRect().width >= 44 && node.getBoundingClientRect().height >= 44));
  await page.keyboard.press("Enter");
  await page.mouse.move(0, 0);
  const painted = await waitForPaintedGraph(page);
  await assertEntityFrame(page, check, `${label}-fit`);
  const point = painted.points[0];
  await page.mouse.click(point.x, point.y);
  const name = await page.getByTestId("live-graph-node-events").locator("strong").textContent();
  check(`${label}: painted-node pointer identity is actual`, expected.has(name), name);
  check(`${label}: pointer and keyboard use the same selection`, await select.locator("option:checked").textContent() === name);
  check(`${label}: pointer producing events match the recorded source`, JSON.stringify(await page.getByTestId("live-graph-node-events").locator("li code").allTextContents()) === JSON.stringify(expected.get(name)));
  await selectedResult(name, "pointer");
  await assertEntityFrame(page, check, `${label}-hover`);
  await snap(page, `${label}-pointer-entity`);
  await select.focus(); await page.keyboard.press("Home"); await page.keyboard.press("ArrowDown");
  let other = options[0];
  if (other === name && options.length > 1) { await page.keyboard.press("ArrowDown"); other = options[1]; }
  await selectedResult(other, "pointer-to-keyboard");
  await snap(page, `${label}-pointer-to-keyboard`);
  await page.keyboard.press("Home");
  check(`${label}: clearing the controlled selection clears both panels`, await page.getByTestId("live-graph-node-events").count() === 0 && await page.getByTestId("nodegraph-selection").count() === 0);
  await page.keyboard.press("ArrowDown"); await selectedResult(options[0], "reselect-after-clear");
  await page.mouse.move(0, 0);
  await page.evaluate(() => {
    for (const canvas of document.querySelectorAll(".sigma-labels,.sigma-hovers")) {
      const ctx = canvas.getContext("2d"); ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  });
  check(`${label}: cleared pixels invalidate prior label evidence`, await page.evaluate(() => window.__nodeTraceEntityFrame().length === 0));
  await fit.focus(); await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__nodeTraceEntityFrame().length > 0);
  await assertEntityFrame(page, check, `${label}-current-frame-recovery`);
}
