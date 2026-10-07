// A developer opens a saved trace, inspects it, and reveals setup only when needed.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { assertPortFree, waitForServer, waitForPaintedGraph } from './lib/proof-server.mjs';

const [beforeDir, outputDir, consumer] = process.argv.slice(2);
assert(beforeDir && outputDir, 'Usage: node scripts/setup-disclosure-proof.mjs <before-dir> <new-output-dir> [normal-next-consumer]');
const repo = resolve('.'), target = consumer ? resolve(consumer) : repo, out = resolve(outputDir);
mkdirSync(out);
const surface = consumer ? 'installed' : 'source', port = consumer ? 4966 : 4965;
const origin = `http://127.0.0.1:${port}`, path = consumer ? '/nodetrace' : '/';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const json = file => JSON.parse(readFileSync(file, 'utf8'));
const walk = (root, dir) => readdirSync(join(root, dir), { withFileTypes: true }).flatMap(entry => {
  assert(!entry.isSymbolicLink(), 'No linked proof inputs');
  return entry.isDirectory() ? walk(root, join(dir, entry.name)) : [join(dir, entry.name).replaceAll('\\', '/')];
});
const files = ['src/DemoDashboard.tsx', 'src/styles.css', 'src/demoNavigation.ts', 'src/demoState.ts', 'src/trace/LiveGraphRail.tsx', 'vendor/nodegraph-live/NodeGraph.js', 'bin/nodetrace.mjs', 'package-lock.json', 'scripts/setup-disclosure-proof.mjs', 'public/nodetrace-state.json', ...walk(repo, 'dist')];
const installedFiles = consumer ? ['package.json', 'package-lock.json', '.next/BUILD_ID', ...['src', 'public', 'scripts', 'db', '.next/static'].flatMap(dir => walk(target, dir))] : [];
assert(files.length < 1000 && installedFiles.length < 1000, 'Bounded input inventory');
const hashes = (root, paths) => Object.fromEntries(paths.sort().map(file => [file, sha(readFileSync(join(root, file)))]));
const sourceBefore = hashes(repo, files), installedBefore = hashes(target, installedFiles);
const actual = readFileSync(join(target, consumer ? 'public/nodetrace-state.json' : 'dist/nodetrace-state.json'));
const state = JSON.parse(actual);
writeFileSync(join(out, 'actual-input.json'), actual);
const checks = [], captures = [], logs = [], responses = [], responseTasks = [];
const check = (name, pass, detail) => { checks.push({ name, pass: !!pass, detail }); assert(pass, name); };
const allowed = new Set(['path','systemroot','windir','comspec','pathext','programfiles','programfiles(x86)','programw6432','systemdrive','userprofile','appdata','localappdata','allusersprofile','homedrive','homepath','number_of_processors','processor_architecture','temp','tmp']);
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => allowed.has(key.toLowerCase())));
let browser, server, activePage, failure, serverLog = '';

