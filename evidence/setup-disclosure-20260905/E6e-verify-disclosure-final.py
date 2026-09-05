import hashlib
import json
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path

P=Path(__file__).resolve().parent
R=Path('D:/VSCode Projects/cafecorner_nodebench/nodebench_ai4/NodeTrace')
O=P/'E6e-nodetrace-disclosure-final-judge'
C=Path('C:/Users/hshum/AppData/Local/Temp/nodetrace-next-e2e-AxCJ0v')
sha=lambda b:hashlib.sha256(b).hexdigest()
read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
checks=[]
def check(n,p,d=None): checks.append({'name':n,'pass':bool(p),'detail':d})
def git(*a):return subprocess.check_output(['git','--no-optional-locks','-C',str(R),*a])
def snap():return {'head':git('rev-parse','HEAD').decode().strip(),'tree':git('rev-parse','HEAD^{tree}').decode().strip(),'index':sha(git('ls-files','--stage','-z')),'refs':sha(git('for-each-ref','--format=%(refname) %(objectname)')),'status':git('status','--porcelain=v1','-z').decode()}
candidateBytes=(P/'E6e_NODETRACE_DISCLOSURE_CANDIDATE.json').read_bytes();f=read(P/'E6e_NODETRACE_DISCLOSURE_CANDIDATE.json');old=read(O/'candidate-original.json');before=read(O/'custody-before.json');now=snap()
check('Final UTF8 refreeze has expected identity',sha(candidateBytes)=='f044bf1ebdfea1f04d3165a59e20d6b898113e0259f3ae340d925f22d6cf2f06')
bindings={e['path']:{'sha256':sha((R/e['path']).read_bytes()),'bytes':(R/e['path']).stat().st_size} for e in f['files']}
check('All seven candidate source/proof/metadata files exact',all(bindings[e['path']]=={'sha256':e['sha256'],'bytes':e['bytes']} for e in f['files']) and len(bindings)==7)
check('Only two UTF8 metadata bindings changed since original frozen review',sorted(e['path'] for e in f['files'] if e['sha256']!=next(o['sha256'] for o in old['files'] if o['path']==e['path']))==['docs/START_HERE.md','docs/codebase/CONCERNS.md'])
reports={p:{'sha256':sha((P/p).read_bytes()),'expected':h} for p,h in f['reports'].items()}
check('All six claimed report bindings exact',len(reports)==6 and all(b['sha256']==b['expected'] for b in reports.values()))
paths=set(filter(None,git('diff','--name-only','-z','HEAD').decode().split('\0')))|set(filter(None,git('ls-files','--others','--exclude-standard','-z').decode().split('\0')))
check('Git change inventory is exact seven-file allowed scope',paths==set(bindings),sorted(paths))
check('HEAD tree index refs and path status remain unchanged from original judge baseline',now==before['git'],now)
check('No staged changes',not git('diff','--cached','--name-only','-z'))
actualSource=(R/'src/DemoDashboard.tsx').read_text(encoding='utf-8-sig');baseSource=git('show','HEAD:src/DemoDashboard.tsx').decode('utf-8')
anchor='          {coach && activeCoachStep ? ('
check('All coach/list/lens/graph/Raw JSX and functions below header exact to base',actualSource.split(anchor,1)[1]==baseSource.split(anchor,1)[1])
actualCss=(R/'src/styles.css').read_text(encoding='utf-8-sig');baseCss=git('show','HEAD:src/styles.css').decode('utf-8')
check('Raw and graph CSS remain exact to base',actualCss[actualCss.index('.r-tracevu-raw {'):actualCss.index('@media (max-width: 980px)')]==baseCss[baseCss.index('.r-tracevu-raw {'):baseCss.index('@media (max-width: 980px)')] and actualCss[actualCss.index('.liveGraphRail {'):]==baseCss[baseCss.index('.liveGraphRail {'):])
startBase=git('show','HEAD:docs/START_HERE.md').decode('utf-8')
expected=startBase.replace('src/DemoDashboard.tsx:147','src/DemoDashboard.tsx:153').replace('src/DemoDashboard.tsx:142','src/DemoDashboard.tsx:148').replace('src/DemoDashboard.tsx:137','src/DemoDashboard.tsx:143')
expected=expected.replace('**Next** — the ready header has a tagged surface at `src/DemoDashboard.tsx:72`\n(`data-nodetrace-surface="shell.statusStrip"`) and a normal inspect control.', '**Next** — the ready header has a tagged surface at `src/DemoDashboard.tsx:73`\n(`data-nodetrace-surface={heroSurfaceId}`) and a normal inspect control. Both use the selected coach step\'s surface, or the installed sample surface when there is no coach. The native\n**Setup and trace provenance** disclosure reveals the existing commands and\nsnapshot details without changing the selected trace.')
check('START_HERE exact UTF8 baseline plus intended anchors and header contract only',(R/'docs/START_HERE.md').read_text(encoding='utf-8')==expected)
concernsBase=git('show','HEAD:docs/codebase/CONCERNS.md').decode('utf-8')
check('CONCERNS exact UTF8 baseline plus two numeric anchors only',(R/'docs/codebase/CONCERNS.md').read_text(encoding='utf-8')==concernsBase.replace('src/DemoDashboard.tsx:147','src/DemoDashboard.tsx:153').replace('src/DemoDashboard.tsx:165','src/DemoDashboard.tsx:171'))
tourBindings=[]
for path in ['.tours/01-primary-user-flow.tour','.tours/03-debug-and-recovery.tour']:
    a=json.loads(git('show','HEAD:'+path).decode('utf-8'));b=read(R/path)
    def unline(x):
        if isinstance(x,dict):return {k:unline(v) for k,v in x.items() if k!='line'}
        if isinstance(x,list):return [unline(v) for v in x]
        return x
    tourBindings.append({'path':path,'sameExceptLine':unline(a)==unline(b)})
