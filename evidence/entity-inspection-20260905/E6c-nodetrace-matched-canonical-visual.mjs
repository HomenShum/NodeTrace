import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,readdirSync,existsSync} from 'node:fs';
import {join,dirname,relative} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawn,spawnSync} from 'node:child_process';
const packet=dirname(fileURLToPath(import.meta.url));
const out=join(packet,'E6c-nodetrace-matched-canonical-visual');mkdirSync(out);
const beforeRoot=join(packet,'evidence/nodetrace-entity-inspection-02-before/primary-controls-boundary');
const before=JSON.parse(readFileSync(join(beforeRoot,'report.json'),'utf8'));
const primary='D:/VSCode Projects/cafecorner_nodebench/nodebench_ai4/NodeTrace';
const installedProof=JSON.parse(readFileSync(join(packet,'E6c_NODETRACE_INSTALLED_NEXT_ENTITY_OWNER_PROOF.json'),'utf8'));
const consumer=installedProof.consumer;
const sourceProof=JSON.parse(readFileSync(join(packet,'E6c-nodetrace-entity-canonical-source/receipt.json'),'utf8'));
const originalPrimary='D:/ProjectRecovery/nodetrace-entity-repair-20260905/pre-final-journey/public';
const originalInstalled=join(before.consumer,'public');
const {chromium}=createRequire(join(primary,'package.json'))('playwright');
const {assertPortFree,waitForPaintedGraph,waitForServer}=await import(pathToFileURL(join(primary,'scripts/lib/proof-server.mjs')));
const {recordEntityCanvas,assertEntityFrame}=await import(pathToFileURL(join(primary,'scripts/lib/entity-inspection-proof.mjs')));
const sha=b=>createHash('sha256').update(b).digest('hex');
const git=(...args)=>{const r=spawnSync('git',['--no-optional-locks','-C',primary,...args],{encoding:'utf8',windowsHide:true});if(r.status)throw Error(r.stderr);return r.stdout.trim();};
const checks=[],cells=[],network=[],errors=[],processes=[];
const check=(name,pass,detail)=>{checks.push({name,pass:!!pass,detail});if(!pass)throw Error(name);};
const files=(root,dir)=>readdirSync(join(root,dir),{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(root,join(dir,e.name)):[join(dir,e.name).replaceAll('\\','/')]);
const sourceFiles=[...new Set([...Object.keys(sourceProof.sourceHashes),'public/nodetrace-state.json',...files(primary,'dist')])];
const installedFiles=[...new Set([...installedProof.sourceInstalledBindings.map(b=>b.target),'src/app/nodetrace/page.tsx','public/nodetrace-state.json','package.json','package-lock.json',...files(consumer,'.next').filter(f=>!f.startsWith('.next/cache/'))])];
const hashes=(root,names)=>Object.fromEntries(names.map(f=>[f,sha(readFileSync(join(root,f)))]));
const baseline={at:new Date().toISOString(),head:git('rev-parse','HEAD'),stageListingSha256:sha(spawnSync('git',['--no-optional-locks','-C',primary,'ls-files','--stage','-z']).stdout),source:hashes(primary,sourceFiles),installed:hashes(consumer,installedFiles),originalPrimarySha256:sha(readFileSync(join(originalPrimary,'nodetrace-state.json'))),originalInstalledSha256:sha(readFileSync(join(originalInstalled,'nodetrace-state.json')))};
writeFileSync(join(out,'source-before.json'),JSON.stringify(baseline,null,2));
for(const [f,h] of Object.entries(sourceProof.sourceHashes))check('final source binding '+f,baseline.source[f]===h);
for(const b of installedProof.sourceInstalledBindings){let expected=readFileSync(join(primary,b.source),'utf8');for(const [a,z]of b.replacements)expected=expected.replaceAll(a,z);check('installed transform '+b.target,sha(expected)===b.expectedInstalledSha256&&baseline.installed[b.target]===b.installedSha256);}
const allowed=new Set(['path','systemroot','windir','comspec','pathext','programfiles','programfiles(x86)','programw6432','systemdrive','userprofile','appdata','localappdata','allusersprofile','homedrive','homepath','number_of_processors','processor_architecture','temp','tmp']);
const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>allowed.has(k.toLowerCase())));env.NEXT_TELEMETRY_DISABLED='1';
function start(root,args,port,label){const child=spawn(process.execPath,args,{cwd:root,env,windowsHide:true,stdio:['ignore','pipe','pipe']});let log='';child.stdout.on('data',b=>log=(log+b).slice(-1000000));child.stderr.on('data',b=>log=(log+b).slice(-1000000));processes.push({child,label,port,getLog:()=>log});}
const protectedSelectors=['.showcase','[aria-label="Trace Coach launch path"]','.liveGraphRailHead'];
async function metadata(page){return page.evaluate(selectors=>{
 const rect=n=>{if(!n)return null;const r=n.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,documentY:r.y+scrollY}};
 return{url:location.href,viewport:{width:innerWidth,height:innerHeight},scroll:{x:scrollX,y:scrollY},overflow:document.documentElement.scrollWidth-innerWidth,theme:getComputedStyle(document.body).backgroundColor,entityCount:document.querySelector('[data-testid="live-graph-rail"]')?.getAttribute('data-entity-count'),edgeCount:document.querySelector('[data-testid="live-graph-rail"]')?.getAttribute('data-edge-count'),canvas:rect(document.querySelector('[data-testid="nodegraph-canvas"]')),selector:rect(document.querySelector('.liveGraphRailControls select')),fit:rect(document.querySelector('[data-testid="nodegraph-fit"]')),readout:document.querySelector('[data-testid="live-graph-node-events"]')?.textContent??null,selection:document.querySelector('[data-testid="nodegraph-selection"]')?.textContent??null,protected:selectors.map(selector=>{const n=document.querySelector(selector);return{selector,text:n?.textContent??null,bounds:rect(n)}}),frame:window.__nodeTraceEntityFrame()};
 },protectedSelectors);}