async function geometry(page) {
  return page.evaluate(() => {
    const rect = n => { if (!n) return null; const r = n.getBoundingClientRect(); return { x:r.x, y:r.y, width:r.width, height:r.height, documentY:r.y + scrollY }; };
    const selectors = ['.showcase', '.showcaseCopy h1', '.traceSetup > summary', '.showcaseActions', '.launchCard', '.coachPanel', '.coachList', '.coachDetail', '.coachEmpty', '.liveGraphRail'];
    return { url:location.href, width:innerWidth, height:innerHeight, overflow:document.documentElement.scrollWidth-innerWidth,
      open:document.querySelector('.traceSetup')?.open, scrollY, active:document.activeElement?.tagName,
      regions:Object.fromEntries(selectors.map(s => [s, rect(document.querySelector(s))])) };
  });
}
async function capture(page, name) {
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode().catch(() => {}))); });
  const before = await geometry(page);
  writeFileSync(join(out, name + '.html'), await page.content());
  writeFileSync(join(out, name + '.ax.txt'), await page.locator('body').ariaSnapshot());
  await page.screenshot({ path:join(out, name + '.png'), fullPage:false });
  const after = await geometry(page);
  check(name + ': screenshot leaves same-frame geometry unchanged', JSON.stringify(before) === JSON.stringify(after));
  writeFileSync(join(out, name + '.json'), JSON.stringify(before, null, 2));
  captures.push({ name, ...before }); return before;
}
async function ready(page) {
  await page.waitForFunction(() => document.querySelector('.showcaseCopy > .inspectTrace')?.disabled === false);
  if (state.traces.length) await waitForPaintedGraph(page);
}
async function openPage(width, height, scenario = 'actual') {
  const context = await browser.newContext({ viewport:{width, height}, reducedMotion:'no-preference' });
  const page = activePage = await context.newPage(); page.setDefaultTimeout(10000);
  page.on('pageerror', e => logs.push({ scenario, type:'pageerror', text:String(e) }));
  page.on('console', m => logs.push({ scenario, type:m.type(), text:m.text() }));
  page.on('response', response => { responseTasks.push((async () => {
    const url = new URL(response.url());
    if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/_next/static/')) {
      const bytes = await response.body();
      const file = consumer ? join(target, url.pathname.replace('/_next/', '.next/')) : join(repo, 'dist', url.pathname);
      responses.push({ scenario, url:url.href, bytes:bytes.length, sha256:sha(bytes), asset:true, exact:sha(bytes) === sha(readFileSync(file)) });
    } else if (url.pathname.endsWith('/nodetrace-state.json') && scenario === 'actual') {
      const bytes = await response.body(); responses.push({ scenario, url:url.href, state:true, sha256:sha(bytes), exact:bytes.equals(actual) });
    }
  })()); });
  await page.route('**/*', route => {
    const u = new URL(route.request().url());
    if (u.origin !== origin || route.request().method() !== 'GET') {
      logs.push({ scenario, type:'blocked-request', url:u.href }); return route.abort();
    }
    return route.continue();
  });
  return { context, page };
}
const url = () => origin + path + '?disclosureProof=preserved#review';

