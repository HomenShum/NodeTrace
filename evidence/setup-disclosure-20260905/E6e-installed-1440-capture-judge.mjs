import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
const P=dirname(fileURLToPath(import.meta.url)),R='D:/VSCode Projects/cafecorner_nodebench/nodebench_ai4/NodeTrace',C='C:/Users/hshum/AppData/Local/Temp/nodetrace-next-e2e-AxCJ0v',O=join(P,'E6e-nodetrace-disclosure-final-judge/installed-1440-capture');mkdirSync(O);
const sha=b=>createHash('sha256').update(b).digest('hex'),json=p=>JSON.parse(readFileSync(p,'utf8'));
const prior=json(join(P,'E6e-nodetrace-disclosure-installed-final/report.json'));const hashes=(r,m)=>Object.fromEntries(Object.keys(m).map(p=>[p,sha(readFileSync(join(r,p)))]));
const before={source:hashes(R,prior.sourceBefore),installed:hashes(C,prior.installedBefore)};assert.deepEqual(before.source,prior.sourceBefore);assert.deepEqual(before.installed,prior.installedBefore);
const {chromium}=createRequire(join(R,'package.json'))('playwright');const{assertPortFree,waitForServer,waitForPaintedGraph}=await import(pathToFileURL(join(R,'scripts/lib/proof-server.mjs')));
const allowed=new Set(['path','systemroot','windir','comspec','pathext','programfiles','programfiles(x86)','programw6432','systemdrive','userprofile','appdata','localappdata','allusersprofile','homedrive','homepath','number_of_processors','processor_architecture','temp','tmp']);const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>allowed.has(k.toLowerCase())));
let browser,server,failure,serverLog='';const checks=[],responses=[],logs=[];const check=(n,p,d)=>{checks.push({name:n,pass:!!p,detail:d});assert(p,n)};
async function frame(page,label){const result=await page.evaluate(()=>{const b=document.querySelector('[data-testid="nodegraph-canvas"]'),r=b.getBoundingClientRect(),cs=b.matches('canvas')?[b]:[...b.querySelectorAll('canvas')];return {url:location.href,scrollY,width:innerWidth,height:innerHeight,graphBox:{x:r.x,y:r.y,width:r.width,height:r.height},bodyHTML:document.body.outerHTML,canvases:cs.map((c,i)=>{const r=c.getBoundingClientRect();return{index:i,className:c.className,width:c.width,height:c.height,rect:{x:r.x,y:r.y,width:r.width,height:r.height},png:c.toDataURL('image/png')}})}});result.bodySha256=sha(result.bodyHTML);delete result.bodyHTML;for(const c of result.canvases){const bytes=Buffer.from(c.png.split(',')[1],'base64');delete c.png;c.sha256=sha(bytes);c.file=label+'-canvas-'+c.index+'.png';writeFileSync(join(O,c.file),bytes)}return result;}
try{
 await assertPortFree(4966);server=spawn(process.execPath,[join(C,'node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port','4966'],{cwd:C,env,windowsHide:true,stdio:['ignore','pipe','pipe']});for(const s of[server.stdout,server.stderr])s.on('data',b=>serverLog=(serverLog+b).slice(-100000));await waitForServer('http://127.0.0.1:4966/nodetrace');
 browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1440,height:960}}),tasks=[];
 page.on('pageerror',e=>logs.push({type:'pageerror',text:String(e)}));page.on('console',m=>{if(m.type()==='error')logs.push({type:'error',text:m.text()})});
 await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin!=='http://127.0.0.1:4966'||r.request().method()!=='GET'){logs.push({type:'blocked-request',url:u.href});return r.abort()}return r.continue()});
 page.on('response',r=>tasks.push((async()=>{const u=new URL(r.url());if(u.pathname.endsWith('/nodetrace-state.json')||u.pathname.startsWith('/_next/static/')){const b=await r.body(),p=join(C,u.pathname.startsWith('/_next/')?u.pathname.replace('/_next/','.next/'):'public/nodetrace-state.json');responses.push({path:u.pathname,sha256:sha(b),exact:sha(b)===sha(readFileSync(p))})}})()));
 await page.goto('http://127.0.0.1:4966/nodetrace?disclosureProof=preserved#review');await page.waitForFunction(()=>document.querySelector('.showcaseCopy > .inspectTrace')?.disabled===false);
 const paint=await waitForPaintedGraph(page,{attempts:1});
 await page.evaluate(async()=>{await document.fonts.ready;scrollTo(0,0);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))});
 const pre=await frame(page,'before-viewport');const png=await page.screenshot({path:join(O,'installed-1440-current-viewport.png'),fullPage:false});const post=await frame(page,'after-viewport');
 writeFileSync(join(O,'current-frame-readback.json'),JSON.stringify({paint,pre,post,viewportPngSha256:sha(png)},null,2));writeFileSync(join(O,'installed-1440-current-viewport.html'),await page.content());
 check('Exact actual state and built assets served',responses.length>1&&responses.every(r=>r.exact),responses);
 check('Current frame canvas readbacks exist',pre.canvases.length>0&&post.canvases.length===pre.canvases.length);
 check('Viewport screenshot preserves DOM URL scroll and canvas geometry',pre.bodySha256===post.bodySha256&&pre.url===post.url&&pre.scrollY===post.scrollY&&JSON.stringify(pre.graphBox)===JSON.stringify(post.graphBox),{pre,post});
 check('Native setup remains collapsed at exact1440 viewport',await page.locator('.traceSetup').evaluate(n=>!n.open)&&pre.width===1440&&pre.height===960&&pre.scrollY===0);
 check('No page errors unexpected traffic or console errors',logs.length===0,logs);await Promise.all(tasks);
}catch(e){failure=String(e.stack||e)}finally{await browser?.close();server?.kill();writeFileSync(join(O,'server.log'),serverLog)}
const after={source:hashes(R,prior.sourceBefore),installed:hashes(C,prior.installedBefore)};checks.push({name:'All source build and installed inputs unchanged',pass:JSON.stringify(before)===JSON.stringify(after)});
const report={proof:'NODETRACE-D3-ONE-INSTALLED-1440-CAPTURE',at:new Date().toISOString(),ok:!failure&&checks.every(c=>c.pass),checks,responses,logs,failure,before,after,limits:['Exactly one fresh viewport; no app/data replacement, layout change or full-page screenshot.','Original blank visible-graph viewport is retained. This probe cannot establish its historical browser cause.','Same-frame readback and screenshot pixels must be inspected independently; DOM success alone does not prove graph pixels.']};writeFileSync(join(O,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,checks:checks.length,failure}));if(!report.ok)process.exitCode=1;
