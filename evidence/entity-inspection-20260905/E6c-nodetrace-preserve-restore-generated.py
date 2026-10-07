from pathlib import Path
import sys,json,hashlib,shutil,subprocess,datetime
root=Path('D:/VSCode Projects/cafecorner_nodebench/nodebench_ai4/NodeTrace')
recovery=Path('D:/ProjectRecovery/nodetrace-entity-repair-20260905')
original=recovery/'pre-final-journey'
phase=sys.argv[1]
assert phase in ['post-matched-before-final-check','post-final-package-check']
dest=recovery/phase
assert not dest.exists()
manifest=json.loads((original/'manifest.json').read_text(encoding='utf-8'))
assert len(manifest)==61
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
source=json.loads((Path(__file__).parent/'E6c-nodetrace-entity-canonical-source/receipt.json').read_text(encoding='utf-8'))['sourceHashes']
for rel,h in source.items():assert sha(root/rel)==h,rel
rows={}
for rel,expected in manifest.items():
 for base in [original,root]:
  target=base/rel;assert target.resolve().is_relative_to(base.resolve())
  for part in [target,*list(target.parents)[:len(Path(rel).parts)-1]]:
   assert not part.is_symlink() and not (part.stat().st_file_attributes & 0x400),str(part)
 assert sha(original/rel)==expected,rel
 backup=dest/rel;backup.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(root/rel,backup)
 assert sha(root/rel)==sha(backup)
 rows[rel]={'capturedSha256':sha(backup),'bytes':backup.stat().st_size,'restoredSha256':expected}
for rel,expected in manifest.items():
 shutil.copyfile(original/rel,root/rel);assert sha(root/rel)==expected
for rel,h in source.items():assert sha(root/rel)==h,rel
record={'phase':phase,'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'capturedFileCount':len(rows),'restoredFileCount':len(rows),'captureBytes':sum(v['bytes'] for v in rows.values()),'scope':'Only the 61 named pre-final-journey generated files, preserving current bytes first. No source reset/deletion and no generated extra-file deletion.','sourceHashesUnchanged':True,'sourceHashes':source,'files':rows}
(dest/'receipt.json').write_text(json.dumps(record,indent=2)+'\n',encoding='utf-8',newline='\n')
print(json.dumps({k:record[k] for k in ['phase','capturedFileCount','restoredFileCount','captureBytes','sourceHashesUnchanged']}))
