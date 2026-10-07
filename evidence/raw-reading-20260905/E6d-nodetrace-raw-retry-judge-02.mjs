import assert from 'node:assert/strict';
import {isDeepStrictEqual} from 'node:util';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {spawn,execFileSync} from 'node:child_process';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {assertPortFree,waitForServer,waitForPaintedGraph} from 'file:///D:/VSCode%20Projects/cafecorner_nodebench/nodebench_ai4/NodeTrace/scripts/lib/proof-server.mjs';
const R='D:/VSCode Projects/cafecorner_nodebench/nodebench_ai4/NodeTrace',P=dirname(fileURLToPath(import.meta.url)),O=join(P,'E6d-nodetrace-raw-retry-judge-02');
mkdirSync(O);const {chromium}=createRequire(join(R,'package.json'))('playwright');
const sha=b=>createHash('sha256').update(b).digest('hex');
const files=['src/DemoDashboard.tsx','src/styles.css','src/demoState.ts','src/demoNavigation.ts','scripts/raw-reading-proof.mjs','public/nodetrace-state.json','dist/index.html'];
const hashes=()=>Object.fromEntries(files.map(p=>[p,sha(readFileSync(join(R,p)))]));
const git=(...args)=>execFileSync('git',['--no-optional-locks','-C',R,...args]).toString();
const before=hashes(),head=git('rev-parse','HEAD').trim(),index=sha(git('ls-files','--stage','-z'));
const fixture=readFileSync(join(P,'E6d-nodetrace-raw-before/actual-state.json'));
const port=4963,origin=`http://127.0.0.1:${port}`,requests=[],consoleLogs=[],pageErrors=[],responses=[],pending=[],checks=[];
const check=(name,pass,detail)=>{checks.push({name,pass:Boolean(pass),detail});assert(pass,name);};
const allowed=new Set(['path','systemroot','windir','comspec','pathext','programfiles','programfiles(x86)','programw6432','systemdrive','userprofile','appdata','localappdata','allusersprofile','homedrive','homepath','number_of_processors','processor_architecture','temp','tmp']);
const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>allowed.has(key.toLowerCase())));
let server,browser,page,failure,serverLog='';
async function capture(name){
 const data=await page.evaluate(()=>({url:location.href,alerts:[...document.querySelectorAll('[role="alert"]')].map(n=>n.textContent),buttons:[...document.querySelectorAll('button')].map(n=>({text:n.textContent,disabled:n.disabled})),raw:document.querySelector('[data-testid="trace-raw"]')?.textContent}));
 if(data.raw!==undefined){writeFileSync(join(O,name+'.raw.txt'),data.raw);data.rawSha256=sha(data.raw);delete data.raw;}
 writeFileSync(join(O,name+'.json'),JSON.stringify(data,null,2));writeFileSync(join(O,name+'.html'),await page.content());writeFileSync(join(O,name+'.ax.txt'),await page.locator('body').ariaSnapshot());
 await page.screenshot({path:join(O,name+'.png'),fullPage:true});await page.screenshot({path:join(O,name+'-viewport.png')});return data;
}
try{
 await assertPortFree(port);server=spawn(process.execPath,[join(R,'node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:R,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
 server.stdout.on('data',b=>serverLog=(serverLog+b).slice(-100000));server.stderr.on('data',b=>serverLog=(serverLog+b).slice(-100000));
 await waitForServer(origin);browser=await chromium.launch();page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'no-preference'});page.setDefaultTimeout(10000);
 page.on('console',m=>consoleLogs.push({type:m.type(),text:m.text(),location:m.location()}));page.on('pageerror',e=>pageErrors.push(String(e)));
 page.on('response',r=>{pending.push((async()=>{const url=new URL(r.url());if(url.pathname.startsWith('/assets/')){const bytes=await r.body();responses.push({url:r.url(),status:r.status(),sha256:sha(bytes),diskExact:sha(bytes)===sha(readFileSync(join(R,'dist',url.pathname.slice(1))))});}})());});
 await page.route('**/nodetrace-state.json',async route=>{const attempt=requests.length+1,status=attempt===1?503:200,body=attempt===1?Buffer.from('unavailable'):fixture;requests.push({attempt,url:route.request().url(),method:route.request().method(),status,bodySha256:sha(body)});await route.fulfill({status,contentType:attempt===1?'text/plain':'application/json',body});});
 await page.goto(origin);const retry=page.getByRole('button',{name:'Retry loading trace',exact:true});await retry.waitFor();
 check('actual HTTP503 produces honest visible error',await page.getByRole('alert').textContent().then(t=>t.includes('State request failed (HTTP 503).')));
 check('old exact Retry locator matches no button',await page.getByRole('button',{name:'Retry',exact:true}).count()===0);
 check('actual named Retry loading trace button is available',await retry.isVisible() && await retry.isEnabled());
 check('one failed request before explicit retry',requests.length===1 && requests[0].status===503);
 await capture('actual-error-before-retry');
 await retry.click();await page.getByRole('tab',{name:'Raw JSON',exact:true}).waitFor();await waitForPaintedGraph(page);await page.getByRole('tab',{name:'Raw JSON',exact:true}).click();
 const raw=page.getByRole('region',{name:'Raw trace JSON',exact:true});await raw.waitFor();
 check('one explicit retry returns actual second response',requests.length===2 && requests[1].status===200 && requests[1].bodySha256===sha(fixture));
 const payload=JSON.parse(await raw.textContent()),source=JSON.parse(fixture);
 check('recovered Raw contains current selected complete step',isDeepStrictEqual(payload.activeStep,source.coach.steps[0]));
 check('recovered full Raw bytes equal paired actual before fixture',sha(await raw.textContent())===sha(readFileSync(join(P,'E6d-nodetrace-raw-before/actual-390-no-preference.raw.txt'))));
 check('error and Retry control disappear on recovery',await page.getByRole('alert').count()===0 && await retry.count()===0);
 await capture('actual-recovered-raw');await Promise.all(pending);
 check('served assets match actual current build',responses.length>0 && responses.every(r=>r.diskExact));
 const errors=consoleLogs.filter(m=>m.type==='error');
 check('only expected HTTP503 browser error and no page crash',pageErrors.length===0 && errors.length===1 && errors[0].location.url===requests[0].url && /503/.test(errors[0].text),{errors,pageErrors});
}catch(e){failure=e.stack??String(e);if(page && !page.isClosed())await capture('diagnostic-failure');}
finally{await browser?.close();server?.kill();await new Promise(r=>setTimeout(r,300));}
const after=hashes();check('source build public HEAD and index inputs unchanged',JSON.stringify(before)===JSON.stringify(after)&&git('rev-parse','HEAD').trim()===head&&sha(git('ls-files','--stage','-z'))===index);
const report={proof:'NODETRACE-RAW-RETRY-CAUSAL-JUDGE-01',at:new Date().toISOString(),head,index,sourceHashes:before,afterHashes:after,browser:browser?.version(),viewport:{width:390,height:844},requests,checks,consoleLogs,pageErrors,responses,failure,ok:!failure&&checks.every(c=>c.pass),limits:['One actual built local source UI error/recovery case','Routed first HTTP503 then exact retained current fixture; no production/provider call','No product, proof harness, build, fixture, index or ref edits']};
writeFileSync(join(O,'server.log'),serverLog);writeFileSync(join(O,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,checks:checks.length,requests:requests.length,failure}));if(!report.ok)process.exitCode=1;
