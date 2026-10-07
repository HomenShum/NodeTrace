import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const packet = dirname(fileURLToPath(import.meta.url));
const { chromium } = createRequire('D:/VSCode Projects/cafecorner_nodebench/nodebench_ai4/NodeTrace/package.json')('playwright');
const browser = await chromium.launch(), rows = [];
const text = readFileSync(join(packet, 'E6d-nodetrace-raw-before/long-390-no-preference.raw.txt'), 'utf8');
for (const [pauseMs, refocus] of [[0, true], [250, true], [0, false], [250, false]]) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.setContent('<pre tabindex="0" style="box-sizing:border-box;max-height:min(560px,65vh);padding:14px;border:1px solid black;overflow-y:auto;white-space:pre-wrap;overflow-wrap:anywhere;font:11px/1.5 Consolas,monospace;width:332px"></pre>');
  await page.locator('pre').evaluate((n, content) => { n.textContent = content; }, text);
  await page.locator('pre').focus(); await page.keyboard.press('End');
  await page.waitForFunction(() => { const n = document.querySelector('pre'); return n.scrollHeight - n.clientHeight - n.scrollTop <= 2; });
  const end = await page.locator('pre').evaluate(n => ({ top: n.scrollTop, max: n.scrollHeight - n.clientHeight }));
  if (pauseMs) await page.waitForTimeout(pauseMs);
  if (refocus) await page.locator('pre').focus();
  await page.keyboard.press('Home'); await page.waitForTimeout(1000);
  const after = await page.locator('pre').evaluate(n => ({ top: n.scrollTop, max: n.scrollHeight - n.clientHeight, focus: document.activeElement === n }));
  rows.push({ pauseMs, refocus, end, after, homeReachedStart: after.top === 0 }); await page.close();
}
const report = { at: new Date().toISOString(), browser: browser.version(), isolation: 'Native pre only, no React, application handlers, fixture parser or proof-container listeners. Same retained long JSON text.', rows };
await browser.close(); writeFileSync(join(packet, 'E6d-raw-native-keyboard-fractional-probe.json'), JSON.stringify(report, null, 2)+'\n'); console.log(JSON.stringify(report));
