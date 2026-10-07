import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
const P=dirname(fileURLToPath(import.meta.url)),R='D:/VSCode Projects/cafecorner_nodebench/nodebench_ai4/NodeTrace',C='C:/Users/hshum/AppData/Local/Temp/nodetrace-next-e2e-lU78sE',O=join(P,'E6e-nodetrace-disclosure-entry-before-02');mkdirSync(O);
const sha=b=>createHash('sha256').update(b).digest('hex'),json=p=>JSON.parse(readFileSync(p,'utf8'));
const before=json(join(P,'E6e-nodetrace-disclosure-before/custody-after.json'));
const hashes=(r,o)=>Object.fromEntries(Object.keys(o).map(p=>[p,sha(readFileSync(join(r,p)))]));
const git=(...args)=>{const x=spawnSync('git',['--no-optional-locks','-C',R,...args],{windowsHide:true});assert.equal(x.status,0);return x.stdout};
const snap=()=>({head:String(git('rev-parse','HEAD')).trim(),tree:String(git('rev-parse','HEAD^{tree}')).trim(),index:sha(git('ls-files','--stage','-z')),refs:sha(git('for-each-ref','--format=%(refname) %(objectname)')),status:String(git('status','--porcelain=v1','-z'))});
assert.deepEqual(snap(),before.git);assert.deepEqual(hashes(R,before.source),before.source);assert.deepEqual(hashes(C,before.installed),before.installed);
const {chromium}=createRequire(join(R,'package.json'))('playwright');const {assertPortFree,waitForServer,waitForPaintedGraph}=await import(pathToFileURL(join(R,'scripts/lib/proof-server.mjs')));
const allowed=new Set(['path','systemroot','windir','comspec','pathext','programfiles','programfiles(x86)','programw6432','systemdrive','userprofile','appdata','localappdata','allusersprofile','homedrive','homepath','number_of_processors','processor_architecture','temp','tmp']);const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>allowed.has(k.toLowerCase())));
const checks=[],cells=[],logs=[];const check=(n,p,d)=>{checks.push({name:n,pass:!!p,detail:d});assert(p,n)};let browser,failure,server;
try{
 browser=await chromium.launch({headless:true});
 for(const surface of ['source','installed']){
  const root=surface==='source'?R:C,port=surface==='source'?4965:4966,args=surface==='source'?[join(R,'node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port','4965','--strictPort']:[join(C,'node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port','4966'];
  await assertPortFree(port);server=spawn(process.execPath,args,{cwd:root,env,windowsHide:true,stdio:['ignore','pipe','pipe']});let serverLog='';for(const s of [server.stdout,server.stderr])s.on('data',b=>serverLog=(serverLog+b).slice(-100000));await waitForServer(`http://127.0.0.1:${port}`);
  for(const [width,height]of surface==='source'?[[320,800],[390,844]]:[[320,800]]){
   const name=`${surface}-${width}`,context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();
   page.on('pageerror',e=>logs.push({cell:name,type:'pageerror',text:String(e)}));page.on('console',m=>{if(m.type()==='error')logs.push({cell:name,type:'error',text:m.text()})});
   await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname!=='127.0.0.1'||u.port!==String(port)||r.request().method()!=='GET'){logs.push({cell:name,type:'unexpected-request',url:u.href});return r.abort()}return r.continue()});
   await page.goto(`http://127.0.0.1:${port}${surface==='source'?'/':'/nodetrace'}?disclosureProof=preserved#review`);await page.waitForFunction(()=>document.querySelector('.showcaseCopy > .inspectTrace')?.disabled===false);await waitForPaintedGraph(page);await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})))});
   await page.evaluate(()=>{const r=document.querySelector('.showcase').getBoundingClientRect();scrollTo(0,Math.max(0,r.y+scrollY+r.height-innerHeight+24))});
   const original=await page.locator('body').evaluate(n=>n.outerHTML),url=page.url();
   const box=await page.evaluate(()=>{const r=document.querySelector('.showcase').getBoundingClientRect(),b=document.createElement('div');b.dataset.disclosureBoundary='true';Object.assign(b.style,{position:'absolute',left:(r.x+scrollX)+'px',top:(r.y+scrollY)+'px',width:r.width+'px',height:r.height+'px',boxSizing:'border-box',border:'3px solid #940088',pointerEvents:'none',zIndex:'2147483647'});const s=document.createElement('span');s.textContent='CHANGE A · Setup disclosure owner';Object.assign(s.style,{position:'absolute',left:'0',top:Math.max(0,-r.y+3)+'px',maxWidth:'100%',background:'#710065',color:'#fff',font:'700 12px/1.3 system-ui',padding:'3px'});b.append(s);document.body.append(b);return {owner:{x:r.x,y:r.y,width:r.width,height:r.height},label:{y:s.getBoundingClientRect().y,height:s.getBoundingClientRect().height},scrollY}});
   check(name+' lower-tile title visibly inside viewport',box.label.y>=0&&box.label.y+box.label.height<=height,box);
   await page.screenshot({path:join(O,name+'-setup-bottom-labelled.png'),fullPage:false});await page.evaluate(()=>document.querySelectorAll('[data-disclosure-boundary]').forEach(n=>n.remove()));
   check(name+' exact underlying DOM and query restored',await page.locator('body').evaluate(n=>n.outerHTML)===original&&page.url()===url);
   cells.push({name,box,url,png:name+'-setup-bottom-labelled.png'});
   if(surface==='source'&&width===390){
    const target=page.locator('.coachDetail .inspectTrace');await target.focus();await page.keyboard.press('Enter');const dialog=page.getByRole('dialog',{name:'Trace Lens: Room trace strip',exact:true});await dialog.waitFor();
    check('Actual selected coach inspection resolves registered Room trace strip',await dialog.isVisible()&&!(await dialog.innerText()).includes('No registry entry is available'));
    await page.screenshot({path:join(O,'source-390-existing-coach-inspect.png'),fullPage:false});writeFileSync(join(O,'source-390-existing-coach-inspect.html'),await page.content());writeFileSync(join(O,'source-390-existing-coach-inspect.ax.txt'),await page.locator('body').ariaSnapshot());
    const escapeUrl=page.url();await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});check('Existing valid coach inspection closes without URL mutation',!await dialog.isVisible()&&page.url()===escapeUrl);
   }
   await context.close();
  }
  server.kill();await new Promise(r=>setTimeout(r,200));server=null;writeFileSync(join(O,surface+'-server.log'),serverLog);
 }
 check('No app console/page or unexpected-request errors',logs.length===0,logs);
}catch(e){failure=String(e.stack||e)}finally{await browser?.close();server?.kill();}
const after={git:snap(),source:hashes(R,before.source),installed:hashes(C,before.installed)};check('Original source build installed inputs HEAD index and refs unchanged',JSON.stringify(before)===JSON.stringify(after));
const report={proof:'NODETRACE-D3-ENTRY-AND-LABEL-ADDITIONAL-BEFORE',at:new Date().toISOString(),ok:!failure&&checks.every(c=>c.pass),checks,cells,logs,failure,before,after,limits:['Only three lower-tile label variants and actual existing selected-coach inspection.','Original six-cell before report and PNGs unchanged. No proposed implementation or app response replacement.']};writeFileSync(join(O,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,checks:checks.length,failure}));if(!report.ok)process.exitCode=1;
