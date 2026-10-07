import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const P=dirname(fileURLToPath(import.meta.url)),R='D:/VSCode Projects/cafecorner_nodebench/nodebench_ai4/NodeTrace';
const {chromium}=createRequire(join(R,'package.json'))('playwright');
const htmlBytes=readFileSync(join(P,'E6d-nodetrace-raw-home-judge-01/failure-current-state.html'));
const cssBytes=readFileSync(join(R,'dist/assets/index-B-49wX3f.css'));
const sha=b=>createHash('sha256').update(b).digest('hex');
const html=htmlBytes.toString('utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<link\b[^>]*>/gi,'').replace('</head>','<style>'+cssBytes+'</style></head>');
const browser=await chromium.launch(),cases=[];
for(const mode of ['endpoint-sample','native-scrollend']){
 const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'no-preference'});
 await page.setContent(html);
 await page.evaluate(()=>{window.__ev=[];for(const type of ['keydown','scrollend'])addEventListener(type,e=>{const n=document.querySelector('[data-testid="trace-raw"]');window.__ev.push({type,key:e.key,target:e.target?.getAttribute?.('data-testid'),at:performance.now(),top:n?.scrollTop,max:n&&n.scrollHeight-n.clientHeight});},true);});
 const raw=page.getByTestId('trace-raw'),rounds=[];
 for(let round=0;round<10;round++){
  for(const key of ['End','Home']){
   await raw.focus();
   await raw.evaluate((n,key)=>{const at=()=>key==='Home'?n.scrollTop===0:n.scrollHeight-n.clientHeight-n.scrollTop<=2;window.__done=at();if(!at())n.addEventListener('scrollend',function done(){if(at()){window.__done=true;n.removeEventListener('scrollend',done);}});},key);
   await page.keyboard.press(key);
   if(mode==='native-scrollend')await page.waitForFunction(()=>window.__done,null,{timeout:2000});
   let reached=true;try{await page.waitForFunction(key=>{const n=document.querySelector('[data-testid="trace-raw"]');return key==='Home'?n.scrollTop===0:n.scrollHeight-n.clientHeight-n.scrollTop<=2;},key,{timeout:700});}catch{reached=false;}
   rounds.push({round,key,reached,...await raw.evaluate(n=>({top:n.scrollTop,max:n.scrollHeight-n.clientHeight,y:n.getBoundingClientRect().y,width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height,focused:document.activeElement===n}))});
   if(!reached){await page.keyboard.press(key);await page.waitForTimeout(700);}
  }
  await page.waitForTimeout(1000);
 }
 cases.push({mode,rounds,events:await page.evaluate(()=>window.__ev),rawSha256:sha(await raw.textContent())});
 await page.screenshot({path:join(P,`E6d-raw-home-static-${mode}.png`)});
 await page.close();
}
const report={at:new Date().toISOString(),browser:browser.version(),isolation:'Exact captured application DOM plus exact current built stylesheet, scripts removed. No React, history restoration, application event handlers, fixture fetch or graph animation.',htmlInputSha256:sha(htmlBytes),cssInputSha256:sha(cssBytes),cases};
await browser.close();writeFileSync(join(P,'E6d_RAW_HOME_STATIC_JUDGE.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({cases:cases.map(c=>({mode:c.mode,total:c.rounds.length,failed:c.rounds.filter(r=>!r.reached).length}))}));
