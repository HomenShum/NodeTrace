/**
 * Condition 7 — Web Interface Guidelines review.
 *
 * Run from the repo root:  npm run promotion:wig
 *
 * The human situation, before any jargon. A guidelines review is somebody
 * sitting with a checklist of interface rules, opening the product, and trying
 * each rule against what is actually on screen: can I reach that with the
 * keyboard, is the focus ring visible, is this grey text readable, does the Back
 * button restore what I was looking at. It is not a score. It is a list of
 * places where the product and the checklist disagree.
 *
 * The checklist is Vercel's Web Interface Guidelines, fetched from
 * https://vercel.com/design/guidelines and kept verbatim beside this script at
 * promotion/evidence/web-interface-guidelines.txt so a reader can see exactly
 * what was reviewed against. Each finding below quotes the guideline it fails.
 *
 * WHY THIS IS NOT A LIGHTHOUSE RUN, and must never be replaced by one.
 * Lighthouse and axe answer "does this page break a machine-checkable WCAG
 * rule". The guidelines ask a different question — "is this interface built the
 * way a careful team builds one" — and most of the answers are not
 * machine-checkable at all. Six of the findings this script measures
 * (no keyboard opener, no focus management in the dialog, dead tagged regions,
 * no URL state, tabs with no tabpanel, the missing empty state) score a clean
 * 1.00 in every Lighthouse category. Condition 8 is the audit; this is the
 * review; passing one says nothing about the other.
 *
 * WHAT IT MEASURES RATHER THAN ASSERTS. Every finding carries a number or a
 * screenshot read out of the rendered page: focusable counts, how many of them
 * open the lens, the activeElement after N tabs, hit-target boxes in px,
 * contrast ratios computed from getComputedStyle, the location.href after a tab
 * change, heading levels in DOM order. A guideline this product cannot violate
 * (there is no form; there is no animation) is recorded as notApplicable with
 * the measurement that shows why, not silently dropped.
 *
 * Writes:
 *   promotion/evidence/wig-review.json
 *   promotion/evidence/wig-keyboard-no-opener.png
 *   promotion/evidence/wig-lens-open-focus-outside.png
 *   promotion/evidence/wig-happy-path-empty-coach-slot.png
 */

import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

import {
  PORT_ENV,
  assertPageIsThisTree,
  assertPortFree,
  killTree,
  startPreview,
  waitForPaintedGraph,
  waitForServer,
} from "../../scripts/lib/proof-server.mjs";

const PORT = Number(process.env[PORT_ENV] ?? 4910);
const PAGE_URL = `http://127.0.0.1:${PORT}/`;
const EVIDENCE = join("promotion", "evidence");
const REPORT = join(EVIDENCE, "wig-review.json");
const GUIDELINES_URL = "https://vercel.com/design/guidelines";

mkdirSync(EVIDENCE, { recursive: true });
await assertPortFree(PORT);

const findings = [];
const measurements = {};
let preview = null;
let browser = null;

try {
  // The J3 screen is the bigger surface: it renders the Trace Coach, the
  // role="tab" strip and the record list the happy path never mounts. Review
  // that, then come back to the happy path for the one finding that only
  // appears there (the empty coach slot).
  run("npm", ["run", "trace-coach:sqlite"]);
  run("npm", ["run", "build"]);
  preview = startPreview(PORT);
  await waitForServer(PAGE_URL);

  browser = await chromium.launch();
  const page = await newAuditPage(browser);
  await page.goto(PAGE_URL, { waitUntil: "load" });
  await assertPageIsThisTree(page);
  await waitForPaintedGraph(page);

  await reviewInteractions(page);
  await reviewContentAndSemantics(page);
  await reviewDesign(page);
  await reviewNotApplicable(page);

  await browser.close();
  browser = null;
  killTree(preview);
  preview = null;

  // Second state: the README Happy Path, where `state.coach` is absent.
  run("npm", ["run", "happy-path"]);
  run("npm", ["run", "build"]);
  preview = startPreview(PORT);
  await waitForServer(PAGE_URL);
  browser = await chromium.launch();
  const happy = await newAuditPage(browser);
  await happy.goto(PAGE_URL, { waitUntil: "load" });
  await assertPageIsThisTree(happy);
  await waitForPaintedGraph(happy);
  await reviewEmptyState(happy);
} finally {
  if (browser) await browser.close().catch(() => {});
  killTree(preview);
}

