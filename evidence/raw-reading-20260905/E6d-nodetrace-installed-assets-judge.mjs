import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync,existsSync,readdirSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawn,execFileSync} from 'node:child_process';
import {dirname,join,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {assertPortFree,waitForServer,waitForPaintedGraph} from 'file:///D:/VSCode%20Projects/cafecorner_nodebench/nodebench_ai4/NodeTrace/scripts/lib/proof-server.mjs';
const P=dirname(fileURLToPath(import.meta.url)),R='D:/VSCode Projects/cafecorner_nodebench/nodebench_ai4/NodeTrace',C='C:/Users/hshum/AppData/Local/Temp/nodetrace-next-e2e-lU78sE',O=join(P,'E6d-nodetrace-installed-assets-judge');
mkdirSync(O);const {chromium}=createRequire(join(R,'package.json'))('playwright');const sha=b=>createHash('sha256').update(b).digest('hex');
const fixture=readFileSync(join(P,'E6d-nodetrace-raw-before/short-state.json')),parsed=JSON.parse(fixture),normal=JSON.parse(readFileSync(join(C,'public/nodetrace-state.json')));
const attachments=[...new Set(parsed.coach.steps.flatMap(s=>[s.sourceView.imagePath,s.uiCapture.screenshotPath,s.mapCapture.imagePath,s.mapCapture.graphPath]))].sort();
const assetMap={};mkdirSync(join(O,'attachments'));
for(const ref of attachments){assert(!ref.includes('..')&&ref.startsWith('captures/'));const path=join(R,'public',ref),bytes=readFileSync(path),gitBytes=execFileSync('git',['--no-optional-locks','-C',R,'show',`04891604227ab607a61557f49f2cdb41b28dd338:public/${ref}`]);assert(bytes.equals(gitBytes));assetMap[ref]={bytes,sha256:sha(bytes),gitCommit:'04891604227ab607a61557f49f2cdb41b28dd338',source:`public/${ref}`,consumerHasFile:existsSync(join(C,'public',ref))};writeFileSync(join(O,'attachments',ref.split('/').at(-1)),bytes);}
writeFileSync(join(O,'attachment-manifest.json'),JSON.stringify(Object.fromEntries(Object.entries(assetMap).map(([p,{bytes,...r}])=>[p,{...r,bytes:bytes.length}])),null,2));
const protectedFiles=[];function visit(p){if(!existsSync(p))return;if(statSync(p).isDirectory())for(const c of readdirSync(p).sort())visit(join(p,c));else protectedFiles.push(p);}
for(const rel of ['src','app','public','package.json','package-lock.json','.next/static','.next/BUILD_ID'])visit(join(C,rel));
const hashes=()=>Object.fromEntries(protectedFiles.map(p=>[relative(C,p).replaceAll('\\','/'),sha(readFileSync(p))]));const before=hashes();
const port=4964,origin=`http://127.0.0.1:${port}`,cases=[],checks=[];let server,browser,activePage,failure,serverLog='';
const check=(name,pass,detail)=>{checks.push({name,pass:Boolean(pass),detail});assert(pass,name);};
const allowed=new Set(['path','systemroot','windir','comspec','pathext','programfiles','programfiles(x86)','programw6432','systemdrive','userprofile','appdata','localappdata','allusersprofile','homedrive','homepath','number_of_processors','processor_architecture','temp','tmp']);const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>allowed.has(k.toLowerCase())));
try{
 await assertPortFree(port);server=spawn(process.execPath,[join(C,'node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port',String(port)],{cwd:C,env,windowsHide:true,stdio:['ignore','pipe','pipe']});server.stdout.on('data',b=>serverLog=(serverLog+b).slice(-100000));server.stderr.on('data',b=>serverLog=(serverLog+b).slice(-100000));await waitForServer(origin+'/nodetrace');browser=await chromium.launch();
 for(const mode of ['normal-installed','fixture-state-only','fixture-with-exact-attachments']){
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'no-preference'}),page=activePage=await context.newPage(),logs=[],errors=[],responses=[],pending=[],fulfilled=[];
  page.setDefaultTimeout(10000);page.on('console',m=>logs.push({type:m.type(),text:m.text(),location:m.location()}));page.on('pageerror',e=>errors.push(String(e)));
  page.on('response',response=>pending.push((async()=>{const url=new URL(response.url()),row={url:response.url(),status:response.status(),type:response.request().resourceType()};if(response.request().resourceType()==='image'||url.pathname.endsWith('/nodetrace-state.json')){const bytes=await response.body();row.bodySha256=sha(bytes);}if(url.pathname.startsWith('/_next/static/')){const bytes=await response.body();row.diskExact=sha(bytes)===sha(readFileSync(join(C,'.next',url.pathname.slice('/_next/'.length))));}responses.push(row);})()));
  if(mode!=='normal-installed')await page.route('**/nodetrace-state.json',route=>route.fulfill({status:200,contentType:'application/json',body:fixture}));
  if(mode==='fixture-with-exact-attachments')for(const [ref,asset]of Object.entries(assetMap))await page.route(origin+'/'+ref,route=>{fulfilled.push({url:route.request().url(),sha256:asset.sha256});const contentType=ref.endsWith('.png')?'image/png':ref.endsWith('.svg')?'image/svg+xml':'application/json';return route.fulfill({status:200,contentType,body:asset.bytes});});
  await page.goto(origin+'/nodetrace');await waitForPaintedGraph(page);
  if(mode!=='normal-installed'){
   for(const index of [0,1]){if(index)await page.getByTestId('trace-record').nth(index).click();await page.getByRole('tab',{name:'Overview',exact:true}).click();await page.locator('img').evaluateAll(nodes=>Promise.all(nodes.map(n=>n.complete?Promise.resolve():new Promise(resolve=>{n.addEventListener('load',resolve,{once:true});n.addEventListener('error',resolve,{once:true});}))));}
  }
  const dom=await page.evaluate(()=>({url:location.href,images:[...document.images].map(n=>({src:n.src,complete:n.complete,naturalWidth:n.naturalWidth,naturalHeight:n.naturalHeight})),bodyText:document.body.innerText}));
  writeFileSync(join(O,mode+'.html'),await page.content());writeFileSync(join(O,mode+'.json'),JSON.stringify(dom,null,2));writeFileSync(join(O,mode+'.ax.txt'),await page.locator('body').ariaSnapshot());await page.screenshot({path:join(O,mode+'.png'),fullPage:true});await page.screenshot({path:join(O,mode+'-viewport.png')});
  if(mode!=='normal-installed'){await page.getByRole('tab',{name:'Raw JSON',exact:true}).click();const raw=await page.getByTestId('trace-raw').textContent();writeFileSync(join(O,mode+'.raw.txt'),raw);check(mode+' keeps current step payload',JSON.parse(raw).activeStep.id===parsed.coach.steps[1].id);}
  await Promise.all(pending);cases.push({mode,responses,logs,pageErrors:errors,images:dom.images,fulfilled});
  if(mode==='normal-installed')check('normal four-trace installed consumer has no missing resources or page failures',responses.every(r=>r.status<400)&&errors.length===0&&!logs.some(m=>m.type==='error'));
  if(mode==='fixture-state-only')check('state-only replay reproduces missing referenced captures',responses.some(r=>r.status===404&&new URL(r.url).pathname.startsWith('/captures/')));
  if(mode==='fixture-with-exact-attachments')check('complete exact-byte fixture has no404 or broken images',responses.every(r=>r.status<400)&&errors.length===0&&!logs.some(m=>m.type==='error')&&dom.images.every(n=>n.complete&&n.naturalWidth>0));
  check(mode+' served actual installed build',responses.some(r=>r.diskExact===true)&&responses.filter(r=>r.diskExact!==undefined).every(r=>r.diskExact));
  await context.close();
 }
}catch(e){failure=e.stack??String(e);if(activePage&&!activePage.isClosed())await activePage.screenshot({path:join(O,'failure.png')});}
finally{await browser?.close();server?.kill();await new Promise(r=>setTimeout(r,300));}
const after=hashes();check('consumer source package state and built assets unchanged',JSON.stringify(before)===JSON.stringify(after));
const report={proof:'NODETRACE-INSTALLED-FIXTURE-ATTACHMENT-CAUSAL-JUDGE-01',at:new Date().toISOString(),consumer:C,browser:browser?.version(),normalState:{traces:normal.traces.length,hasCoach:Boolean(normal.coach)},replayState:{traces:parsed.traces.length,coachSteps:parsed.coach.steps.length,sha256:sha(fixture)},attachmentCount:attachments.length,checks,cases,protectedInputs:before,afterInputs:after,failure,ok:!failure&&checks.every(c=>c.pass),limits:['One390px installed browser diagnosis with first two actual coach records','Complete attachment mode serves an explicit exact-Git-bound replay packet, not installed consumer files','No arbitrary404 filtering, placeholder image, product/consumer/build mutation']};
writeFileSync(join(O,'report.json'),JSON.stringify(report,null,2));writeFileSync(join(O,'server.log'),serverLog);console.log(JSON.stringify({ok:report.ok,checks:checks.length,caseErrors:cases.map(c=>({mode:c.mode,failures:c.responses.filter(r=>r.status>=400).map(r=>r.url)})),failure}));if(!report.ok)process.exitCode=1;