try {
  if (consumer) {
    check('normal installed dashboard has exact installer transformation', readFileSync(join(target, 'src/nodetrace-demo/DemoDashboard.tsx'), 'utf8') === readFileSync(join(repo, 'src/DemoDashboard.tsx'), 'utf8').replaceAll('./trace', '../nodetrace'));
    check('normal installed styles are exact source bytes', sha(readFileSync(join(target, 'src/nodetrace-demo/styles.css'))) === sourceBefore['src/styles.css']);
    check('normal generated sample has four traces and no coach', state.traces.length === 4 && !state.coach);
  } else check('actual source before input unchanged', actual.equals(readFileSync(join(beforeDir, 'source-actual-input.json'))));
  await assertPortFree(port);
  const args = consumer ? [join(target, 'node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', String(port)] : [join(repo, 'node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'];
  server = spawn(process.execPath, args, { cwd:target, env, windowsHide:true, stdio:['ignore','pipe','pipe'] });
  for (const stream of [server.stdout, server.stderr]) stream.on('data', bytes => { serverLog = (serverLog + bytes).slice(-100000); });
  await waitForServer(origin + path); browser = await chromium.launch();
  for (const [width,height] of [[320,800], [390,844], [1440,960]]) {
    const name = `${surface}-${width}`, {context,page} = await openPage(width,height);
    await page.goto(url()); await ready(page); await page.evaluate(() => scrollTo(0,0));
    const details = page.locator('.traceSetup'), summary = details.locator('summary');
    const collapsed = await capture(page, name + '-collapsed');
    const prior = json(join(beforeDir, name + '-top.json'));
    check(name + ': disclosure starts closed', !collapsed.open);
    check(name + ': no horizontal overflow', collapsed.overflow <= 1, collapsed);
    check(name + ': commands hidden but current Inspect remains visible', !(await page.locator('.showcaseActions').isVisible()) && await page.locator('.showcaseCopy > .inspectTrace').isVisible());
    if (width < 500) {
      check(name + ': header within 60 percent phone height', collapsed.regions['.showcase'].height <= height * .6, collapsed.regions['.showcase']);
      const first = await page.locator(consumer ? '.liveGraphRailHead h2' : '[data-testid="trace-record"]').first().boundingBox();
      check(name + ': first record or installed graph heading before fold', first.y >= 0 && first.y + Math.min(first.height, 44) <= height, first);
    } else {
      const next = consumer ? '.coachEmpty' : '.coachPanel';
      check(name + ': next section does not drift down beyond 16 pixels', collapsed.regions[next].documentY <= prior.regions[next].rect.documentY + 16);
    }
    for (const selector of ['.coachPanel','.coachList','.coachDetail','.coachEmpty','.liveGraphRail']) {
      if (!collapsed.regions[selector] || !prior.regions[selector].rect) continue;
      const a = collapsed.regions[selector], b = prior.regions[selector].rect;
      check(name + ': protected geometry ' + selector, Math.abs(a.width-b.width) <= 1 && Math.abs(a.height-b.height) <= 1, {before:b,after:a});
    }
    const expectedSurface = state.coach?.steps.find(step => step.id === new URL(page.url()).searchParams.get('step'))?.surfaceId ?? 'shell.statusStrip';
    const expectedLabel = state.surfaces.find(s => s.id === expectedSurface)?.label;
    const beforeInspect = page.url();
    await page.locator('.showcaseCopy > .inspectTrace').click();
    await page.getByRole('dialog', { name:'Trace Lens: ' + expectedLabel, exact:true }).waitFor();
    check(name + ': first Inspect opens registered evidence', new URL(page.url()).searchParams.get('surface') === expectedSurface && !(await page.getByText('Surface unavailable', {exact:true}).count()));
    await capture(page, name + '-inspect'); await page.getByRole('button', {name:'Close Trace Lens',exact:true}).click();
    await page.waitForFunction(expected => location.href === expected, beforeInspect);
    check(name + ': lens close restores pre-inspection URL', page.url() === beforeInspect);
    await summary.focus(); await page.keyboard.press('Enter');
    check(name + ': native Enter expands setup retaining focus', await details.evaluate(n => n.open && document.activeElement === n.querySelector('summary')));
    check(name + ': every existing setup command retained', (await page.locator('.showcaseActions').textContent()).trim() === prior.regions['.showcaseActions'].text.trim());
    check(name + ': provenance text retained', (await page.locator('.launchCard').textContent()).trim() === prior.regions['.launchCard'].text.trim());
    await capture(page, name + '-expanded');
    await page.setViewportSize({width:width === 1440 ? 390 : 1440,height:960});
    check(name + ': user expansion survives resize', await details.evaluate(n => n.open));
    await page.setViewportSize({width,height}); await summary.focus(); await page.keyboard.press('Space');
    check(name + ': native Space collapses retaining focus', await details.evaluate(n => !n.open && document.activeElement === n.querySelector('summary')));
    check(name + ': toggles do not change URL', page.url() === beforeInspect);
    await page.locator('.showcaseCopy h1').click({modifiers:['Control']});
    await page.getByRole('dialog', {name:'Trace Lens: ' + expectedLabel,exact:true}).waitFor();
    check(name + ': modifier click resolves same current surface', new URL(page.url()).searchParams.get('surface') === expectedSurface);
    await page.keyboard.press('Escape'); await page.waitForFunction(expected => location.href === expected, beforeInspect);
    if (!consumer) {
      await page.getByTestId('trace-record').nth(1).click(); await page.getByRole('tab',{name:'Raw JSON'}).click();
      const raw = await page.getByTestId('trace-raw').textContent(); const selectedUrl = page.url();
      await page.getByRole('combobox',{name:'Entity',exact:true}).selectOption({index:2});
      const entity = await page.getByRole('combobox',{name:'Entity',exact:true}).inputValue();
      for (let i=0;i<12;i++) { await summary.click(); await summary.click(); }
      check(name + ': burst toggles retain selected Raw bytes, entity and URL', await page.getByTestId('trace-raw').textContent() === raw && page.url() === selectedUrl && await page.getByRole('combobox',{name:'Entity',exact:true}).inputValue() === entity);
      const currentSurface = JSON.parse(raw).activeStep.surfaceId;
      await page.locator('.showcaseCopy > .inspectTrace').click();
      await page.waitForFunction(id => new URL(location.href).searchParams.get('surface') === id, currentSurface);
      check(name + ': changing record updates header inspection identity', (await page.getByRole('dialog').getAttribute('aria-label')) === 'Trace Lens: ' + state.surfaces.find(s => s.id === currentSurface)?.label);
      await page.keyboard.press('Escape'); await page.waitForFunction(expected => location.href === expected, selectedUrl);
      await page.getByRole('tab',{name:'Overview',exact:true}).click();
      await page.getByRole('tab',{name:'Raw JSON',exact:true}).click();
      await page.goBack(); await page.waitForFunction(() => document.querySelector('[role="tab"][aria-selected="true"]')?.textContent.includes('Overview'));
      await page.goForward(); await page.getByTestId('trace-raw').waitFor();
      check(name + ': browser history restores selected Raw record', await page.getByTestId('trace-raw').textContent() === raw);
    }
    if (width === 390) {
      await page.goto(url()); await ready(page); await page.locator('.traceSetup > summary').click();
      const sizes = await page.locator('.showcase').evaluate(root => {
        const nodes = [...root.querySelectorAll('*')].filter(n => !(n instanceof SVGElement));
        const initial = nodes.map(n => ({n,size:parseFloat(getComputedStyle(n).fontSize)}));
        for (const {n,size} of initial) n.style.fontSize = size*2+'px';
        return initial.map(({n,size}) => ({tag:n.tagName,before:size,after:parseFloat(getComputedStyle(n).fontSize)}));
      });
      check(name + ': every header text size is exactly doubled without inherited compounding', sizes.every(s => s.after === 2*s.before), sizes);
      await page.locator('.traceSetup > summary').focus(); await page.keyboard.press('Space');
      await page.evaluate(() => scrollTo(0,0)); const enlarged = await capture(page,name+'-text200-collapsed');
      check(name + ': enlarged text no document overflow', enlarged.overflow <= 1, enlarged);
      await page.locator('.traceSetup > summary').focus(); await page.keyboard.press('Enter');
      await page.locator('.launchCard').scrollIntoViewIfNeeded(); const expanded = await capture(page,name+'-text200-provenance');
      check(name + ': enlarged expanded setup has no document overflow', expanded.overflow <= 1, expanded);
      const labels = await page.locator('.traceSetup .heroStats :is(span, small, strong)').evaluateAll(nodes => nodes.map(n => ({text:n.textContent,width:n.clientWidth,scroll:n.scrollWidth,whiteSpace:getComputedStyle(n).whiteSpace})));
      check(name + ': all enlarged provenance labels readable without ellipsis', labels.every(n=>n.scroll<=n.width+1 && n.whiteSpace==='normal'),labels);
      await page.locator('.traceSetup > summary').focus(); await page.keyboard.press('Space');
      check(name + ': enlarged setup keyboard escape remains usable', !(await details.evaluate(n=>n.open)));
    }
    await context.close();
  }
  // Explicit transport fixtures exercise UI states; normal cases above use exact on-disk data.
  const {context,page} = await openPage(390,844,'transport-recovery');
  let requests=0, release;
  const gate = new Promise(resolve => { release=resolve; });
  await page.route('**/nodetrace-state.json', async route => {
    requests++;
    if(requests === 1) { await gate; return route.fulfill({status:503,contentType:'text/plain',body:'Explicit local proof transport failure'}); }
    return route.fulfill({status:200,contentType:'application/json',body:actual});
  });
  await page.goto(url()); await page.getByRole('status').filter({hasText:'Loading the local trace file'}).waitFor();
  check('loading status and disabled Inspect remain visible outside closed setup', await page.locator('.showcaseCopy > .inspectTrace').isDisabled() && !(await page.locator('.traceSetup').evaluate(n=>n.open)));
  await capture(page,surface+'-loading'); release(); await page.getByRole('alert').waitFor();
  check('error and Retry visible outside closed setup', await page.getByRole('button',{name:'Retry loading trace',exact:true}).isVisible() && !(await page.locator('.traceSetup').evaluate(n=>n.open)));
  await capture(page,surface+'-error'); await page.getByRole('button',{name:'Retry loading trace',exact:true}).click(); await ready(page);
  check('one explicit Retry recovers actual data', requests === 2 && !(await page.locator('.loadError[role="alert"]').count()), {requests,ownedAlerts:await page.locator('.loadError[role="alert"]').count(),allAlerts:await page.getByRole('alert').count()});
  const start=Date.now(); let rounds=0;
  while(Date.now()-start<15000 && rounds<200) { await page.locator('.traceSetup > summary').click(); await page.waitForTimeout(50); await page.locator('.traceSetup > summary').click(); rounds++; }
  check('sustained toggling makes no extra state request and stays bounded', rounds>=10 && requests===2 && !(await page.locator('.traceSetup').evaluate(n=>n.open)),{rounds,elapsedMs:Date.now()-start,requests});
  await capture(page,surface+'-recovered-sustained'); await context.close();
  const empty = {...state,traces:[],proofs:[],surfaces:[]}; delete empty.coach;
  const emptyCase = await openPage(390,844,'empty-input');
  await emptyCase.page.route('**/nodetrace-state.json', route => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(empty)}));
  writeFileSync(join(out,'explicit-empty-input.json'),JSON.stringify(empty,null,2));
  await emptyCase.page.goto(url()); await emptyCase.page.locator('.coachEmpty').waitFor();
  check('empty input retains truthful guidance without fake coach or graph', !(await emptyCase.page.getByTestId('trace-record').count()) && !(await emptyCase.page.locator('.liveGraphRail').count()) && await emptyCase.page.locator('.coachEmpty').isVisible());
  await emptyCase.page.locator('.traceSetup > summary').click();
  check('empty setup remains reachable and states no coach captures', (await emptyCase.page.locator('.launchCheck').textContent()).includes('No Trace Coach captures are loaded yet'));
  await capture(emptyCase.page,surface+'-empty'); await emptyCase.context.close();
  await Promise.all(responseTasks);
  check('all normal actual input and built assets match disk', responses.some(r=>r.state) && responses.some(r=>r.asset) && responses.every(r=>r.exact));
  check('no application errors or unexpected traffic', !logs.some(l=>l.type==='pageerror'||l.type==='blocked-request'||l.type==='error' && !(l.scenario==='transport-recovery' && l.text.includes('503'))),logs.filter(l=>l.type==='error'||l.type==='pageerror'));
} catch(error) { failure=String(error.stack||error); if(activePage && !activePage.isClosed()) { try { await capture(activePage,surface+'-failure'); } catch {} } }
finally { await browser?.close(); server?.kill(); writeFileSync(join(out,'server.log'),serverLog); }
const sourceAfter=hashes(repo,files),installedAfter=hashes(target,installedFiles);
checks.push({name:'all source, built assets and installed inputs unchanged during proof',pass:JSON.stringify(sourceBefore)===JSON.stringify(sourceAfter)&&JSON.stringify(installedBefore)===JSON.stringify(installedAfter)});
const report={proof:'NODETRACE-D3-SETUP-DISCLOSURE-01',at:new Date().toISOString(),surface,consumer:consumer?target:null,checks,captures,responses,logs,failure,sourceBefore,sourceAfter,installedBefore,installedAfter,ok:!failure&&checks.every(c=>c.pass),limits:['Actual source and normal installed fixture used without substitution in normal cases.','Loading/error/empty are explicitly routed local fixtures, not provider incidents.','200 percent changes all header computed text sizes; it is not browser zoom or whole-app certification.','Viewport-only screenshots, no field performance or complete repo grade.']};
writeFileSync(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({ok:report.ok,checks:checks.length,captures:captures.length,failure}));
if(!report.ok)process.exitCode=1;
