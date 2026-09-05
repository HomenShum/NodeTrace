import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {assertPortFree,waitForServer,waitForPaintedGraph} from 'file:///D:/VSCode%20Projects/cafecorner_nodebench/nodebench_ai4/NodeTrace/scripts/lib/proof-server.mjs';
const N='D:/VSCode Projects/cafecorner_nodebench/nodebench_ai4/NodeTrace';
const P='C:/Users/hshum/.codex/worktrees/5dba/nodebench-ai/docs/plans/portfolio-recovery-20260904';
const O=join(P,'E6d-nodetrace-raw-final-judge-layout');mkdirSync(O);
const {chromium}=createRequire(join(N,'package.json'))('playwright');
const sha=b=>createHash('sha256').update(b).digest('hex');
const selectors=['.showcase','.coachList','.r-tracevu-detail-head','.liveGraphRailHead','.liveGraphRailControls','[data-testid="live-graph-node-events"]'];
const checks=[],cells=[],logs=[];const check=(name,pass,detail)=>{checks.push({name,pass:Boolean(pass),detail});assert(pass,name)};
const fixture=readFileSync(join(P,'E6d-nodetrace-raw-before/actual-state.json'));
const sourceFiles=['src/DemoDashboard.tsx','src/styles.css','scripts/raw-reading-proof.mjs','public/nodetrace-state.json'];
const hashes=()=>Object.fromEntries(sourceFiles.map(f=>[f,sha(readFileSync(join(N,f)))]));const beforeHashes=hashes();
const allowed=new Set(['path','systemroot','windir','comspec','pathext','programfiles','programfiles(x86)','programw6432','systemdrive','userprofile','appdata','localappdata','allusersprofile','homedrive','homepath','number_of_processors','processor_architecture','temp','tmp']);
const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>allowed.has(k.toLowerCase())));
let browser,server,failure,active;
async function metrics(page){return page.evaluate(selectors=>{
 const measure=n=>{const r=n.getBoundingClientRect(),s=getComputedStyle(n);return {x:r.x,y:r.y+scrollY,width:r.width,height:r.height,scrollTop:n.scrollTop,scrollHeight:n.scrollHeight,clientHeight:n.clientHeight,font:s.font,display:s.display,position:s.position,grid:s.gridTemplateColumns,overflow:s.overflow,lineHeight:s.lineHeight}};
 const raw=document.querySelector('[data-testid="trace-raw"]'),graph=document.querySelector('[data-testid="live-graph-rail"]'),card=document.querySelector('.coachPanel'),list=document.querySelector('.coachList');
 return {viewport:{width:innerWidth,height:innerHeight},scroll:{x:scrollX,y:scrollY},documentHeight:document.documentElement.scrollHeight,raw:measure(raw),graph:measure(graph),card:measure(card),list:measure(list),lastRecord:measure(list.lastElementChild),header:measure(document.querySelector('.showcase')),protected:Object.fromEntries(selectors.map(s=>[s,{html:document.querySelector(s).outerHTML,box:measure(document.querySelector(s))}])),rawText:raw.textContent};
},selectors)}
async function save(page,name,m){const data={...m,rawText:undefined,rawSha256:sha(m.rawText)};writeFileSync(join(O,name+'.json'),JSON.stringify(data,null,2));writeFileSync(join(O,name+'.html'),await page.content());await page.screenshot({path:join(O,name+'.png'),fullPage:true});return data}
try{
 await assertPortFree(4971);server=spawn(process.execPath,[join(N,'node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port','4971','--strictPort'],{cwd:N,env,windowsHide:true,stdio:['ignore','pipe','pipe']});let serverLog='';server.stdout.on('data',b=>{serverLog=(serverLog+b).slice(-50000)});server.stderr.on('data',b=>{serverLog=(serverLog+b).slice(-50000)});
 await waitForServer('http://127.0.0.1:4971');browser=await chromium.launch();
 for(const [width,height]of [[390,844],[1024,768],[1440,960]]){
 const context=await browser.newContext({viewport:{width,height}});const page=active=await context.newPage();page.setDefaultTimeout(10000);
 page.on('pageerror',e=>logs.push({width,error:String(e)}));await page.route('**/nodetrace-state.json',r=>r.fulfill({status:200,contentType:'application/json',body:fixture}));
 await page.goto('http://127.0.0.1:4971/?unrelated=preserved#review');
 await page.getByRole('tab',{name:'Raw JSON',exact:true}).waitFor();await waitForPaintedGraph(page);
 await page.getByRole('combobox',{name:'Entity',exact:true}).selectOption({index:1});await page.getByRole('tab',{name:'Raw JSON',exact:true}).click();
 await page.getByTestId('trace-raw').focus();await page.evaluate(()=>document.fonts.ready);
 const historical=JSON.parse(readFileSync(join(P,'E6d-nodetrace-raw-before',`${width===390?'actual-390':width===1024?'actual-1024':'actual-1440'}-no-preference.json`),'utf8'));
 const originalHTML=readFileSync(join(P,'E6d-nodetrace-raw-before',`actual-${width}-no-preference.html`),'utf8');
 const dom=await page.evaluate(({html,selectors})=>{const d=new DOMParser().parseFromString(html,'text/html');return Object.fromEntries(selectors.map(s=>[s,d.querySelector(s).outerHTML]))},{html:originalHTML,selectors});
 const initial=await metrics(page);await save(page,`${width}-current-initial`,initial);const postCapture=await metrics(page);
 cells.push({width,historical,current:initial,postCapture});
 check(width+': full historical JSON exact',sha(initial.rawText)===historical.rawSha256);
 for(const s of selectors)check(width+': historical protected DOM exact '+s,dom[s]===initial.protected[s].html);
 check(width+': Raw horizontal geometry preserved',initial.raw.x===historical.raw.x&&initial.raw.width===historical.raw.width);
 check(width+': graph dimensions and data preserved',initial.graph.width===historical.graph.width&&initial.graph.height===historical.graph.height);
 check(width+': current graph follows card with original gap',Math.abs(initial.graph.y-initial.card.y-initial.card.height-18)<1,{gap:initial.graph.y-initial.card.y-initial.card.height});
 // Diagnostic counterfactual: only restore the former Raw sizing in this page.
 const knock=await page.addStyleTag({content:'.r-tracevu-raw { min-height:560px !important; max-height:none !important; overflow-y:visible !important; }'});
 const old=await metrics(page);await save(page,`${width}-counterfactual-former-sizing`,old);cells.at(-1).counterfactual=old;
 check(width+': removing ceiling reproduces original excessive height',old.raw.height>Math.min(560,height*.65)+2 && old.graph.y>initial.graph.y+1000);
 check(width+': exact recorded before geometry reproduced',old.raw.height===historical.raw.height&&old.raw.y===historical.raw.documentY&&old.graph.y===historical.graph.documentY,{oldRaw:old.raw,oldGraph:old.graph,recorded:historical});
 for(const s of selectors)check(width+': sizing knockout protected DOM unchanged '+s,old.protected[s].html===initial.protected[s].html);
 await knock.evaluate(n=>n.remove());const restored=await metrics(page);cells.at(-1).restored=restored;
 check(width+': remove counterfactual restores actual layout exactly',JSON.stringify(restored)===JSON.stringify(postCapture));
 if(width===1024)check('desktop minimum follows unchanged sidebar content',initial.raw.y+initial.raw.height<initial.lastRecord.y+initial.lastRecord.height && initial.lastRecord.y+initial.lastRecord.height<initial.card.y+initial.card.height,{rawEnd:initial.raw.y+initial.raw.height,listLastEnd:initial.lastRecord.y+initial.lastRecord.height,cardEnd:initial.card.y+initial.card.height});
 await context.close();
 }
 check('no page exceptions',logs.length===0,logs);writeFileSync(join(O,'server.log'),serverLog);
}catch(e){failure=e.stack;console.error(failure);if(active&&!active.isClosed()){writeFileSync(join(O,'failure.html'),await active.content());await active.screenshot({path:join(O,'failure.png'),fullPage:true})}}
finally{await browser?.close();server?.kill()}
const afterHashes=hashes();checks.push({name:'source/public bytes remain frozen',pass:JSON.stringify(beforeHashes)===JSON.stringify(afterHashes)});
writeFileSync(join(O,'report.json'),JSON.stringify({at:new Date().toISOString(),scope:'Independent native layout / protected DOM / historical geometry and counterfactual former CSS sizing; routed exact recorded fixture, not new backend output.',checks,cells,logs,beforeHashes,afterHashes,failure,ok:!failure&&checks.every(c=>c.pass)},null,2));
console.log(JSON.stringify({ok:!failure&&checks.every(c=>c.pass),checks:checks.length,failure}));if(failure)process.exitCode=1;