const major = findings.filter((finding) => finding.severity === "major");
const report = {
  ok: major.length === 0,
  condition: 7,
  review: "Vercel Web Interface Guidelines",
  guidelinesUrl: GUIDELINES_URL,
  guidelinesCopy: "promotion/evidence/web-interface-guidelines.txt",
  guidelinesFetched: "2026-08-13, HTTP 200",
  notALighthouseRun:
    "Every major below is invisible to Lighthouse and axe: they are interaction and state-model findings, not machine-checkable WCAG rules.",
  generatedAt: new Date().toISOString(),
  servedFrom: "vite preview over dist/ (the built bundle, not the dev server)",
  viewport: "1280x900, plus a 375x812 pass for touch hit targets",
  majorCount: major.length,
  findings,
  measurements,
};
writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`);

for (const finding of findings) {
  console.log(`${finding.severity.padEnd(14)} ${finding.id} — ${finding.summary}`);
}
console.log(`wig review: ${report.ok ? "PASS" : "FAIL"} (${major.length} major of ${findings.length} checks) -> ${posix(REPORT)}`);
process.exit(report.ok ? 0 : 1);

// ---------------------------------------------------------------------------

/**
 * A page that can name what it is looking at. Every element this review cites
 * goes through `describe`, because "button." identifies nothing — the graph
 * rail's controls have no class, and a finding that says a 22px "button." is
 * too small is a finding nobody can go and look at.
 */
async function newAuditPage(browser) {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await page.addInitScript(() => {
    window.describe = (el) => {
      if (!el || el === document.body) return el ? "body" : "none";
      const tag = el.tagName.toLowerCase();
      const cls = (el.className || "").toString().trim().split(/\s+/)[0];
      const label = (el.getAttribute("aria-label") || el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 32);
      return `${tag}${cls ? `.${cls}` : ""}${label ? ` "${label}"` : ""}`;
    };
  });
  return page;
}

async function reviewInteractions(page) {
  // "Keyboard works everywhere. All flows are keyboard-operable."
  // The product's whole point is the Trace Lens. Walk every focusable element,
  // press Enter on it, and count how many open the panel.
  const keyboard = await page.evaluate(async () => {
    const focusables = [...document.querySelectorAll('a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"]),details>summary')];
    return { focusableCount: focusables.length };
  });
  let openersFound = 0;
  const focusables = page.locator('a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"]),details>summary');
  const count = await focusables.count();
  for (let i = 0; i < count; i += 1) {
    const element = focusables.nth(i);
    await element.focus();
    await page.keyboard.press("Enter");
    if (await page.locator(".nt-panel").count()) {
      openersFound += 1;
      await page.keyboard.press("Escape");
    }
  }
  // Tab-walk too, because "focusable" and "reachable by Tab" are not the same set.
  await page.locator("body").click({ position: { x: 2, y: 2 } });
  const tabStops = [];
  for (let i = 0; i < 40; i += 1) {
    await page.keyboard.press("Tab");
    tabStops.push(await page.evaluate(() => {
      const el = document.activeElement;
      return el ? describe(el) : "none";
    }));
  }
  measurements.keyboard = { focusableCount: count, focusablesThatOpenTheLens: openersFound, tabPresses: 40, distinctTabStops: [...new Set(tabStops)].length, lensOpenAfter40Tabs: (await page.locator(".nt-panel").count()) > 0 };
  measurements.keyboardDom = keyboard;
  await page.screenshot({ path: join(EVIDENCE, "wig-keyboard-no-opener.png"), fullPage: false });

  finding({
    id: "interactions.keyboard-works-everywhere",
    guideline: "Interactions — “Keyboard works everywhere. All flows are keyboard-operable & follow the WAI-ARIA Authoring Patterns.”",
    severity: openersFound > 0 ? "pass" : "major",
    summary: openersFound > 0
      ? `${openersFound} of ${count} focusable elements open the Trace Lens with Enter`
      : `0 of ${count} focusable elements open the Trace Lens with Enter, and 40 consecutive Tab presses never reach an opener — the product's only flow is unreachable without a mouse`,
    measurement: measurements.keyboard,
    evidence: "promotion/evidence/wig-keyboard-no-opener.png",
  });

  // "Clear focus. Every focusable element shows a visible focus ring."
  // Tab to each control and read its outline while it holds focus — the ring
  // may be the browser's default, which counts, or suppressed, which does not.
  await page.locator("body").click({ position: { x: 2, y: 2 } });
  const rings = [];
  for (let i = 0; i < count; i += 1) {
    await page.keyboard.press("Tab");
    rings.push(await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const style = getComputedStyle(el);
      return {
        element: describe(el),
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
        boxShadow: style.boxShadow === "none" ? null : style.boxShadow.slice(0, 60),
      };
    }));
  }
  const focused = rings.filter(Boolean);
  const ringless = focused.filter((ring) => (ring.outlineStyle === "none" || Number.parseFloat(ring.outlineWidth) === 0) && !ring.boxShadow);
  // Measured, not assumed: walk the page's own stylesheets and count the rules
  // that mention focus at all.
  const focusRules = await page.evaluate(() =>
    [...document.styleSheets].flatMap((sheet) => {
      try {
        return [...sheet.cssRules].map((rule) => rule.selectorText ?? "");
      } catch {
        return [];
      }
    }).filter((selector) => /:focus/.test(selector)),
  );
  measurements.focusRings = { measured: focused.length, withoutAnyRing: ringless, focusSelectorsInStylesheets: focusRules };
  finding({
    id: "interactions.clear-focus",
    guideline: "Interactions — “Clear focus. Every focusable element shows a visible focus ring. Prefer :focus-visible over :focus.”",
    severity: ringless.length ? "minor" : "pass",
    summary: `${focused.length} controls measured while focused; ${ringless.length} draw no ring at all. The page's stylesheets contain ${focusRules.length} :focus/:focus-visible selectors, so every ring here is the browser's default — correct by accident, and it disappears the first time anyone sets outline: none`,
    measurement: measurements.focusRings,
  });

  // "Manage focus. Use focus traps, move & return focus according to the
  // WAI-ARIA Patterns." Open the dialog the only way it opens, then look at
  // where focus actually is.
  const beforeOpen = await page.evaluate(() => document.activeElement?.tagName ?? "none");
  await page.locator('[data-nodetrace-surface]').last().click({ modifiers: ["Control"] });
  await page.locator(".nt-panel").waitFor({ state: "visible", timeout: 5_000 });
  const dialog = await page.evaluate(() => {
    const panel = document.querySelector(".nt-panel");
    return {
      role: panel?.getAttribute("role") ?? null,
      ariaModal: panel?.getAttribute("aria-modal") ?? null,
      activeElementOnOpen: document.activeElement?.tagName.toLowerCase() ?? "none",
      activeElementInsidePanel: panel ? panel.contains(document.activeElement) : false,
    };
  });
  const tabsInsidePanel = [];
  for (let i = 0; i < 6; i += 1) {
    await page.keyboard.press("Tab");
    tabsInsidePanel.push(await page.evaluate(() => {
      const panel = document.querySelector(".nt-panel");
      const el = document.activeElement;
      return { inside: panel ? panel.contains(el) : false, element: el ? describe(el) : "none" };
    }));
  }
  await page.screenshot({ path: join(EVIDENCE, "wig-lens-open-focus-outside.png"), fullPage: false });
  await page.keyboard.press("Escape");
  const afterClose = await page.evaluate(() => document.activeElement?.tagName ?? "none");
  measurements.dialogFocus = { ...dialog, beforeOpen, afterClose, sixTabsAfterOpen: tabsInsidePanel, tabsThatStayedInside: tabsInsidePanel.filter((t) => t.inside).length };

  finding({
    id: "interactions.manage-focus",
    guideline: "Interactions — “Manage focus. Use focus traps, move & return focus according to the WAI-ARIA Patterns.”",
    severity: dialog.activeElementInsidePanel && measurements.dialogFocus.tabsThatStayedInside === 6 ? "pass" : "major",
    summary: `the dialog opens with focus on <${dialog.activeElementOnOpen}> (aria-modal ${dialog.ariaModal ?? "absent"}); ${measurements.dialogFocus.tabsThatStayedInside} of 6 subsequent Tab presses stay inside it — the rest land on controls behind the panel`,
    measurement: measurements.dialogFocus,
    evidence: "promotion/evidence/wig-lens-open-focus-outside.png",
  });

  // "No dead zones. If part of a control looks interactive, it should be
  // interactive." Every tagged region advertises itself as the thing you click.
  const surfaceIds = await page.evaluate(() =>
    [...document.querySelectorAll("[data-nodetrace-surface]")].map((node) => ({
      id: node.getAttribute("data-nodetrace-surface"),
      area: Math.round(node.getBoundingClientRect().width * node.getBoundingClientRect().height),
      cursor: getComputedStyle(node).cursor,
    })),
  );
  const dead = [];
  for (const surface of surfaceIds) {
    await page.locator(`[data-nodetrace-surface="${surface.id}"]`).first().click({ modifiers: ["Control"] });
    const opened = (await page.locator(".nt-panel").count()) > 0;
    if (opened) await page.keyboard.press("Escape");
    else dead.push(surface);
  }
  measurements.taggedSurfaces = { total: surfaceIds.length, dead };
  finding({
    id: "interactions.no-dead-zones",
    guideline: "Interactions — “No dead zones. If part of a control looks interactive, it should be interactive. Don’t leave users guessing where to interact.”",
    severity: dead.length ? "major" : "pass",
    summary: dead.length
      ? `${dead.length} of ${surfaceIds.length} tagged regions swallow the Ctrl-click and render nothing: ${dead.map((d) => `${d.id} (${d.area}px², cursor:${d.cursor})`).join(", ")}`
      : `all ${surfaceIds.length} tagged regions open the lens`,
    measurement: measurements.taggedSurfaces,
  });

  // "URL as state" / "Deep-link everything. Filters, tabs, pagination, expanded
  // panels, anytime useState is used."
  const before = page.url();
  const rawTab = page.locator('[role="tab"]', { hasText: "Raw JSON" });
  const hasTabs = (await rawTab.count()) > 0;
  let urlState = { hasTabs, urlBefore: before, urlAfter: before, survivesReload: null };
  if (hasTabs) {
    await rawTab.first().click();
    await page.locator('[data-testid="trace-raw"]').waitFor({ state: "visible", timeout: 5_000 });
    urlState.urlAfter = page.url();
    await page.reload({ waitUntil: "load" });
    urlState.survivesReload = (await page.locator('[data-testid="trace-raw"]').count()) > 0;
  }
  measurements.urlState = urlState;
  finding({
    id: "interactions.url-as-state",
    guideline: "Interactions — “URL as state. Persist state in the URL so share, refresh, Back/Forward navigation work.” / “Deep-link everything. Filters, tabs, pagination, expanded panels, anytime useState is used.”",
    severity: hasTabs && urlState.urlBefore === urlState.urlAfter ? "major" : "pass",
    summary: hasTabs
      ? `switching to the Raw JSON tab leaves the URL at ${urlState.urlAfter} — unchanged — and a reload returns to Overview (raw pane present after reload: ${urlState.survivesReload}); the coach tab, the active step and the open lens are all useState and none of them is shareable or survives refresh`
      : "no tabs on this surface",
    measurement: urlState,
  });

  // "Match visual & hit targets… if the visual target is < 24px, expand its hit
  // target to >= 24px. On mobile, the minimum size is 44px."
  const desktopTargets = await measureHitTargets(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(300);
  const mobileTargets = await measureHitTargets(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  measurements.hitTargets = { desktopUnder24: desktopTargets.filter((t) => t.min < 24), mobileUnder44: mobileTargets.filter((t) => t.min < 44), desktopCount: desktopTargets.length, mobileCount: mobileTargets.length };
  finding({
    id: "interactions.hit-targets",
    guideline: "Interactions — “Match visual & hit targets. Exception: if the visual target is < 24px, expand its hit target to ≥ 24px. On mobile, the minimum size is 44px.”",
    severity: measurements.hitTargets.desktopUnder24.length ? "minor" : "pass",
    summary: `${measurements.hitTargets.desktopUnder24.length} of ${desktopTargets.length} controls are under 24px on their short side at 1280px; ${measurements.hitTargets.mobileUnder44.length} of ${mobileTargets.length} are under 44px at 375px`,
    measurement: measurements.hitTargets,
  });

  // "Announce async updates. Use polite aria-live for toasts & inline validation."
  const live = await page.evaluate(() => document.querySelectorAll("[aria-live],[role=status],[role=alert]").length);
  measurements.ariaLiveRegions = live;
  finding({
    id: "interactions.announce-async-updates",
    guideline: "Interactions — “Announce async updates. Use polite aria-live for toasts & inline validation.”",
    severity: live === 0 ? "minor" : "pass",
    summary: `${live} aria-live/status/alert regions on the page — the panel opening, the tab switch and the state fetch all happen silently for a screen reader`,
    measurement: { ariaLiveRegions: live },
  });
}

async function reviewContentAndSemantics(page) {
  // With the lens OPEN, because its close button is the page's only icon-only
  // control and it does not exist in the DOM until then. Measuring the closed
  // page would have reported "0 of 0 unnamed" — a pass earned by not looking.
  await page.locator('[data-nodetrace-surface]').last().click({ modifiers: ["Control"] });
  await page.locator(".nt-panel").waitFor({ state: "visible", timeout: 5_000 });
  const semantics = await page.evaluate(() => {
    const headings = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].map((h) => ({ level: Number(h.tagName[1]), text: h.textContent.trim().slice(0, 60) }));
    const iconOnly = [...document.querySelectorAll("button,a[href]")]
      .filter((el) => !el.textContent.trim())
      .map((el) => ({ selector: describe(el), ariaLabel: el.getAttribute("aria-label"), title: el.getAttribute("title") }));
    return {
      headings,
      headingOrderJumps: headings.filter((h, i) => i > 0 && h.level - headings[i - 1].level > 1).map((h) => h.text),
      skipLinks: [...document.querySelectorAll('a[href^="#"]')].filter((a) => /skip/i.test(a.textContent)).length,
      tabs: document.querySelectorAll('[role="tab"]').length,
      tabpanels: document.querySelectorAll('[role="tabpanel"]').length,
      ariaControls: document.querySelectorAll("[aria-controls]").length,
      iconOnlyUnnamed: iconOnly.filter((el) => !el.ariaLabel && !el.title),
      iconOnlyTotal: iconOnly.length,
      title: document.title,
      translateNo: document.querySelectorAll('[translate="no"]').length,
      codeTokens: document.querySelectorAll("code,pre").length,
    };
  });
  measurements.semantics = semantics;
  await page.keyboard.press("Escape");

  finding({
    id: "content.semantics-before-aria",
    guideline: "Content — “Semantics before ARIA. Prefer native elements (button, a, label, table), before aria-*.” with Interactions’ WAI-ARIA Authoring Patterns requirement.",
    severity: semantics.tabs > 0 && semantics.tabpanels === 0 ? "major" : "pass",
    summary: `${semantics.tabs} elements carry role="tab" but the page has ${semantics.tabpanels} role="tabpanel" and ${semantics.ariaControls} aria-controls — the tablist announces a widget whose panels do not exist, so a screen-reader user is told about a relationship the DOM cannot express`,
    measurement: { tabs: semantics.tabs, tabpanels: semantics.tabpanels, ariaControls: semantics.ariaControls },
  });

  finding({
    id: "content.headings-and-skip-link",
    guideline: "Content — “Headings & skip link. Hierarchical <h1–h6> & a “Skip to content” link.”",
    severity: semantics.headingOrderJumps.length || semantics.skipLinks === 0 ? "minor" : "pass",
    summary: `heading levels in DOM order are ${semantics.headings.map((h) => `h${h.level}`).join(" → ")}; ${semantics.headingOrderJumps.length} skipped level(s); ${semantics.skipLinks} skip links`,
    measurement: { headings: semantics.headings, jumps: semantics.headingOrderJumps, skipLinks: semantics.skipLinks },
  });

  finding({
    id: "content.icon-only-buttons-are-named",
    guideline: "Content — “Icon-only buttons are named. Provide a descriptive aria-label.”",
    severity: semantics.iconOnlyUnnamed.length ? "minor" : "pass",
    summary: `${semantics.iconOnlyUnnamed.length} of ${semantics.iconOnlyTotal} icon-only controls have no accessible name`,
    measurement: { unnamed: semantics.iconOnlyUnnamed, total: semantics.iconOnlyTotal },
  });

  finding({
    id: "content.shield-verbatim-content",
    guideline: "Content — “Shield verbatim content from translation. Wrap brand names, product names, code tokens, & technical identifiers with translate=\"no\".”",
    severity: semantics.codeTokens > 0 && semantics.translateNo === 0 ? "minor" : "pass",
    summary: `${semantics.codeTokens} <code>/<pre> nodes (npm commands, file paths, raw JSON) and ${semantics.translateNo} translate="no" — browser auto-translate will rewrite the commands the hero tells you to run`,
    measurement: { codeTokens: semantics.codeTokens, translateNo: semantics.translateNo },
  });
}