check('Tour descriptions and all nonline content remain exact',all(t['sameExceptLine'] for t in tourBindings),tourBindings)
wc=subprocess.run(['git','--no-optional-locks','-C',str(R),'diff','--check'],capture_output=True)
(O/'authored-whitespace.log').write_bytes(wc.stdout+wc.stderr)
check('Authored tracked whitespace passes',wc.returncode==0)
check('New authored script has no trailing whitespace',all(line==line.rstrip() for line in (R/'scripts/setup-disclosure-proof.mjs').read_text(encoding='utf-8').splitlines()))
ci=subprocess.run(['node','scripts/citations-check.mjs'],cwd=R,capture_output=True)
(O/'citations-check.log').write_bytes(ci.stdout+ci.stderr)
check('Independent current citations pass 3 tours35steps54refs',ci.returncode==0 and b'PASS 3 tours, 35 steps, 54 markdown citations' in ci.stdout,ci.stdout.decode())
syntax=subprocess.run(['node','--check','scripts/setup-disclosure-proof.mjs'],cwd=R,capture_output=True)
(O/'script-syntax.log').write_bytes(syntax.stdout+syntax.stderr)
check('Current proof script syntax passes',syntax.returncode==0)
replays={}
measurements=[]
for surface,count in [('source',92),('installed',79)]:
    j=read(O/surface/'report.json');r=read(P/f'E6e-nodetrace-disclosure-{surface}-final/report.json')
    replays[surface]={'checks':len(j['checks']),'captures':len(j['captures']),'ok':j['ok'],'sourceBefore':j['sourceBefore'],'installedBefore':j['installedBefore']}
    check(surface+' independent full focused replay passes expected scenario counts',j['ok'] and len(j['checks'])==count and len(j['captures'])==15 and all(x['pass'] for x in j['checks']))
    check(surface+' replay source/build and installed bindings equal frozen originals',j['sourceBefore']==j['sourceAfter']==r['sourceBefore']==r['sourceAfter'] and j['installedBefore']==j['installedAfter']==r['installedBefore']==r['installedAfter'])
    check(surface+' every served actual state and asset matches disk',j['responses'] and all(x['exact'] for x in j['responses']))
    for w in [320,390,1440]:
        c=next(c for c in j['captures'] if c['name']==f'{surface}-{w}-collapsed');b=read(P/f'E6e-nodetrace-disclosure-before/{surface}-{w}-top.json');section='.coachPanel' if surface=='source' else '.coachEmpty'
        measurements.append({'surface':surface,'width':w,'height':c['height'],'beforeHeroHeight':b['regions']['.showcase']['rect']['height'],'afterHeroHeight':c['regions']['.showcase']['height'],'beforeNextY':b['regions'][section]['rect']['documentY'],'afterNextY':c['regions'][section]['documentY'],'afterSummaryHeight':c['regions']['.traceSetup > summary']['height'],'beforeGraphY':b['regions']['.liveGraphRail']['rect']['documentY'],'afterGraphY':c['regions']['.liveGraphRail']['documentY']})
