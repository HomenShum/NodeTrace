/**
 * Fault injector: let every WebGL context in the browser initialise normally
 * and then draw nothing, so a capture script runs against a graph canvas that
 * mounts, reports its counts in the DOM, and paints no pixels.
 *
 * Used only by promotion/probes/capture-paint-regression.mjs, which spawns the
 * real capture script with
 *
 *   NODE_OPTIONS=--import=file:///.../lose-webgl-context.mjs
 *
 * so the script under test is byte-for-byte the one that ships.
 *
 * It reproduces the observed defect: on 2026-08-13 one of three capture runs
 * wrote docs/screenshots/live-graph-rail.png with the labels drawn (2d canvas),
 * no node rings and no edges (the four WebGL canvases), and Chromium's
 * broken-image placeholder over the canvas box — while the DOM still read
 * data-entity-count="10" and the script printed
 * `PASS (10 entities, 15 traversal edges)`.
 *
 * Why the draw calls and not `WEBGL_lose_context.loseContext()`: killing the
 * context at creation makes Sigma throw during init and React unmounts the
 * whole rail, so the capture fails on "rail never became visible" and proves
 * nothing about paint. Measured, not assumed — that run is in
 * promotion/PROMOTION_LOG.md.
 */

import { chromium } from "playwright";

const DRAW_NOTHING = () => {
  const original = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (kind, ...rest) {
    const context = original.call(this, kind, ...rest);
    if (context && typeof kind === "string" && kind.startsWith("webgl")) {
      for (const call of ["drawArrays", "drawElements", "drawArraysInstanced", "drawElementsInstanced"]) {
        if (typeof context[call] === "function") context[call] = () => {};
      }
    }
    return context;
  };
};

const launch = chromium.launch.bind(chromium);
chromium.launch = async (options) => {
  const browser = await launch(options);
  const newPage = browser.newPage.bind(browser);
  const newContext = browser.newContext.bind(browser);
  browser.newPage = async (...args) => {
    const page = await newPage(...args);
    await page.addInitScript(DRAW_NOTHING);
    return page;
  };
  browser.newContext = async (...args) => {
    const context = await newContext(...args);
    await context.addInitScript(DRAW_NOTHING);
    return context;
  };
  return browser;
};
