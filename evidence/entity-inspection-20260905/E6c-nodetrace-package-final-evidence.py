from pathlib import Path
import json, shutil, hashlib

packet=Path(__file__).resolve().parent
root=Path('D:/VSCode Projects/cafecorner_nodebench/nodebench_ai4/NodeTrace')
out=root/'evidence/entity-inspection-20260905'
assert not out.exists(), 'Do not overwrite a frozen proof packet'
reports=['E6c_NODETRACE_ENTITY_FIXED_KNOCKOUT','E6c_NODETRACE_ENTITY_INTERIM_FINDINGS',
         'E6c_NODETRACE_INSTALLED_NEXT_ENTITY_PROOF','E6c_NODETRACE_INSTALLED_VITE_ENTITY_PROOF',
         'E6c_NODETRACE_MATCHED_ENTITY_VISUAL', 'E6c_NODETRACE_ENTITY_OWNER_KNOCKOUT',
         'E6c_NODETRACE_INSTALLED_NEXT_ENTITY_OWNER_PROOF', 'E6c_NODETRACE_INSTALLED_VITE_ENTITY_OWNER_PROOF',
         'E6c_NODETRACE_ENTITY_CANONICAL_EDGE_FINDING', 'E6c_NODETRACE_MATCHED_CANONICAL_VISUAL']
for name in reports:
    assert (packet/(name+'.json')).is_file() and (packet/(name+'.md')).is_file(),name
selected={}
def include(p, rel=None):
    rel=Path(rel or p.relative_to(packet))
    if rel.suffix=='.md': rel=rel.with_name(rel.name+'.txt')
    assert not rel.is_absolute() and '..' not in rel.parts
    old=selected.get(rel.as_posix())
    assert old is None or old==p
    selected[rel.as_posix()]=p
def directory(p):
    for f in p.rglob('*'):
        if f.is_file():
            assert not f.is_symlink() and not getattr(f, 'is_junction', lambda:False)(), str(f)
            include(f)
for folder in ['E6c-nodetrace-entity-final-source', 'E6c-nodetrace-entity-canonical-source',
               'E6c-nodetrace-installed-owner-refresh', 'E6c-nodetrace-canonical-owner-knockout-01',
               'E6c-nodetrace-canonical-owner-knockout-02', 'E6c-nodetrace-independent-owner-knockout',
               'E6c-nodetrace-node-message-browser', 'E6c-nodetrace-node-message-browser-replay',
               'E6c-nodetrace-node-message-contract', 'E6c-nodetrace-owner-message-exact',
               'evidence/nodetrace-entity-inspection-02-before/primary-controls-boundary',
               'E6c-nodetrace-vite-built-route-before']:
    directory(packet/folder)
for name in reports:
    include(packet/(name+'.json'))
    include(packet/(name+'.md'),name+'.md.txt')
    data=json.loads((packet/(name+'.json')).read_text(encoding='utf-8'))
    for f,expected in data.get('artifacts',{}).items():
        p=Path(f)
        if not p.is_absolute():p=packet/p
        assert p.is_relative_to(packet),f
        actual=hashlib.sha256(p.read_bytes()).hexdigest()
        h=expected.get('sha256') if isinstance(expected,dict) else expected
        assert actual==h,(f,actual,h)
        include(p)
    for failure in data.get('rawFailedRuns',[]) + data.get('failedHarnessRuns',[]) + data.get('preservedHistoricalFailures',[]):
        if isinstance(failure,dict) and failure.get('directory'):
            directory(packet/failure['directory'])
for name in ['E6c_NODETRACE_ENTITY_REPAIR_PLAN.md','E6c_NODETRACE_VITE_BUILD_DISPOSITION.md']:
    include(packet/name,name+'.txt')
for name in ['E6c-nodetrace-final-package-check.log','E6c-nodetrace-entity-final-source.log',
             'E6c-nodetrace-vite-installer.log','E6c-nodetrace-vite-failed-entry.tsx.txt',
             'E6c-nodetrace-vite-failed-setup.json','E6c-nodetrace-vite-final-install.log',
             'E6c-nodetrace-vite-final-install.json','E6c-nodetrace-vite-final-install.mjs']:
    include(packet/name)
include(packet/'E6c-nodetrace-portable-README.md','README.md')
for name in ['E6c-nodetrace-independent-lock-audit.json','E6c-nodetrace-canonical-final-package-check.log','E6c-nodetrace-canonical-final-package-check.json',
             'E6c-nodetrace-preserve-restore-generated.py','E6c-nodetrace-package-final-evidence.py']:
    include(packet/name)
recovery=Path('D:/ProjectRecovery/nodetrace-entity-repair-20260905')
for phase in ['post-matched-before-final-check','post-final-package-check']:
    data=json.loads((recovery/phase/'receipt.json').read_text(encoding='utf-8'))
    for rel,row in data['files'].items():
        f=recovery/phase/rel
        assert hashlib.sha256(f.read_bytes()).hexdigest()==row['capturedSha256']
        include(f,'generated/'+phase+'/'+rel)
    include(recovery/phase/'receipt.json','generated/'+phase+'/receipt.json')
manifest={}
for rel,p in sorted(selected.items()):
    assert not p.is_symlink() and p.is_file(), str(p)
    dest=out/rel;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,dest)
    b=p.read_bytes();assert b==dest.read_bytes()
    manifest[rel]={'sha256':hashlib.sha256(b).hexdigest(),'bytes':len(b),'original':str(p)}
record={'proof':'NODETRACE-ENTITY-INSPECTION-02','status':'FROZEN_AWAITING_FINAL_JUDGE',
        'artifactCount':len(manifest),'artifactBytes':sum(v['bytes'] for v in manifest.values()),
        'artifacts':manifest,'sourceHashes':json.loads((packet/'E6c-nodetrace-entity-canonical-source/receipt.json').read_text(encoding='utf-8'))['sourceHashes'],
        'grades': {k:None for k in ['visual','design','responsive','interaction','accessibility','performance','usage','alignment']},
        'packageCheck': {'command':'npm run check','exitCode':0,'receipt':'E6c-nodetrace-canonical-final-package-check.json','transientInstallerDisclosure':'Normal unchanged installer smoke used its default disposable consumer. No retained-consumer claim is made for that check; separately retained Next/Vite owner consumers provide installed browser evidence.'},
        'historicalPaths': 'Raw reports retain original operator paths and prose as evidence; portable paths are the manifest keys. No dependency on those original paths to inspect copied artifacts.',
        'rawMarkdownPolicy':'Historical judge and plan prose is retained byte-exact as .md.txt; README/HANDOFF remain current citation-checked documentation.'}
(out/'manifest.json').write_text(json.dumps(record,indent=2)+'\n',encoding='utf-8',newline='\n')
print(json.dumps({k:record[k] for k in ['artifactCount','artifactBytes','status']}))
