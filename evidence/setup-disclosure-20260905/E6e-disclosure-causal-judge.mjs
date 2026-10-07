import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
const P=dirname(fileURLToPath(import.meta.url)),R='D:/VSCode Projects/cafecorner_nodebench/nodebench_ai4/NodeTrace',C='C:/Users/hshum/AppData/Local/Temp/nodetrace-next-e2e-AxCJ0v',O=join(P,'E6e-nodetrace-disclosure-final-judge/causal');mkdirSync(O);
const sha=b=>createHash('sha256').update(b).digest('hex'),json=p=>JSON.parse(readFileSync(p,'utf8'));
const sourceReport=json(join(P,'E6e-nodetrace-disclosure-source-final/report.json')),installedReport=json(join(P,'E6e-nodetrace-disclosure-installed-final/report.json'));
const hashes=(root,map)=>Object.fromEntries(Object.keys(map).map(p=>[p,sha(readFileSync(join(root,p)))]));
const before={source:hashes(R,sourceReport.sourceBefore),installed:hashes(C,installedReport.installedBefore)};assert.deepEqual(before.source,sourceReport.sourceBefore);assert.deepEqual(before.installed,installedReport.installedBefore);
const {chromium}=createRequire(join(R,'package.json'))('playwright');const {assertPortFree,waitForServer,waitForPaintedGraph}=await import(pathToFileURL(join(R,'scripts/lib/proof-server.mjs')));
const allowed=new Set(['path','systemroot','windir','comspec','pathext','programfiles','programfiles(x86)','programw6432','systemdrive','userprofile','appdata','localappdata','allusersprofile','homedrive','homepath','number_of_processors','processor_architecture','temp','tmp']);const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>allowed.has(k.toLowerCase())));
const checks=[],cases=[],logs=[],serverLogs={};const check=(n,p,d)=>{checks.push({name:n,pass:!!p,detail:d});assert(p,n)};let browser,server,failure;
const scriptPath=Object.keys(before.source).find(p=>p.startsWith('dist/assets/')&&p.endsWith('.js'));
const originalBundle=readFileSync(join(R,scriptPath),'utf8');
const old='_=(y==null?void 0:y.surfaceId)??"shell.statusStrip"',replacement='_="shell.statusStrip"';
assert.equal(originalBundle.split(old).length-1,1,'Exact single reviewed compiled identity seam');
const knockoutBundle=originalBundle.replace(old,replacement);writeFileSync(join(O,'identity-knockout-bundle.js.txt'),knockoutBundle);
async function start(surface){const port=surface==='source'?4965:4966,root=surface==='source'?R:C;await assertPortFree(port);serverLogs[surface]='';server=spawn(process.execPath,surface==='source'?[join(R,'node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port',String(port),'--strictPort']:[join(C,'node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port',String(port)],{cwd:root,env,windowsHide:true,stdio:['ignore','pipe','pipe']});for(const s of[server.stdout,server.stderr])s.on('data',b=>serverLogs[surface]=(serverLogs[surface]+b).slice(-100000));await waitForServer(`http://127.0.0.1:${port}`);return `http://127.0.0.1:${port}`;}
async function stop(){server?.kill();server=null;await new Promise(r=>setTimeout(r,200));}
async function open(origin,name){const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();page.setDefaultTimeout(10000);page.on('console',m=>logs.push({name,type:m.type(),text:m.text()}));page.on('pageerror',e=>logs.push({name,type:'pageerror',text:String(e)}));await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!==origin||route.request().method()!=='GET'){logs.push({name,type:'blocked-request',url:u.href});return route.abort()}return route.continue()});return {context,page};}
async function shot(page,name){writeFileSync(join(O,name+'.html'),await page.content());writeFileSync(join(O,name+'.ax.txt'),await page.locator('body').ariaSnapshot());await page.screenshot({path:join(O,name+'.png'),fullPage:false});}
async function alerts(page){return page.evaluate(()=>{const found=[];function inspect(root,chain){for(const n of root.querySelectorAll('[role="alert"]')){const c=getComputedStyle(n),r=n.getBoundingClientRect();found.push({chain,tag:n.tagName,id:n.id,role:n.getAttribute('role'),ariaLive:n.getAttribute('aria-live'),text:n.textContent,html:n.outerHTML,ownedLoadError:n.matches('.loadError[role="alert"]'),rect:{x:r.x,y:r.y,width:r.width,height:r.height},computed:{position:c.position,overflow:c.overflow,clip:c.clip,clipPath:c.clipPath},rootHost:root.host?.outerHTML??null,shadowRootHTML:root.host?root.innerHTML:null})}for(const n of root.querySelectorAll('*'))if(n.shadowRoot)inspect(n.shadowRoot,[...chain,n.tagName.toLowerCase()]);}inspect(document,[]);return found;});}
try{
 browser=await chromium.launch();let origin=await start('source');
 for(const name of ['current-identity','old-identity-knockout','current-identity-restored']){
  const {context,page}=await open(origin,name);let bundleResponse;
  if(name==='old-identity-knockout')await page.route('**/'+scriptPath.slice('dist/'.length),r=>r.fulfill({status:200,contentType:'text/javascript',body:knockoutBundle}));
  page.on('response',r=>{if(new URL(r.url()).pathname===scriptPath.slice('dist'.length))bundleResponse=r;});
  await page.goto(origin+'/?disclosureProof=preserved#review');await page.waitForFunction(()=>document.querySelector('.showcaseCopy > .inspectTrace')?.disabled===false);await waitForPaintedGraph(page);
  const originalUrl=page.url(),beforeHit=await page.locator('.showcase').getAttribute('data-nodetrace-surface');
  await page.locator('.showcaseCopy > .inspectTrace').click();await page.getByRole('dialog').waitFor();
  const label=await page.getByRole('dialog').getAttribute('aria-label'),text=await page.getByRole('dialog').innerText(),url=page.url(),firstInspectRegistered=!text.includes('No registry entry is available');
  check(name+': exact intended bundle delivered',sha(await bundleResponse.body())===sha(name==='old-identity-knockout'?knockoutBundle:originalBundle));
  check(name+': intervention predicts current versus old missing-surface result',name==='old-identity-knockout'?!firstInspectRegistered&&label==='Trace Lens: Surface unavailable'&&beforeHit==='shell.statusStrip':firstInspectRegistered&&label==='Trace Lens: Room trace strip'&&beforeHit==='workSurface.traceStrip');
  await shot(page,name);await page.keyboard.press('Escape');await page.waitForFunction(u=>location.href===u,originalUrl);check(name+': exact unrelated and coach URL restored',page.url()===originalUrl);
  cases.push({name,intervention:name==='old-identity-knockout'?'Only the compiled current-surface expression restored to the old literal in this browser response. No disk edit.':'Actual built app bytes',beforeHit,label,firstInspectRegistered,url,originalUrl});await context.close();
 }
 await stop();origin=await start('installed');
 const {context,page}=await open(origin,'installed-shadow-alert');let requests=0,release;const gate=new Promise(r=>release=r),actual=readFileSync(join(C,'public/nodetrace-state.json'));
 await page.route('**/nodetrace-state.json',async route=>{requests++;if(requests===1){await gate;return route.fulfill({status:503,contentType:'text/plain',body:'Explicit local judge failure'})}return route.fulfill({status:200,contentType:'application/json',body:actual})});
 await page.goto(origin+'/nodetrace?disclosureProof=preserved#review');await page.locator('.showcaseCopy [role="status"]').filter({hasText:'Loading the local trace file'}).waitFor();
 const loading=await alerts(page);release();await page.locator('.loadError[role="alert"]').waitFor();const failed=await alerts(page);await shot(page,'installed-owned-error');
 await page.getByRole('button',{name:'Retry loading trace',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.showcaseCopy > .inspectTrace')?.disabled===false);await page.locator('.loadError[role="alert"]').waitFor({state:'detached'});await waitForPaintedGraph(page);
 const recovered=await alerts(page),bodyAlerts=await page.getByRole('alert').count();await shot(page,'installed-recovered-with-host-announcer');
 check('Actual installed Retry dispatch count is exactly two state requests',requests===2,{requests});
 check('Owned error alert exists on failure and is removed on recovery',failed.some(a=>a.ownedLoadError&&!a.chain.length)&&!recovered.some(a=>a.ownedLoadError),{failed,recovered});
 check('Remaining empty alert is inside actual Next route announcer shadow DOM',recovered.length===1&&recovered[0].chain.at(-1)==='next-route-announcer'&&recovered[0].role==='alert'&&recovered[0].text===''&&recovered[0].ariaLive==='assertive'&&bodyAlerts===1,recovered);
 writeFileSync(join(O,'installed-alert-shadow-observation.json'),JSON.stringify({requests,loading,failed,recovered,playwrightAlertCountAfterRecovery:bodyAlerts},null,2));await context.close();
 check('No app page errors or unexpected traffic; only explicit503 console error',!logs.some(x=>x.type==='pageerror'||x.type==='blocked-request'||x.type==='error'&&!(x.name==='installed-shadow-alert'&&x.text.includes('503'))),logs.filter(x=>x.type==='error'));
}catch(e){failure=String(e.stack||e)}finally{await browser?.close();await stop();for(const[n,s]of Object.entries(serverLogs))writeFileSync(join(O,n+'-server.log'),s);}
const after={source:hashes(R,sourceReport.sourceBefore),installed:hashes(C,installedReport.installedBefore)};checks.push({name:'All35source/build and53installed protected inputs unchanged',pass:JSON.stringify(before)===JSON.stringify(after)});
const report={at:new Date().toISOString(),proof:'NODETRACE-D3-INDEPENDENT-CAUSAL-AND-HOST-ALERT',ok:!failure&&checks.every(c=>c.pass),checks,cases,logs,failure,before,after,knockout:{path:scriptPath,originalSha256:sha(originalBundle),knockoutSha256:sha(knockoutBundle),originalExpression:old,replacementExpression:replacement,occurrences:1},limits:['No runtime/fixture/source/DB/env/index/ref edits or builds.','One browser-only exact compiled identity knockout; not a distributable product change.','The expected knockout missing-data result is preserved as a failure of registration, not labelled a working first inspection.','The two recovery requests are explicit local routed fixtures, not provider calls.']};writeFileSync(join(O,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,checks:checks.length,failure}));if(!report.ok)process.exitCode=1;