check('All six normal summary targets at least44px and phone hero budgets met',all(m['afterSummaryHeight']>=44 and (m['width']>=500 or m['afterHeroHeight']<=m['height']*.6) for m in measurements),measurements)
check('Source actual fixture exactly matches before captured input',(O/'source/actual-input.json').read_bytes()==(P/'E6e-nodetrace-disclosure-before/source-actual-input.json').read_bytes())
oldInstalled=read(P/'E6e-nodetrace-disclosure-before/installed-actual-input.json');newInstalled=read(O/'installed/actual-input.json')
check('New normal installed fixture stays four events/no coach and is explicitly a new generation',len(newInstalled['traces'])==4 and not newInstalled.get('coach') and newInstalled['session']['id']!=oldInstalled['session']['id'])
check('Installed dashboard exact approved source transform and CSS exact', (C/'src/nodetrace-demo/DemoDashboard.tsx').read_text(encoding='utf-8')==actualSource.replace('./trace','../nodetrace') and (C/'src/nodetrace-demo/styles.css').read_bytes()==(R/'src/styles.css').read_bytes())
causal=read(O/'causal/report.json');capture=read(O/'installed-1440-capture/report.json');pixels=read(O/'installed-1440-capture/pixel-observation.json')
check('Independent causal knockout and actual host-alert checks all pass',causal['ok'] and len(causal['checks'])==14 and all(x['pass'] for x in causal['checks']))
check('Old-identity failure and actual restore both retained', [x['firstInspectRegistered'] for x in causal['cases']]==[True,False,True])
check('Single fresh1440 capture has observed painted native PNG with original blank retained',capture['ok'] and len(capture['checks'])==6 and pixels['pixelObservations'][0]['graphVisibleChromaticPixels']==0 and pixels['pixelObservations'][2]['graphVisibleChromaticPixels']>0)
installation=read(P/'E6e-nodetrace-disclosure-consumer-install-final/receipt.json')
check('Ordinary fresh installed receipt records all four phases passing',installation['exitCode']==0 and installation['report']['ok'] and installation['report']['totalMs']==106655 and [x['name'] for x in installation['report']['phases']]==['install dependencies','happy path','smoke','build'] and all(x['ok'] for x in installation['report']['phases']))
proofReport=read(P/'E6e-nodetrace-disclosure-checks/report.json')
check('Historical failed citation and restored generated outputs remain truthful',proofReport['steps'][2]['exitCode']==1 and all(proofReport['restored'].values()))
check('Existing happy path and smoke raw logs support recorded passes',b'nodetrace happy path: PASS' in (P/'E6e-nodetrace-disclosure-checks/happy-path.log').read_bytes() and all(x in (P/'E6e-nodetrace-disclosure-checks/smoke.log').read_bytes() for x in [b'nodetrace smoke: PASS',b'nodetrace cli smoke: PASS',b'nodetrace mcp smoke: PASS']))
(O/'reviewed-final.patch').write_bytes(git('diff'))
end=snap();check('Final HEAD index refs path status unchanged and current candidate remains exact',end==now and all(sha((R/e['path']).read_bytes())==e['sha256'] for e in f['files']) and sha((P/'E6e_NODETRACE_DISCLOSURE_CANDIDATE.json').read_bytes())==sha(candidateBytes))
result={'at':datetime.now(timezone.utc).isoformat(),'ok':all(c['pass'] for c in checks),'checks':checks,'candidateSha256':sha(candidateBytes),'bindings':bindings,'reports':reports,'gitBefore':before['git'],'gitAfter':end,'replays':replays,'measurements':measurements,'causalChecks':14,'singleViewportChecks':6,'pixelObservations':pixels['pixelObservations']}
(O/'verification.json').write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
print(json.dumps({'ok':result['ok'],'checks':len(checks),'failed':[x for x in checks if not x['pass']],'measurements':measurements},ensure_ascii=True))
