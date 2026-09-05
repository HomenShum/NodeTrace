import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';

const P=dirname(fileURLToPath(import.meta.url));
const R='D:/VSCode Projects/cafecorner_nodebench/nodebench_ai4/NodeTrace';
const C='C:/Users/hshum/AppData/Local/Temp/nodetrace-next-e2e-lU78sE';
const O=join(P,'E6e-nodetrace-disclosure-before');mkdirSync(O);
const sha=b=>createHash('sha256').update(b).digest('hex');
const json=p=>JSON.parse(readFileSync(p,'utf8'));
const {chromium}=createRequire(join(R,'package.json'))('playwright');
const {assertPortFree,waitForServer,waitForPaintedGraph}=await import(pathToFileURL(join(R,'scripts/lib/proof-server.mjs')));
const git=(...args)=>{const r=spawnSync('git',['--no-optional-locks','-C',R,...args],{windowsHide:true});assert.equal(r.status,0,String(r.stderr));return r.stdout;};
const snap=()=>({head:String(git('rev-parse','HEAD')).trim(),tree:String(git('rev-parse','HEAD^{tree}')).trim(),index:sha(git('ls-files','--stage','-z')),refs:sha(git('for-each-ref','--format=%(refname) %(objectname)')),status:String(git('status','--porcelain=v1','-z'))});
const sourcePrior=json(join(P,'E6d-nodetrace-raw-final-judge/source-actual-390-no-preference/report.json'));
const installedPrior=json(join(P,'E6d-nodetrace-raw-final-judge/installed-short-390-no-preference/report.json'));
const walk=(root,dir)=>readdirSync(join(root,dir),{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(root,join(dir,e.name)):[join(dir,e.name).replaceAll('\\','/')]);
const sourcePaths=[...new Set([...Object.keys(sourcePrior.sourceHashes),...walk(R,'dist')])];
const hashes=(root,paths)=>Object.fromEntries(paths.map(p=>[p,sha(readFileSync(join(root,p)))]));
const before={git:snap(),source:hashes(R,sourcePaths),installed:hashes(C,Object.keys(installedPrior.installedBefore))};
writeFileSync(join(O,'custody-before.json'),JSON.stringify(before,null,2));
assert.equal(before.git.head,'594c988881d17b759ff6455539dc3b293e1a4ee5');assert.equal(before.git.status,'');
for(const [p,h]of Object.entries(sourcePrior.sourceHashes))assert.equal(before.source[p],h,`Source approved binding ${p}`);
for(const [p,h]of Object.entries(installedPrior.installedBefore))assert.equal(before.installed[p],h,`Installed approved binding ${p}`);
for(const r of sourcePrior.responses){const p='dist'+new URL(r.url).pathname;assert.equal(before.source[p],r.sha256,`Previously judged built asset ${p}`);}
const approvedFixture={source:readFileSync(join(R,'dist/nodetrace-state.json')),installed:readFileSync(join(C,'public/nodetrace-state.json'))};
for(const [s,b]of Object.entries(approvedFixture))writeFileSync(join(O,s+'-actual-input.json'),b);
const checks=[],cells=[],responses=[],logs=[],servers=[],serverLogs={};
const check=(name,pass,detail)=>{checks.push({name,pass:!!pass,detail});assert(pass,name);};
const allowed=new Set(['path','systemroot','windir','comspec','pathext','programfiles','programfiles(x86)','programw6432','systemdrive','userprofile','appdata','localappdata','allusersprofile','homedrive','homepath','number_of_processors','processor_architecture','temp','tmp']);
const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>allowed.has(k.toLowerCase())));
async function geometry(page){return page.evaluate(()=>{
 const rect=n=>{if(!n)return null;const r=n.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,documentY:r.y+scrollY}};
 const selectors=['.showcase','.showcaseCopy','.showcaseCopy h1','.showcaseCopy [role="status"]','.showcaseCopy > .inspectTrace','.showcaseActions','.launchCard','.coachPanel','.coachList','.coachDetail','.coachEmpty','.liveGraphRail'];
 return {url:location.href,viewport:{width:innerWidth,height:innerHeight},scroll:{x:scrollX,y:scrollY},document:{width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight},active:{tag:document.activeElement.tagName,text:document.activeElement.textContent?.slice(0,120)},regions:Object.fromEntries(selectors.map(s=>{const n=document.querySelector(s);return[s,{rect:rect(n),text:n?.textContent,html:n?.outerHTML}]})),buttons:[...document.querySelectorAll('button')].map(n=>({text:n.textContent,rect:rect(n),disabled:n.disabled})),bodyText:document.body.innerText};
});}
async function capture(page,name,{boundary=false}={}){
 await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));});
 const pre=await geometry(page);const html=await page.content();
 writeFileSync(join(O,name+'.html'),html);writeFileSync(join(O,name+'.ax.txt'),await page.locator('body').ariaSnapshot());
 await page.screenshot({path:join(O,name+'.png'),fullPage:false});
 const immediate=await geometry(page);check(name+' viewport capture preserves region geometry',JSON.stringify(pre.regions)===JSON.stringify(immediate.regions));
 if(boundary){
  const beforeBody=await page.locator('body').evaluate(n=>n.outerHTML);
  await page.evaluate(()=>{const n=document.querySelector('.showcase'),r=n.getBoundingClientRect(),box=document.createElement('div');box.dataset.disclosureBoundary='true';Object.assign(box.style,{position:'absolute',left:(r.x+scrollX)+'px',top:(r.y+scrollY)+'px',width:r.width+'px',height:r.height+'px',boxSizing:'border-box',border:'3px solid #940088',pointerEvents:'none',zIndex:'2147483647'});const label=document.createElement('span');label.textContent='CHANGE A · Setup disclosure owner';Object.assign(label.style,{position:'absolute',left:'0',top:'0',maxWidth:'100%',background:'#710065',color:'#fff',font:'700 12px/1.3 system-ui',padding:'3px'});box.append(label);document.body.append(box);});
  await page.screenshot({path:join(O,name+'-change-boundary.png'),fullPage:false});
  await page.evaluate(()=>document.querySelectorAll('[data-disclosure-boundary]').forEach(n=>n.remove()));
  check(name+' temporary boundary removed with exact original DOM',await page.locator('body').evaluate(n=>n.outerHTML)===beforeBody);
 }
 writeFileSync(join(O,name+'.json'),JSON.stringify(pre,null,2));return pre;
}
let browser,failure;
try{
 for(const [surface,root,port,args]of [['source',R,4965,[join(R,'node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port','4965','--strictPort']],['installed',C,4966,[join(C,'node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port','4966']]]){
  await assertPortFree(port);serverLogs[surface]='';const child=spawn(process.execPath,args,{cwd:root,env,windowsHide:true,stdio:['ignore','pipe','pipe']});servers.push(child);for(const s of [child.stdout,child.stderr])s.on('data',b=>serverLogs[surface]=(serverLogs[surface]+b).slice(-100000));await waitForServer(`http://127.0.0.1:${port}`);
 }
 browser=await chromium.launch({headless:true});
 for(const surface of ['source','installed'])for(const [width,height]of [[320,800],[390,844],[1440,960]]){
  const name=`${surface}-${width}`,port=surface==='source'?4965:4966,route=surface==='source'?'/':'/nodetrace';
  const context=await browser.newContext({viewport:{width,height},reducedMotion:'no-preference'}),page=await context.newPage(),pending=[];let stateBytes;
  page.on('console',m=>logs.push({cell:name,type:m.type(),text:m.text()}));page.on('pageerror',e=>logs.push({cell:name,type:'pageerror',text:String(e)}));
  await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname!=='127.0.0.1'||u.port!==String(port)||r.request().method()!=='GET'){logs.push({cell:name,type:'blocked-unexpected-request',url:u.href,method:r.request().method()});return r.abort();}return r.continue();});
  page.on('response',r=>{pending.push((async()=>{const u=new URL(r.url());if(u.pathname.endsWith('/nodetrace-state.json')){stateBytes=await r.body();responses.push({cell:name,path:u.pathname,sha256:sha(stateBytes),bytes:stateBytes.length,state:true,exact:stateBytes.equals(approvedFixture[surface])});}else if(u.pathname.startsWith('/assets/')||u.pathname.startsWith('/_next/static/')){const b=await r.body(),p=surface==='source'?join(R,'dist',u.pathname):join(C,u.pathname.replace('/_next/','.next/'));responses.push({cell:name,path:u.pathname,sha256:sha(b),bytes:b.length,asset:true,exact:sha(b)===sha(readFileSync(p))});}})());});
  await page.goto(`http://127.0.0.1:${port}${route}?disclosureProof=preserved#review`);await page.getByRole('button',{name:'Inspect trace',exact:true}).first().waitFor();await page.waitForFunction(()=>!document.querySelector('.showcaseCopy > .inspectTrace')?.disabled);await waitForPaintedGraph(page);await page.evaluate(()=>window.scrollTo(0,0));
  const top=await capture(page,name+'-top',{boundary:true});
  const hero=top.regions['.showcase'].rect,extras=[];
  if(hero.height+hero.documentY>height){await page.evaluate(y=>window.scrollTo(0,y),Math.max(0,hero.documentY+hero.height-height+24));extras.push({name:name+'-setup-bottom',metadata:await capture(page,name+'-setup-bottom',{boundary:true})});}
  check(name+' no page horizontal overflow',top.document.width<=width+1);
  check(name+' query and hash retained',new URL(page.url()).searchParams.get('disclosureProof')==='preserved'&&new URL(page.url()).hash==='#review');
  await Promise.all(pending);check(name+' actual input bytes exact without replay substitution',stateBytes?.equals(approvedFixture[surface]));
  if(width===390){await page.evaluate(()=>window.scrollTo(0,0));await page.getByRole('button',{name:'Inspect trace',exact:true}).first().click();await page.waitForTimeout(250);extras.push({name:name+'-existing-inspect',metadata:await capture(page,name+'-existing-inspect')});}
  cells.push({name,surface,fixtureKind:'Actual current local static state response; no fixture or app response replacement',inputSha256:sha(approvedFixture[surface]),top,extras});await context.close();
 }
 check('All served source and installed assets exact on disk',responses.some(r=>r.asset)&&responses.filter(r=>r.asset).every(r=>r.exact));
 check('No application console/page/unexpected request errors',!logs.some(l=>['error','pageerror','blocked-unexpected-request'].includes(l.type)),logs.filter(l=>['error','pageerror','blocked-unexpected-request'].includes(l.type)));
}catch(e){failure=String(e.stack||e);}finally{await browser?.close();for(const child of servers)child.kill();await new Promise(r=>setTimeout(r,300));for(const [n,s]of Object.entries(serverLogs))writeFileSync(join(O,n+'-server.log'),s);}
const after={git:snap(),source:hashes(R,sourcePaths),installed:hashes(C,Object.keys(installedPrior.installedBefore))};
writeFileSync(join(O,'custody-after.json'),JSON.stringify(after,null,2));
checks.push({name:'Source, build, public input, 53 installed inputs, HEAD, index and refs unchanged',pass:JSON.stringify(before)===JSON.stringify(after)});
const report={proof:'NODETRACE-D3-DISCLOSURE-BEFORE-01',at:new Date().toISOString(),head:before.git.head,browser:browser?.version(),cells,checks,responses,logs,failure,sourceBindings:before.source,installedBindings:before.installed,ok:!failure&&cells.length===6&&checks.every(c=>c.pass),limits:['Before evidence only; no implementation, proposed-change proof, score upgrade or deployment.','Viewport-only screenshots; no full-page capture.','Source is actual six-event guided state; installed sample is actual four-event state without a coach.','No app response override, provider action, DB file access, original input mutation or build.','Reviewer context reused; no authored involvement in existing runtime.']};
writeFileSync(join(O,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,cells:cells.length,checks:checks.length,failure}));if(!report.ok)process.exitCode=1;
