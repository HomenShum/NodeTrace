import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
const packet=dirname(fileURLToPath(import.meta.url)),out=join(packet,'E6d-nodetrace-raw-before-text200');mkdirSync(out);
const primary='D:/VSCode Projects/cafecorner_nodebench/nodebench_ai4/NodeTrace',port=4959,origin=`http://127.0.0.1:${port}`;
const {chromium}=createRequire(join(primary,'package.json'))('playwright');
const {assertPortFree,waitForServer,waitForPaintedGraph}=await import(pathToFileURL(join(primary,'scripts/lib/proof-server.mjs')));
const sha=b=>createHash('sha256').update(b).digest('hex');
const git=(...args)=>{const r=spawnSync('git',['--no-optional-locks','-C',primary,...args],{encoding:'utf8',windowsHide:true});if(r.status)throw Error(r.stderr);return r.stdout.trim()};
const source=JSON.parse(readFileSync(join(packet,'E6c_NODETRACE_ENTITY_FINAL_JUDGE.json'),'utf8')).sourceHashes;
const walk=(dir)=>readdirSync(join(primary,dir),{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(dir,e.name)):[join(dir,e.name).replaceAll('\\','/')]);
const names=[...new Set([...Object.keys(source),'public/nodetrace-state.json',...walk('dist')])];
const hashes=()=>Object.fromEntries(names.map(n=>[n,sha(readFileSync(join(primary,n)))]));
const before={at:new Date().toISOString(),head:git('rev-parse','HEAD'),indexSha256:sha(spawnSync('git',['--no-optional-locks','-C',primary,'ls-files','--stage','-z']).stdout),files:hashes()};
writeFileSync(join(out,'source-before.json'),JSON.stringify(before,null,2));
if(!Object.entries(source).every(([n,h])=>before.files[n]===h))throw Error('Current runtime differs from approved source');
const actualBytes=readFileSync(join(packet,'E6c-nodetrace-entity-canonical-source/trace-coach-sqlite-input.json'));
const actual=JSON.parse(actualBytes),short=structuredClone(actual),long=structuredClone(actual);
short.coach.steps[0].codeBlock.snippet='export const trace = "short reference";';
short.coach.graphNodes=short.coach.graphNodes.slice(0,1);short.coach.graphEdges=[];
long.coach.steps[0].codeBlock.snippet=Array.from({length:180},(_,i)=>`// raw-note-${String(i).padStart(3,'0')}: preserve JSON text 供应商🙂 ${'long-description-'.repeat(5)}`).join('\n');
const fixtures={actual:actualBytes,short:Buffer.from(JSON.stringify(short)),long:Buffer.from(JSON.stringify(long))};
for(const [n,b]of Object.entries(fixtures))writeFileSync(join(out,`${n}-state.json`),b);
const checks=[],cells=[],logs=[],responses=[];const check=(name,pass,detail)=>{checks.push({name,pass:!!pass,detail});if(!pass)throw Error(name)};
let server,browser,serverLog='',failure;
const allowed=new Set(['path','systemroot','windir','comspec','pathext','programfiles','programfiles(x86)','programw6432','systemdrive','userprofile','appdata','localappdata','allusersprofile','homedrive','homepath','number_of_processors','processor_architecture','temp','tmp']);
const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>allowed.has(k.toLowerCase())));
async function capture(page,name){
 const meta=await page.evaluate(()=>{const raw=document.querySelector('[data-testid="trace-raw"]'),r=raw.getBoundingClientRect(),graph=document.querySelector('[data-testid="live-graph-rail"]').getBoundingClientRect(),style=getComputedStyle(raw);return{url:location.href,viewport:{width:innerWidth,height:innerHeight},scroll:{x:scrollX,y:scrollY},documentHeight:document.documentElement.scrollHeight,overflow:document.documentElement.scrollWidth-innerWidth,raw:{x:r.x,y:r.y,width:r.width,height:r.height,documentY:r.y+scrollY,clientHeight:raw.clientHeight,scrollHeight:raw.scrollHeight,tabIndex:raw.tabIndex,overflowY:style.overflowY,fontSize:style.fontSize,lineHeight:style.lineHeight},graph:{x:graph.x,y:graph.y,width:graph.width,height:graph.height,documentY:graph.y+scrollY},activeTab:document.querySelector('[role="tab"][aria-selected="true"]')?.textContent,selectedEntity:document.querySelector('.liveGraphRailControls select')?.value,readout:document.querySelector('[data-testid="live-graph-node-events"]')?.textContent,rawText:raw.textContent}});
 writeFileSync(join(out,name+'.raw.txt'),meta.rawText);meta.rawSha256=sha(meta.rawText);delete meta.rawText;
 writeFileSync(join(out,name+'.json'),JSON.stringify(meta,null,2));writeFileSync(join(out,name+'.html'),await page.content());writeFileSync(join(out,name+'.ax.txt'),await page.locator('body').ariaSnapshot());
 await page.screenshot({path:join(out,name+'.png')});
 await page.evaluate(()=>{const n=document.querySelector('[data-testid="trace-raw"]'),r=n.getBoundingClientRect(),box=document.createElement('div');box.dataset.rawProofBoundary='true';Object.assign(box.style,{position:'absolute',left:(r.left+scrollX)+'px',top:(r.top+scrollY)+'px',width:r.width+'px',height:r.height+'px',boxSizing:'border-box',border:'3px solid #940088',pointerEvents:'none',zIndex:'2147483647'});const label=document.createElement('span');label.textContent='CHANGE A · Raw JSON reading region only';Object.assign(label.style,{position:'absolute',left:'0',top:'0',font:'bold 12px system-ui',background:'#710065',color:'white',maxWidth:'100%'});box.append(label);document.body.append(box)});
 await page.screenshot({path:join(out,name+'-change-boundary.png')});await page.screenshot({path:join(out,name+'-change-boundary-full.png'),fullPage:true});
 await page.evaluate(()=>document.querySelectorAll('[data-raw-proof-boundary]').forEach(n=>n.remove()));
 return meta;
}
try{
 await assertPortFree(port);
 server=spawn(process.execPath,[join(primary,'node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:primary,env,windowsHide:true,stdio:['ignore','pipe','pipe']});server.stdout.on('data',b=>serverLog=(serverLog+b).slice(-100000));server.stderr.on('data',b=>serverLog=(serverLog+b).slice(-100000));
 await waitForServer(origin);browser=await chromium.launch({headless:true});
 const cases=[['actual',390,844,'no-preference'],['actual',1024,768,'reduce']];
 for(const [fixture,width,height,motion]of cases){
  const context=await browser.newContext({viewport:{width,height},reducedMotion:motion});const page=await context.newPage(),name=`${fixture}-${width}-${motion}`;
  page.on('console',m=>logs.push({cell:name,type:m.type(),text:m.text()}));page.on('pageerror',e=>logs.push({cell:name,type:'pageerror',text:String(e)}));
  const pending=[];page.on('response',r=>{const u=new URL(r.url());if(u.pathname.startsWith('/assets/'))pending.push((async()=>{const b=await r.body(),path=join(primary,'dist',u.pathname.slice(1));responses.push({cell:name,url:r.url(),status:r.status(),sha256:sha(b),diskExact:sha(b)===sha(readFileSync(path))})})())});
  await page.route('**/nodetrace-state.json',r=>r.fulfill({status:200,contentType:'application/json',body:fixtures[fixture]}));
  await page.goto(origin+'/?unrelated=preserved#review');await page.getByRole('tab',{name:'Raw JSON',exact:true}).waitFor();await waitForPaintedGraph(page);
  const select=page.getByRole('combobox',{name:'Entity',exact:true});await select.selectOption({index:1});const selected=await select.inputValue(),readout=await page.getByTestId('live-graph-node-events').textContent();
  const rawTab=page.getByRole('tab',{name:'Raw JSON',exact:true});await rawTab.focus();await page.keyboard.press('Enter');await page.getByTestId('trace-raw').waitFor();
  await page.getByTestId('trace-raw').evaluate(n=>{n.style.fontSize='22px';n.style.lineHeight='33px'}); const meta=await capture(page,name); check(name+' actual raw text is 200 percent of frozen 11px base',meta.raw.fontSize==='22px');check(name+' Raw tab actually selected',meta.activeTab==='Raw JSON');check(name+' fixture creates valid complete JSON',JSON.parse(await page.getByTestId('trace-raw').textContent()).activeStep.codeBlock.snippet===JSON.parse(fixtures[fixture]).coach.steps[0].codeBlock.snippet);check(name+' current selection survives tab switch',meta.selectedEntity===selected&&meta.readout===readout);check(name+' no document overflow',meta.overflow<=1);check(name+' host query/hash retained',new URL(meta.url).searchParams.get('unrelated')==='preserved'&&new URL(meta.url).hash==='#review');
  const rawHash=meta.rawSha256;await page.reload();await page.getByTestId('trace-raw').waitFor();check(name+' Raw selection and payload survive reload',sha(await page.getByTestId('trace-raw').textContent())===rawHash);
  await page.getByRole('tab',{name:'Overview',exact:true}).click();await page.goBack();await page.getByTestId('trace-raw').waitFor();check(name+' Back returns Raw and all payload bytes',sha(await page.getByTestId('trace-raw').textContent())===rawHash);
  await page.getByRole('tab',{name:'Raw JSON',exact:true}).focus();const focus=[];for(let i=0;i<7;i++){await page.keyboard.press('Tab');focus.push(await page.evaluate(()=>({tag:document.activeElement.tagName,testid:document.activeElement.getAttribute('data-testid'),text:document.activeElement.textContent?.slice(0,80)})))}
  cells.push({name,fixtureSha256:sha(fixtures[fixture]),fixtureBytes:fixtures[fixture].length,motion,metadata:meta,focusAfterRaw:focus,keyboardRawFocusObserved:focus.some(x=>x.testid==='trace-raw')});await Promise.all(pending);await context.close();
 }
 check('served built assets equal current exact disk bytes',responses.length>0&&responses.every(r=>r.status===200&&r.diskExact));
 check('no page or console errors',!logs.some(l=>['error','pageerror'].includes(l.type)));
}catch(e){failure=String(e.stack||e)}finally{await browser?.close();if(server){server.kill();await new Promise(r=>setTimeout(r,300));}writeFileSync(join(out,'server.log'),serverLog)}
const after={at:new Date().toISOString(),head:git('rev-parse','HEAD'),indexSha256:sha(spawnSync('git',['--no-optional-locks','-C',primary,'ls-files','--stage','-z']).stdout),files:hashes()};writeFileSync(join(out,'source-after.json'),JSON.stringify(after,null,2));
const report={proof:'NODETRACE-RAW-READING-REGION-BEFORE-01',at:new Date().toISOString(),referenceCommit:'4d6c55841d2ffa3fe27a9b33c17eff9dd6814695',sourceHashes:source,browserVersion:browser?.version(),port,cells,checks,logs,responses,failure,sourceBuildAndPublicUnchanged:JSON.stringify(before.files)===JSON.stringify(after.files),headBefore:before.head,headAfter:after.head,indexUnchanged:before.indexSha256===after.indexSha256,rootMayIndependentlyCommitCIOnly:true,fixtures:{actual:'Exact final source proof input bytes',short:'Only selected code snippet and coach graph reduced; trace graph remains actual',long:'Only selected code snippet replaced with180 declared Unicode/comment lines; well below input cap'},noAppEdits:true,no4173:true,serverStopped:true,scope:'Before evidence and boundary, not a passing Raw reading-region repair or full criterion grade.',actual200PercentTextOrZoom:'RAW_COMPONENT_TEXT_200_PERCENT: only actual rendered pre text explicitly enlarged from11px to22px, lineheight16.5px to33px; not browser zoom or whole-document text-resize certification.'};
report.ok=!failure&&cells.length===2&&checks.every(x=>x.pass)&&report.sourceBuildAndPublicUnchanged;
writeFileSync(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,cells:cells.length,checks:checks.length,failure,sourceBuildAndPublicUnchanged:report.sourceBuildAndPublicUnchanged}));if(!report.ok)process.exitCode=1;