async function checkedScreenshot(page,name,fullPage=false){
 const attempts=[];
 for(let attempt=1;attempt<=8;attempt++){
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const rect=await page.getByTestId('nodegraph-canvas').boundingBox();
  if(fullPage){const scroll=await page.evaluate(()=>({x:scrollX,y:scrollY}));rect.x+=scroll.x;rect.y+=scroll.y;}
  const bytes=await page.screenshot({fullPage});const attemptName=name+'-paint-attempt-'+attempt+'.png';writeFileSync(join(out,attemptName),bytes);
  const py='from PIL import Image;import sys,io,json;im=Image.open(io.BytesIO(sys.stdin.buffer.read())).convert("RGB");r=json.loads(sys.argv[1]);x0=max(0,int(r["x"])+3);y0=max(0,int(r["y"])+3);x1=min(im.width,int(r["x"]+r["width"])-3);y1=min(im.height,int(r["y"]+r["height"])-3);n=sum(1 for y in range(y0,y1) for x in range(x0,x1) if max(im.getpixel((x,y)))<120);print(json.dumps({"darkGraphPixels":n,"positivePaint":n>40,"canvasCrop":[x0,y0,x1,y1],"rasterSize":[im.width,im.height]}))';
  const result=spawnSync('python',['-c',py,JSON.stringify(rect)],{input:bytes,windowsHide:true,timeout:10000});if(result.status!==0)throw Error(result.stderr.toString());
  const sample=JSON.parse(result.stdout.toString());attempts.push({attempt,path:attemptName,sha256:sha(bytes),...sample});
  if(sample.positivePaint){
   writeFileSync(join(out,name+'.png'),bytes);
   check(name+' exact saved PNG raster has >40 dark canvas pixels',sha(readFileSync(join(out,name+'.png')))===sha(bytes),attempts);
   return {path:name+'.png',sha256:sha(bytes),attempts,checkedExactSavedBytes:true};
  }
 }
 check(name+' saved PNG raster failed positive paint after eight retained attempts',false,attempts);
}
async function snap(page,context,name,boundary=false){
 const data=await metadata(page);writeFileSync(join(out,name+'.json'),JSON.stringify(data,null,2));writeFileSync(join(out,name+'.html'),await page.content());writeFileSync(join(out,name+'-ax.txt'),await page.locator('body').ariaSnapshot());
 data.pixelProof=[await checkedScreenshot(page,name,false),await checkedScreenshot(page,name+'-full',true)];
 if(boundary){const boxes=await page.evaluate(()=>{const rail=document.querySelector('[data-testid="live-graph-rail"]').getBoundingClientRect(),control=document.querySelector('.liveGraphRailControls').getBoundingClientRect(),filters=document.querySelector('[data-testid="edge-type-filters"]').getBoundingClientRect(),canvas=document.querySelector('[data-testid="nodegraph-canvas"]').getBoundingClientRect(),selection=document.querySelector('[data-testid="nodegraph-selection"]')?.getBoundingClientRect(),events=document.querySelector('[data-testid="live-graph-node-events"]')?.getBoundingClientRect();const boxes=[{label:'CHANGE A · Entity controls and local graph heading',x:control.x,y:control.y,width:control.width,height:filters.bottom-control.y},{label:'CHANGE B · Graph and entity result',x:rail.x+16,y:canvas.y,width:rail.width-32,height:Math.max(canvas.bottom,selection?.bottom??0,events?.bottom??0)-canvas.y}];for(const b of boxes){const n=document.createElement('div');n.dataset.matchedBoundary='';n.setAttribute('aria-hidden','true');Object.assign(n.style,{position:'absolute',left:b.x+scrollX+'px',top:b.y+scrollY+'px',width:b.width+'px',height:b.height+'px',border:'3px solid #9a0077',boxSizing:'border-box',pointerEvents:'none',zIndex:'2147483646'});const l=document.createElement('span');l.textContent=b.label;Object.assign(l.style,{position:'absolute',left:'0',bottom:'100%',maxWidth:'100%',font:'bold 11px/1.15 Arial,sans-serif',color:'#fff',background:'#65004d',padding:'2px 4px'});n.append(l);document.body.append(n);}return boxes.map(b=>({...b,documentY:b.y+scrollY,borderWidth:3}));});
  data.pixelProof.push(await checkedScreenshot(page,name+'-change-boundary',false));writeFileSync(join(out,name+'-boundary.json'),JSON.stringify(boxes,null,2));await page.evaluate(()=>document.querySelectorAll('[data-matched-boundary]').forEach(n=>n.remove()));data.boundary=boxes;
 }writeFileSync(join(out,name+'.json'),JSON.stringify(data,null,2));return data;
}
let browser,failure;
try{
 await assertPortFree(4917);await assertPortFree(54274);
 start(primary,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4917','--strictPort'],4917,'source');await waitForServer('http://127.0.0.1:4917/');
 start(consumer,['node_modules/next/dist/bin/next','start','-H','127.0.0.1','-p','54274'],54274,'installed');await waitForServer('http://127.0.0.1:54274/nodetrace');
 browser=await chromium.launch({headless:true});
 for(const fixture of [{label:'source',original:originalPrimary,origin:'http://127.0.0.1:4917',route:'/?unrelated=preserved#review'},{label:'installed',original:originalInstalled,origin:'http://127.0.0.1:54274',route:'/nodetrace?host=preserved&returnTo=dashboard#host-section'}]){
  const raw=readFileSync(join(fixture.original,'nodetrace-state.json')),state=JSON.parse(raw),expectedHash=before.cells.find(c=>c.name===fixture.label+'-320').fixtureSha256;
  check(fixture.label+' exact original state bytes',sha(raw)===expectedHash);
  const oldAssets=new Map();for(const n of before.network.filter(n=>n.cell.startsWith(fixture.label+'-')&&n.url.includes('/captures/')&&n.sha256)){const pathname=new URL(n.url).pathname;const file=join(fixture.original,pathname.slice(1));check(fixture.label+' exact original image '+pathname,existsSync(file)&&sha(readFileSync(file))===n.sha256);oldAssets.set(pathname,file);}
  for(const [width,height]of [[320,800],[390,844],[1440,960]]){
   const tag=fixture.label+'-'+width,prior=before.cells.find(c=>c.name===tag),context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1}),cell={name:tag,viewport:{width,height},fixtureSha256:sha(raw),traceRecords:state.traces.length,route:fixture.route,replay:'byte-exact original response through browser routing; not fresh backend output',captures:[],console:[],network:[]};
   await recordEntityCanvas(context);const page=await context.newPage();page.setDefaultTimeout(10000);
   await page.route('**/nodetrace-state.json',route=>route.fulfill({status:200,contentType:'application/json',body:raw,headers:{'cache-control':'no-store'}}));
   if(oldAssets.size)await page.route('**/captures/**',route=>{const file=oldAssets.get(new URL(route.request().url()).pathname);return file?route.fulfill({status:200,contentType:file.endsWith('.svg')?'image/svg+xml':'image/png',body:readFileSync(file)}):route.continue();});
   page.on('pageerror',e=>cell.console.push({type:'pageerror',text:e.message}));page.on('console',m=>{if(['warning','error'].includes(m.type()))cell.console.push({type:m.type(),text:m.text()});});
   const pending=[];page.on('response',r=>{if(!r.url().startsWith(fixture.origin))return;const routePath=new URL(r.url()).pathname;if(!(routePath.startsWith('/assets/')||routePath.startsWith('/_next/static/')))return;pending.push((async()=>{try{if(r.status()>=300&&r.status()<400)return;let timer;const bytes=await Promise.race([r.body(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Built module response body exceeded 10 seconds')),10000);})]).finally(()=>clearTimeout(timer));const u=new URL(r.url());let actualPath=null;if(fixture.label==='source'&&u.pathname.startsWith('/assets/'))actualPath=join(primary,'dist',u.pathname.slice(1));if(fixture.label==='installed'&&u.pathname.startsWith('/_next/static/'))actualPath=join(consumer,'.next',u.pathname.replace('/_next/',''));const row={url:r.url(),status:r.status(),bytes:bytes.length,sha256:sha(bytes),builtFile:actualPath,builtBytesMatch:actualPath?existsSync(actualPath)&&sha(readFileSync(actualPath))===sha(bytes):null};cell.network.push(row);}catch(e){cell.network.push({url:r.url(),error:String(e)});}})());});
   await page.goto('about:blank');await page.goto(fixture.origin+fixture.route,{waitUntil:'networkidle'});await page.getByTestId('live-graph-rail').waitFor({state:'visible'});await page.getByTestId('live-graph-rail').scrollIntoViewIfNeeded();await waitForPaintedGraph(page);
   const fetched=await page.evaluate(async()=>({status:(await fetch('/nodetrace-state.json',{cache:'no-store'})).status,body:await(await fetch('/nodetrace-state.json',{cache:'no-store'})).text()}));check(tag+' app route receives byte-exact original fixture',fetched.status===200&&sha(fetched.body)===sha(raw));
   const originalScroll=prior.captures.find(c=>c.name===tag+'-populated').scroll;await page.evaluate(({x,y})=>scrollTo(x,y),originalScroll);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   check(tag+' starts unselected',await page.getByTestId('live-graph-node-events').count()===0&&await page.getByTestId('nodegraph-selection').count()===0);
   await assertEntityFrame(page,check,tag+'-overview');cell.captures.push({name:tag+'-populated',...await snap(page,context,tag+'-populated',true)});
   const oldHtml=readFileSync(join(beforeRoot,tag+'-populated.html'),'utf8');const protectedOld=await page.evaluate(({html,selectors})=>{const d=new DOMParser().parseFromString(html,'text/html');return selectors.map(selector=>({selector,text:d.querySelector(selector)?.textContent??null}));},{html:oldHtml,selectors:protectedSelectors});
   check(tag+' protected guidance/header copy unchanged',JSON.stringify(protectedOld)===JSON.stringify(cell.captures[0].protected.map(({selector,text})=>({selector,text}))),{before:protectedOld,after:cell.captures[0].protected});
   check(tag+' old entity/edge counts unchanged',cell.captures[0].entityCount===prior.captures[0].entityCount&&cell.captures[0].edgeCount===prior.captures[0].edgeCount);
   await page.keyboard.press('Control+Home');let reached=false;const focus=[];const select=page.getByRole('combobox',{name:'Entity',exact:true});
   for(let n=0;n<100;n++){await page.keyboard.press('Tab');const f=await page.evaluate(()=>({tag:document.activeElement?.tagName,text:document.activeElement?.getAttribute('aria-label')||document.activeElement?.closest('label')?.textContent||document.activeElement?.textContent?.slice(0,120)}));focus.push(f);if(await select.evaluate(n=>n===document.activeElement)){reached=true;break;}}
   check(tag+' natural Tab reaches native Entity',reached,focus);await page.keyboard.press('Home');const target=prior.pointer.name;const options=await select.locator('option').allTextContents();const index=options.indexOf(target);check(tag+' original pointer identity available natively',index>0,target);for(let n=0;n<index;n++)await page.keyboard.press('ArrowDown');
   const result=page.getByTestId('live-graph-node-events'),detail=page.getByTestId('nodegraph-selection');await result.waitFor({state:'visible'});
   check(tag+' native selection preserves full identity',await result.locator('strong').textContent()===target);check(tag+' native events match original pointer proof',JSON.stringify((await result.locator('li code').allTextContents()).sort())===JSON.stringify([...prior.pointer.expectedEvents].sort()));
   const split=target.indexOf(': ');check(tag+' both selection panels agree',(await detail.locator('dd').first().textContent()).trim()===target.slice(split+2)+' · '+target.slice(0,split));check(tag+' measured count stays unknown',await detail.getByTestId('count-readout').textContent()==='unknown — not measured');
   await page.mouse.move(0,0);await page.getByTestId('live-graph-rail').scrollIntoViewIfNeeded();await waitForPaintedGraph(page);await assertEntityFrame(page,check,tag+'-native-selected');cell.focus=focus;cell.selectedTarget=target;cell.expectedEvents=prior.pointer.expectedEvents;cell.captures.push({name:tag+'-native-selected',...await snap(page,context,tag+'-native-selected',true)});
   check(tag+' no overflow in matched captures',cell.captures.every(c=>c.overflow===0));check(tag+' host URL context preserved',new URL(page.url()).pathname+new URL(page.url()).search+new URL(page.url()).hash===new URL(prior.captures[0].url).pathname+new URL(prior.captures[0].url).search+new URL(prior.captures[0].url).hash);
   check(tag+' no application error',!cell.console.some(c=>['error','pageerror'].includes(c.type)),cell.console);
   await Promise.all(pending);check(tag+' no built module capture errors',!cell.network.some(n=>n.error),cell.network.filter(n=>n.error));check(tag+' actual served built modules match disk',cell.network.filter(n=>n.builtFile).length>0&&cell.network.filter(n=>n.builtFile).every(n=>n.builtBytesMatch));
   await context.close();cells.push(cell);writeFileSync(join(out,tag+'-cell.json'),JSON.stringify(cell,null,2));console.log(JSON.stringify({cell:tag,captures:cell.captures.length,identity:target,fixtureSha256:sha(raw)}));
  }
 }
}catch(e){failure=e.stack??String(e);errors.push(failure);}
finally{await browser?.close().catch(()=>{});for(const p of processes){if(p.child.exitCode===null&&p.child.signalCode===null){const exited=new Promise(resolve=>p.child.once('exit',resolve));p.child.kill();await Promise.race([exited,new Promise((_,reject)=>setTimeout(()=>reject(Error('Owned server did not exit: '+p.label)),8000).unref())]);}writeFileSync(join(out,p.label+'-server.log'),p.getLog());await assertPortFree(p.port);}}
const after={at:new Date().toISOString(),head:git('rev-parse','HEAD'),stageListingSha256:sha(spawnSync('git',['--no-optional-locks','-C',primary,'ls-files','--stage','-z']).stdout),source:hashes(primary,sourceFiles),installed:hashes(consumer,installedFiles),originalPrimarySha256:sha(readFileSync(join(originalPrimary,'nodetrace-state.json'))),originalInstalledSha256:sha(readFileSync(join(originalInstalled,'nodetrace-state.json')))};
writeFileSync(join(out,'source-after.json'),JSON.stringify(after,null,2));
const preservation={head:baseline.head===after.head,stageListing:baseline.stageListingSha256===after.stageListingSha256,source:JSON.stringify(baseline.source)===JSON.stringify(after.source),installed:JSON.stringify(baseline.installed)===JSON.stringify(after.installed),originalPrimary:baseline.originalPrimarySha256===after.originalPrimarySha256,originalInstalled:baseline.originalInstalledSha256===after.originalInstalledSha256};
const report={proof:'NODETRACE-MATCHED-ENTITY-VISUAL-02',at:new Date().toISOString(),reviewer:'Sequential evidence worker; no application-source edits in this slice. Independent review follows.',beforeReport:join(beforeRoot,'report.json'),primary,consumer,sourceBindings:sourceProof.sourceHashes,installedTransforms:installedProof.sourceInstalledBindings,preservation,checks,cells,errors,failure,ports:processes.map(p=>p.port),serversStopped:true,replayDisclosure:'The exact original six-event and four-event bytes, and source assets when referenced, were returned through browser routing. Current application files/build and public data stayed unchanged. This is input replay, not new backend output.',passed:!failure&&cells.length===6&&checks.every(c=>c.pass)&&Object.values(preservation).every(Boolean)};
writeFileSync(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,cells:cells.length,checks:checks.length,preservation,failure}));process.exitCode=report.passed?0:1;