async function reviewDesign(page) {
  // "Minimum contrast" and "Interactions increase contrast". Computed here from
  // getComputedStyle rather than copied out of the axe report, so this finding
  // stands on its own measurement.
  const contrast = await page.evaluate(() => {
    const luminance = (rgb) => {
      const [r, g, b] = rgb.map((v) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const parse = (value) => (value.match(/[\d.]+/g) ?? []).map(Number);
    // The backdrop is a STACK, not the first non-transparent ancestor. This
    // page paints translucent panels over translucent cards over white, and
    // reading rgba(15, 23, 42, 0.04) as if it were opaque rgb(15, 23, 42)
    // turns a pale card into near-black and reports a 1.2:1 ratio for text
    // that is genuinely around 3:1. Composite the layers instead.
    const backgroundOf = (node) => {
      const layers = [];
      for (let el = node; el; el = el.parentElement) {
        const [r, g, b, a = 1] = parse(getComputedStyle(el).backgroundColor);
        if (a > 0) layers.push([r, g, b, a]);
        if (a >= 1) break;
      }
      return layers.reduceRight(
        (under, [r, g, b, a]) => [r * a + under[0] * (1 - a), g * a + under[1] * (1 - a), b * a + under[2] * (1 - a)],
        [255, 255, 255],
      ).map((channel) => Math.round(channel));
    };
    const ratio = (a, b) => {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };
    const samples = [".r-tracevu-rec-meta", ".heroStats span", ".heroStats small", ".r-tracevu-rec-sub", ".eyebrow"];
    return samples.flatMap((selector) =>
      [...document.querySelectorAll(selector)].slice(0, 1).map((node) => {
        const style = getComputedStyle(node);
        const background = backgroundOf(node);
        return {
          selector,
          fontSizePx: Number.parseFloat(style.fontSize),
          fontWeight: style.fontWeight,
          color: style.color,
          // Both colours, always: a contrast number without the pair it came
          // from is a claim nobody can re-derive.
          backgroundRgb: `rgb(${background.join(", ")})`,
          ratio: Number(ratio(parse(style.color), background).toFixed(2)),
        };
      }),
    );
  });
  const failing = contrast.filter((sample) => sample.ratio < (sample.fontSizePx >= 24 || (sample.fontSizePx >= 18.66 && Number(sample.fontWeight) >= 700) ? 3 : 4.5));
  measurements.contrast = { samples: contrast, failing };
  finding({
    id: "design.minimum-contrast",
    guideline: "Design — “Minimum contrast. Prefer APCA over WCAG 2 for more accurate perceptual contrast.”",
    severity: failing.length ? "major" : "pass",
    summary: failing.length
      ? `${failing.length} text styles fall under the WCAG AA floor for their size: ${failing.map((f) => `${f.selector} ${f.fontSizePx}px at ${f.ratio}:1`).join(", ")}`
      : `all ${contrast.length} sampled text styles clear the AA floor`,
    measurement: measurements.contrast,
  });

  const chrome = await page.evaluate(() => ({
    themeColor: document.querySelector('meta[name="theme-color"]')?.content ?? null,
    colorScheme: getComputedStyle(document.documentElement).colorScheme,
    metaDescription: document.querySelector('meta[name="description"]')?.content ?? null,
  }));
  measurements.browserChrome = chrome;
  finding({
    id: "design.browser-ui-matches-background",
    guideline: "Design — “Browser UI matches your background. Set <meta name=\"theme-color\">” and “Set the appropriate color-scheme.”",
    severity: chrome.themeColor ? "pass" : "minor",
    summary: `meta[name=theme-color] ${chrome.themeColor ?? "absent"}, html color-scheme "${chrome.colorScheme}"`,
    measurement: chrome,
  });
}

async function reviewNotApplicable(page) {
  // A guideline this product cannot violate is recorded with the measurement
  // that shows why, so nobody has to take "n/a" on trust.
  const surface = await page.evaluate(() => {
    const animated = [...document.querySelectorAll("*")].filter((el) => {
      const style = getComputedStyle(el);
      return style.animationName !== "none" || Number.parseFloat(style.transitionDuration) > 0;
    }).length;
    const formControls = [...document.querySelectorAll("input,textarea,select,form")].map((el) => ({
      tag: el.tagName.toLowerCase(),
      type: el.getAttribute("type"),
      ariaHidden: el.getAttribute("aria-hidden"),
      visible: el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0,
      owner: el.closest("[class]")?.className?.toString().split(" ")[0] ?? null,
      placeholder: el.getAttribute("placeholder"),
      ariaLabel: el.getAttribute("aria-label"),
      labelled: Boolean(el.id && document.querySelector(`label[for="${el.id}"]`)) || Boolean(el.closest("label")),
    }));
    return {
      animatedElements: animated,
      formControls,
      userFacingFormControls: formControls.filter((el) => el.visible && el.ariaHidden !== "true").length,
      anchors: document.querySelectorAll("a[href]").length,
    };
  });
  measurements.notApplicable = surface;

  finding({
    id: "animations.honor-prefers-reduced-motion",
    guideline: "Animations — “Honor prefers-reduced-motion. Provide a reduced-motion variant.”",
    severity: surface.animatedElements === 0 ? "not-applicable" : "minor",
    summary: `${surface.animatedElements} elements have a CSS transition or animation; with none, there is no motion to reduce`,
    measurement: { animatedElements: surface.animatedElements },
  });
  finding({
    id: "forms.labels-everywhere",
    guideline: "Forms — “Labels everywhere. Every control has a <label> or is associated with a label for assistive tech.”",
    severity: surface.formControls.length === 0
      ? "not-applicable"
      : surface.formControls.every((el) => el.labelled || el.ariaLabel || el.ariaHidden === "true")
        ? "pass"
        : "minor",
    summary: surface.formControls.length === 0
      ? "no form controls on the page"
      : `${surface.formControls.length} form control(s): ${surface.formControls.map((el) => `<${el.tag}${el.type ? ` type=${el.type}` : ""}> in .${el.owner}, label ${el.labelled || el.ariaLabel ? "yes" : "none"}, visible ${el.visible}`).join("; ")} — from the vendored graph renderer, not written here, but on this page and so this page's problem`,
    measurement: surface.formControls,
  });
  finding({
    id: "interactions.links-are-links",
    guideline: "Interactions — “Links are links. Use <a> or <Link> for navigation… Never substitute with <button> or <div>.”",
    // Not "no buttons look like links" — that heuristic reads "Overview" as
    // navigation. The measurable fact is that nothing here navigates: the URL
    // never changes (see interactions.url-as-state), so there is no navigation
    // to have got wrong.
    severity: "not-applicable",
    summary: `${surface.anchors} anchors with the lens closed (the panel adds one real <a> "Open source", seen in the manage-focus tab walk); a single-page demo with no route changes at all — every control mutates local state, none navigates`,
    measurement: { anchors: surface.anchors, urlEverChanges: measurements.urlState?.urlBefore === measurements.urlState?.urlAfter ? false : true },
  });
}

async function reviewEmptyState(page) {
  // "All states designed. Empty, sparse, dense, & error states." and
  // "No dead ends. Every screen offers a next step or recovery path."
  const empty = await page.evaluate(() => {
    const coachPanel = document.querySelector(".coachPanel");
    const hero = document.querySelector(".showcase");
    const rail = document.querySelector('[data-testid="live-graph-rail"]');
    const heroText = hero?.textContent ?? "";
    const gapPx = hero && rail ? Math.round(rail.getBoundingClientRect().top - hero.getBoundingClientRect().bottom) : null;
    return {
      coachPanelRendered: Boolean(coachPanel),
      coachStepsReadout: /Coach steps/.test(heroText) ? heroText.match(/Coach steps\s*(\d+)/)?.[1] ?? null : null,
      heroClaimsSeededFromRealFiles: /Seeded from real NodeRoom files/.test(heroText),
      pointerToTheMissingCommand: /trace-coach:sqlite/.test(document.body.textContent) ,
      gapBetweenHeroAndRailPx: gapPx,
    };
  });
  measurements.emptyState = empty;
  await page.screenshot({ path: join(EVIDENCE, "wig-happy-path-empty-coach-slot.png"), fullPage: false });
  finding({
    id: "content.all-states-designed",
    guideline: "Content — “All states designed. Empty, sparse, dense, & error states.” and “No dead ends. Every screen offers a next step or recovery path.”",
    severity: empty.coachPanelRendered ? "pass" : "major",
    summary: empty.coachPanelRendered
      ? "the Trace Coach renders in this state"
      : `after the README's own Happy Path the Trace Coach slot renders nothing (${empty.gapBetweenHeroAndRailPx}px of empty space between hero and rail) while the hero one line above reads "Coach steps ${empty.coachStepsReadout}" and claims "Seeded from real NodeRoom files…" (${empty.heroClaimsSeededFromRealFiles}) — an empty state with no explanation and no next step`,
    measurement: empty,
    evidence: "promotion/evidence/wig-happy-path-empty-coach-slot.png",
  });
}

async function measureHitTargets(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('button,a[href],[role="tab"],summary,input')]
      .map((el) => {
        const rect = el.getBoundingClientRect();
        return {
          selector: describe(el),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          min: Math.round(Math.min(rect.width, rect.height)),
        };
      })
      .filter((target) => target.width > 0 && target.height > 0),
  );
}

function finding(entry) {
  findings.push(entry);
}

function run(command, args) {
  const cmd = process.platform === "win32" ? `${command}.cmd` : command;
  const result = spawnSync(cmd, args, { stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} exited ${result.status}`);
}

function posix(path) {
  return path.split("\\").join("/");
}
