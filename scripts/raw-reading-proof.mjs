// A developer reads a long saved trace, compares an entity, and resumes after interruptions.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { assertPortFree, waitForServer, waitForPaintedGraph } from './lib/proof-server.mjs';

const [fixtureDir, outputDir, consumer, attachmentDir] = process.argv.slice(2);
assert(fixtureDir && outputDir, 'Usage: node scripts/raw-reading-proof.mjs <before-fixtures> <new-output> [installed-next-consumer complete-attachment-packet]');
assert(!consumer || attachmentDir, 'Recorded coach replay in a normal consumer requires its complete attachment packet');
const repo = resolve('.'), target = consumer ? resolve(consumer) : repo;
const out = resolve(outputDir); mkdirSync(out);
const port = consumer ? 4960 : 4959, origin = `http://127.0.0.1:${port}`;
const route = consumer ? '/nodetrace' : '/';
const sha = b => createHash('sha256').update(b).digest('hex');
const files = ['src/DemoDashboard.tsx', 'src/styles.css', 'src/demoNavigation.ts', 'src/demoState.ts', 'src/trace/LiveGraphRail.tsx', 'vendor/nodegraph-live/NodeGraph.js', 'bin/nodetrace.mjs', 'package-lock.json', 'scripts/raw-reading-proof.mjs', 'public/nodetrace-state.json'];
const hashes = () => Object.fromEntries(files.map(file => [file, sha(readFileSync(join(repo, file)))]));
const before = hashes();
const fixtures = Object.fromEntries(['actual', 'short', 'long'].map(name => [name, readFileSync(join(fixtureDir, `${name}-state.json`))]));
for (const [name, bytes] of Object.entries(fixtures)) writeFileSync(join(out, `${name}-state.json`), bytes);
const attachmentManifest = attachmentDir ? JSON.parse(readFileSync(join(attachmentDir, 'attachment-manifest.json'), 'utf8')) : {};
const attachments = new Map();
assert(Object.keys(attachmentManifest).length <= 64, 'Bounded fixture attachments');
for (const [name, binding] of Object.entries(attachmentManifest)) {
  assert(/^captures\/[a-z0-9._-]+\.(png|svg|json)$/.test(name), 'Explicit local capture path');
  const bytes = readFileSync(join(attachmentDir, 'attachments', name.slice('captures/'.length)));
  assert(bytes.length <= 2 * 1024 * 1024 && bytes.length === binding.bytes && sha(bytes) === binding.sha256, `Exact fixture attachment: ${name}`);
  attachments.set('/' + name, bytes);
  const destination = join(out, 'attachments', name.slice('captures/'.length)); mkdirSync(dirname(destination), { recursive: true }); writeFileSync(destination, bytes);
}
writeFileSync(join(out, 'attachment-manifest.json'), JSON.stringify(attachmentManifest, null, 2));
const installedFiles = [];
function collectInstalled(folder) {
  for (const entry of readdirSync(join(target, folder), { withFileTypes: true })) {
    const name = `${folder}/${entry.name}`;
    assert(!entry.isSymbolicLink(), 'No linked consumer evidence input');
    if (entry.isDirectory()) collectInstalled(name);
    else { installedFiles.push(name); assert(installedFiles.length <= 1000, 'Bounded consumer input inventory'); }
  }
}
if (consumer) {
  for (const folder of ['src', 'public', 'scripts', 'db', '.next/static']) collectInstalled(folder);
  installedFiles.push('package.json', 'package-lock.json', '.next/BUILD_ID');
}
const installedHashes = () => Object.fromEntries(installedFiles.sort().map(name => [name, sha(readFileSync(join(target, name)))]));
const installedBefore = installedHashes();
const checks = [], captures = [], logs = [], responses = [], pendingResponses = [];
const check = (name, pass, detail) => { checks.push({ name, pass: Boolean(pass), detail }); assert(pass, name); };
let browser, server, failure, activePage, serverLog = '';
const allowed = new Set(['path','systemroot','windir','comspec','pathext','programfiles','programfiles(x86)','programw6432','systemdrive','userprofile','appdata','localappdata','allusersprofile','homedrive','homepath','number_of_processors','processor_architecture','temp','tmp']);
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => allowed.has(key.toLowerCase())));
async function meta(page) {
  return page.evaluate(() => {
    const raw = document.querySelector('[data-testid="trace-raw"]'), r = raw?.getBoundingClientRect(), g = document.querySelector('[data-testid="live-graph-rail"]')?.getBoundingClientRect();
    const css = raw && getComputedStyle(raw);
    return { url: location.href, viewport: { width: innerWidth, height: innerHeight }, documentHeight: document.documentElement.scrollHeight, overflow: document.documentElement.scrollWidth - innerWidth, keys: window.__rawKeys,
      raw: raw && { x: r.x, y: r.y, width: r.width, height: r.height, documentY: r.y + scrollY, clientHeight: raw.clientHeight, scrollHeight: raw.scrollHeight, scrollTop: raw.scrollTop, fontSize: css.fontSize, overflowY: css.overflowY, outline: css.outline, tabIndex: raw.tabIndex },
      graph: g && { width: g.width, height: g.height, documentY: g.y + scrollY }, focused: document.activeElement?.getAttribute('data-testid'), rawText: raw?.textContent, selection: getSelection()?.toString() };
  });
}
async function capture(page, name) {
  const data = await meta(page);
  if (data.rawText !== undefined) { writeFileSync(join(out, `${name}.raw.txt`), data.rawText); data.rawSha256 = sha(data.rawText); delete data.rawText; }
  writeFileSync(join(out, `${name}.json`), JSON.stringify(data, null, 2));
  writeFileSync(join(out, `${name}.html`), await page.content());
  writeFileSync(join(out, `${name}.ax.txt`), await page.locator('body').ariaSnapshot());
  await page.screenshot({ path: join(out, `${name}.png`), fullPage: true });
  await page.screenshot({ path: join(out, `${name}-viewport.png`) });
  captures.push({ name, ...data }); return data;
}
// A sampled endpoint can precede Chromium's native scroll completion. Bind
// each completed reading action to scrollend before starting the next one.
// Rapid interruption remains a separately retained browser-native limitation.
async function nativeEndpoint(page, key) {
  const raw = page.getByTestId('trace-raw'); await raw.focus();
  const needsMove = await raw.evaluate((n, key) => {
    const at = () => key === 'Home' ? n.scrollTop === 0 : n.scrollHeight - n.clientHeight - n.scrollTop <= 2;
    window.__rawEndpoint = { key, started: performance.now(), initial: n.scrollTop, done: at(), alreadyAtTarget: at() };
    if (!at()) n.addEventListener('scrollend', function complete() {
      if (at()) { window.__rawEndpoint.done = true; window.__rawEndpoint.finished = performance.now(); n.removeEventListener('scrollend', complete); }
    });
    return !at();
  }, key);
  await page.keyboard.press(key);
  if (needsMove) await page.waitForFunction(() => window.__rawEndpoint.done, null, { timeout: 2000 });
  await page.waitForFunction(key => { const n = document.querySelector('[data-testid="trace-raw"]'); return key === 'Home' ? n.scrollTop === 0 : n.scrollHeight - n.clientHeight - n.scrollTop <= 2; }, key);
}
async function toEnd(page) { await nativeEndpoint(page, 'End'); }
async function toHome(page) { await nativeEndpoint(page, 'Home'); }
try {
  if (consumer) {
    check('normal installed dashboard has exact owned import transformation', readFileSync(join(target, 'src/nodetrace-demo/DemoDashboard.tsx'), 'utf8') === readFileSync(join(repo, 'src/DemoDashboard.tsx'), 'utf8').replaceAll('./trace', '../nodetrace'));
    check('normal installed Raw styles are exact source bytes', sha(readFileSync(join(target, 'src/nodetrace-demo/styles.css'))) === before['src/styles.css']);
  }
  await assertPortFree(port);
  const args = consumer ? [join(target, 'node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', String(port)] : [join(repo, 'node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'];
  server = spawn(process.execPath, args, { cwd: target, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout.on('data', b => { serverLog = (serverLog + b).slice(-100000); }); server.stderr.on('data', b => { serverLog = (serverLog + b).slice(-100000); });
  await waitForServer(origin + route); browser = await chromium.launch();
  const cases = consumer ? [['short',390,844],['short',1024,768],['long',390,844],['long',1024,768]] : [['actual',320,800],['actual',390,844],['actual',1024,768],['actual',1440,960],['short',390,844],['short',1024,768],['long',390,844],['long',1024,768],['actual',390,844,'no-preference',true],['actual',1024,768,'reduce',true],['long',390,844,'reduce']];
  for (const [fixture, width, height, motion = 'no-preference', doubled = false] of cases) {
    const name = `${fixture}-${width}-${motion}${doubled ? '-text200' : ''}`;
    if (process.env.NODETRACE_RAW_ONLY && process.env.NODETRACE_RAW_ONLY !== name) continue;
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: motion });
    await context.addInitScript(() => { window.__rawKeys = []; addEventListener('keydown', event => { if (!['Home','End','PageDown'].includes(event.key)) return; const n = document.querySelector('[data-testid="trace-raw"]'); window.__rawKeys.push({ key: event.key, target: event.target.getAttribute('data-testid'), scrollTop: n?.scrollTop, at: performance.now() }); if (window.__rawKeys.length > 24) window.__rawKeys.shift(); }); });
    const page = activePage = await context.newPage(); page.setDefaultTimeout(15000);
    page.on('console', m => logs.push({ name, type: m.type(), text: m.text(), location: m.location() })); page.on('pageerror', e => logs.push({ name, type: 'pageerror', text: String(e) }));
    page.on('response', response => {
      const pathname = new URL(response.url()).pathname;
      const file = pathname.startsWith('/assets/') ? join(target, 'dist', pathname.slice(1)) : pathname.startsWith('/_next/static/') ? join(target, '.next', pathname.slice('/_next/'.length)) : null;
      if (file) pendingResponses.push((async () => { const bytes = await response.body(); responses.push({ url: response.url(), sha256: sha(bytes), diskExact: sha(bytes) === sha(readFileSync(file)) }); })());
    });
    await page.route('**/nodetrace-state.json', r => r.fulfill({ status: 200, contentType: 'application/json', body: fixtures[fixture] }));
    if (consumer) await page.route('**/captures/**', r => {
      const pathname = new URL(r.request().url()).pathname, bytes = attachments.get(pathname);
      if (!bytes) return r.continue();
      responses.push({ url: r.request().url(), fixtureAttachment: true, sha256: sha(bytes), diskExact: sha(bytes) === attachmentManifest[pathname.slice(1)].sha256 });
      return r.fulfill({ status: 200, contentType: pathname.endsWith('.png') ? 'image/png' : pathname.endsWith('.svg') ? 'image/svg+xml' : 'application/json', body: bytes });
    });
    await page.goto(`${origin}${route}?unrelated=preserved#review`); await page.getByRole('tab', { name: 'Raw JSON', exact: true }).waitFor(); await waitForPaintedGraph(page);
    if (consumer) {
      await page.waitForFunction(() => [...document.images].every(n => n.complete && n.naturalWidth > 0));
      check(`${name}: recorded capture images decode`, await page.locator('img').count() > 0);
    }
    const rawTab = page.getByRole('tab', { name: 'Raw JSON', exact: true }), raw = page.getByTestId('trace-raw');
    const entity = page.getByRole('combobox', { name: 'Entity', exact: true });
    await entity.selectOption({ index: 1 }); const entityId = await entity.inputValue();
    const entityLabel = await entity.locator('option:checked').textContent();
    const readout = await page.getByTestId('live-graph-node-events').textContent();
    const eventIds = await page.getByTestId('live-graph-node-events').locator('li').allTextContents();
    const [kind, ...labelParts] = entityLabel.split(': '), label = labelParts.join(': ');
    const field = { actor: 'actor', tool: 'surfaceId', artifact: 'artifactId', step: 'phase' }[kind];
    const expectedIds = [...new Set(JSON.parse(fixtures[fixture]).traces.filter(row => row[field] === label).map(row => row.id))];
    check(`${name}: entity has exact actual producing events`, readout.includes(entityLabel) && eventIds.length > 0 && JSON.stringify(eventIds) === JSON.stringify(expectedIds), { entityId, entityLabel, eventIds, expectedIds });
    await rawTab.focus(); await page.keyboard.press('Enter'); await raw.waitFor();
    if (doubled) await raw.evaluate(n => { n.style.fontSize = '22px'; n.style.lineHeight = '33px'; });
    const originalText = await raw.textContent(), originalHash = sha(originalText);
    const matchingBefore = join(fixtureDir, `${fixture}-${width}-${motion}.raw.txt`);
    if (['actual','short','long'].includes(fixture) && (fixture === 'actual' && !doubled || width === 390 && motion === 'no-preference')) {
      check(`${name}: exact paired before JSON`, sha(readFileSync(matchingBefore)) === originalHash);
    }
    check(`${name}: current selected snippet exact`, JSON.parse(originalText).activeStep.codeBlock.snippet === JSON.parse(fixtures[fixture]).coach.steps[0].codeBlock.snippet);
    for (let i = 0; i < 3 && await raw.evaluate(n => document.activeElement !== n); i++) await page.keyboard.press('Tab');
    check(`${name}: natural Tab reaches named region`, await raw.evaluate(n => document.activeElement === n && n.getAttribute('aria-label') === 'Raw trace JSON' && n.getAttribute('role') === 'region'));
    const top = await capture(page, `${name}-top`);
    check(`${name}: responsive height budget`, top.raw.height <= Math.min(560, height * .65) + 2, top.raw);
    check(`${name}: no document overflow`, top.overflow <= 1, top.overflow);
    check(`${name}: visible keyboard focus`, /3px/.test(top.raw.outline) && !/none/.test(top.raw.outline), top.raw.outline);
    if (doubled) check(`${name}: actual doubled component text`, top.raw.fontSize === '22px');
    await page.keyboard.press('PageDown'); await page.waitForFunction(() => document.querySelector('[data-testid="trace-raw"]').scrollTop > 0);
    await toEnd(page); const end = await capture(page, `${name}-end`);
    check(`${name}: last line reachable with native End`, end.raw.scrollHeight - end.raw.clientHeight - end.raw.scrollTop <= 2 && end.rawSha256 === originalHash, end.raw);
    await entity.selectOption({ index: 2 });
    check(`${name}: incidental entity render preserves reading position`, Math.abs((await raw.evaluate(n => n.scrollTop)) - end.raw.scrollTop) <= 1);
    await raw.focus(); await page.keyboard.press('Tab'); check(`${name}: forward Tab exits`, await raw.evaluate(n => document.activeElement !== n));
    await raw.focus(); await page.keyboard.press('Shift+Tab'); check(`${name}: backward Tab exits`, await raw.evaluate(n => document.activeElement !== n));
    await toHome(page); check(`${name}: Home restores first line`, await raw.evaluate(n => n.scrollTop === 0));
    const box = await raw.boundingBox(); await page.mouse.move(box.x + 20, box.y + 23); await page.mouse.down(); await page.mouse.move(box.x + Math.min(box.width - 30, 160), box.y + 40, { steps: 6 }); await page.mouse.up();
    check(`${name}: pointer can select JSON text`, await page.evaluate(() => Boolean(getSelection()?.toString().trim())));
    await toEnd(page); await page.getByTestId('trace-record').nth(1).click();
    check(`${name}: selecting a record preserves the existing Overview transition`, await page.getByRole('tab', { name: 'Overview', exact: true }).getAttribute('aria-selected') === 'true');
    await rawTab.click();
    check(`${name}: new step begins at top with current payload`, (await raw.evaluate(n => n.scrollTop)) === 0 && JSON.parse(await raw.textContent()).activeStep.id === JSON.parse(fixtures[fixture]).coach.steps[1].id);
    for (let i = 0; i < 5; i++) { await page.getByRole('tab', { name: 'Overview', exact: true }).click(); await rawTab.click(); await page.getByTestId('trace-record').nth(i % 2).click(); await rawTab.click(); check(`${name}: burst ${i} begins current text at top`, await raw.evaluate(n => n.scrollTop === 0)); }
    await page.getByTestId('trace-record').nth(0).click(); await rawTab.click();
    const reloadHash = sha(await raw.textContent()); await page.reload(); await raw.waitFor();
    check(`${name}: Raw/current bytes survive reload`, sha(await raw.textContent()) === reloadHash);
    await page.getByRole('tab', { name: 'Overview', exact: true }).click(); await page.goBack(); await raw.waitFor();
    check(`${name}: Back restores Raw`, sha(await raw.textContent()) === reloadHash);
    await page.goForward(); check(`${name}: Forward restores Overview`, await page.getByRole('tab', { name: 'Overview', exact: true }).getAttribute('aria-selected') === 'true');
    check(`${name}: unrelated host state retained`, new URL(page.url()).searchParams.get('unrelated') === 'preserved' && new URL(page.url()).hash === '#review');
    if (!consumer && fixture === 'long' && width === 390 && motion === 'no-preference') {
      await rawTab.click(); const started = Date.now(); let rounds = 0;
      while (Date.now() - started < 60000) { await toEnd(page); await toHome(page); check(`${name}: sustained ${rounds} complete unchanged text`, sha(await raw.textContent()) === originalHash); await page.waitForTimeout(1000); rounds++; }
      check(`${name}: sixty-second reading session`, Date.now() - started >= 60000, { rounds, elapsedMs: Date.now() - started });
      await capture(page, `${name}-sustained`);
    }
    await context.close();
  }
  if (!consumer && !process.env.NODETRACE_RAW_ONLY) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } }); const page = activePage = await context.newPage(); let tries = 0;
    page.on('console', m => logs.push({ name: 'degraded-retry', type: m.type(), text: m.text(), location: m.location() }));
    page.on('pageerror', e => logs.push({ name: 'degraded-retry', type: 'pageerror', text: String(e) }));
    await page.route('**/nodetrace-state.json', r => ++tries === 1 ? r.fulfill({ status: 503, body: 'unavailable' }) : r.fulfill({ status: 200, contentType: 'application/json', body: fixtures.actual }));
    await page.goto(origin); await page.getByRole('button', { name: 'Retry loading trace', exact: true }).waitFor(); await capture(page, 'degraded-before-retry');
    check('failed state is visible before Retry', tries === 1 && await page.getByRole('alert').isVisible() && await page.getByTestId('trace-raw').count() === 0);
    await page.getByRole('button', { name: 'Retry loading trace', exact: true }).click(); await page.getByRole('tab', { name: 'Raw JSON', exact: true }).click();
    check('honest failure and Retry restores named current reading region', tries === 2 && await page.getByRole('region', { name: 'Raw trace JSON', exact: true }).isVisible()); await capture(page, 'recovered-raw'); await context.close();
  }
  await Promise.all(pendingResponses); check('all captured source or installed assets equal this actual build', responses.some(r => !r.fixtureAttachment) && responses.every(r => r.diskExact));
  const expectedUnavailable = l => l.name === 'degraded-retry' && l.type === 'error' && l.location?.url === `${origin}/nodetrace-state.json` && l.text === 'Failed to load resource: the server responded with a status of 503 (Service Unavailable)';
  check('no unexpected page or console errors', !logs.some(l => ['error','pageerror'].includes(l.type) && !expectedUnavailable(l)), logs);
} catch (error) { failure = error.stack ?? String(error); if (activePage && !activePage.isClosed()) await capture(activePage, 'failure-current-state'); }
finally { await browser?.close(); if (server) { server.kill(); await new Promise(r => setTimeout(r, 300)); } writeFileSync(join(out, 'server.log'), serverLog); }
const after = hashes(); check('source/public inputs unchanged during proof', JSON.stringify(before) === JSON.stringify(after));
const installedAfter = installedHashes(); if (consumer) check('normal installed consumer source, state and build inputs unchanged', JSON.stringify(installedBefore) === JSON.stringify(installedAfter));
const report = { proof: 'NODETRACE-RAW-READING-REGION-01', at: new Date().toISOString(), consumer: consumer ?? null, onlyCell: process.env.NODETRACE_RAW_ONLY ?? null, routedFixtures: 'Exact retained before inputs with explicitly bound capture attachments in installed replay; representative local saved trace, not fresh production data or the normal four-trace consumer state', attachmentManifest, installedBefore, installedAfter, browser: browser?.version(), checks, captures, logs, responses, sourceHashes: before, afterHashes: after, failure, ok: !failure && checks.every(c => c.pass), limits: ['Desktop Chromium viewport emulation', 'Text200 enlarges only actual Raw component text, not browser zoom', 'Not a human, physical-device or performance certification', 'Rapid Home during unfinished native scrolling is a retained Chromium limitation; completed-action proof waits scrollend'] };
writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify({ ok: report.ok, checks: checks.length, captures: captures.length, failure })); if (!report.ok) process.exitCode = 1;
