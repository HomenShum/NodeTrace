import json,pathlib,hashlib,subprocess,os,datetime
P=pathlib.Path(r"C:/Users/hshum/.codex/worktrees/5dba/nodebench-ai/docs/plans/portfolio-recovery-20260904")
N=pathlib.Path(r"D:/VSCode Projects/cafecorner_nodebench/nodebench_ai4/NodeTrace")
C=pathlib.Path(r"C:/Users/hshum/AppData/Local/Temp/nodetrace-next-e2e-lU78sE")
O=P/"E6d-nodetrace-raw-final-judge"
O.mkdir(exist_ok=False)
def sha(b):return hashlib.sha256(b).hexdigest()
def read(p):return json.loads(p.read_text(encoding="utf-8-sig"))
def git(*a):return subprocess.check_output(["git","--no-optional-locks",*a],cwd=N)
def snap():return {"head":git("rev-parse","HEAD").decode().strip(),"tree":git("rev-parse","HEAD^{tree}").decode().strip(),"index":sha(git("ls-files","--stage","-z")),"refs":sha(git("for-each-ref","--format=%(refname) %(objectname)")),"status":git("status","--porcelain=v1","-z").decode()}
receipt=read(P/"E6d_NODETRACE_RAW_IMPLEMENTATION_RECEIPT.json")
before=snap();checks=[]; bindings={}
def check(name,ok,detail=None):
 checks.append({"name":name,"pass":bool(ok),"detail":detail})
 if not ok:raise AssertionError(name)
check("exact base and source branch",before["head"]==receipt["head"] and git("branch","--show-current").decode().strip()==receipt["branch"])
for name,b in receipt["sourceFiles"].items():
 raw=(N/name).read_bytes();bindings[str(N/name)]={"sha256":sha(raw),"bytes":len(raw)};check("frozen source "+name,sha(raw)==b["sha256"] and len(raw)==b["bytes"])
for name,h in receipt["evidenceRefs"].items():
 raw=(P/name).read_bytes();bindings[str(P/name)]={"sha256":sha(raw),"bytes":len(raw)};check("receipt artifact "+name,sha(raw)==h)
sr=read(P/"E6d-nodetrace-raw-source-accepted/report.json");cr=read(P/"E6d-nodetrace-raw-installed-accepted/report.json")
for name,r,num,caps in [("source",sr,312,25),("installed",cr,104,8)]:
 check(name+" actual claim counts and pass",r["ok"] and len(r["checks"])==num and len(r["captures"])==caps and all(c["pass"] for c in r["checks"]))
 for f,h in r["sourceHashes"].items():
  actual=sha((N/f).read_bytes()) if name=="installed" or f!="scripts/raw-reading-proof.mjs" else sha((P/"E6d-raw-proof-source-accepted.mjs.txt").read_bytes())
  check(name+" runtime binding "+f,actual==h and r["afterHashes"][f]==h)
for name,h in cr["installedBefore"].items():check("protected installed "+name,sha((C/name).read_bytes())==h==cr["installedAfter"][name])
check("53 consumer inputs",len(cr["installedBefore"])==53)
for name,b in cr["attachmentManifest"].items():
 raw=(P/"E6d-nodetrace-raw-installed-accepted/attachments"/pathlib.Path(name).name).read_bytes()
 check("19 exact source/Git attachment "+name,len(raw)==b["bytes"] and sha(raw)==b["sha256"] and raw==(N/"public"/name).read_bytes()==git("show","HEAD:public/"+name))
check("19 attachments counted",len(cr["attachmentManifest"])==19)
for name in ["actual","short","long"]:
 raw=(P/"E6d-nodetrace-raw-before"/(name+"-state.json")).read_bytes()
 check("exact retained fixture "+name,raw==(P/"E6d-nodetrace-raw-source-accepted"/(name+"-state.json")).read_bytes()==(P/"E6d-nodetrace-raw-installed-accepted"/(name+"-state.json")).read_bytes())
(P/"E6d_NODETRACE_RAW_FINAL_JUDGE_INITIAL_BINDINGS.json").write_text(json.dumps({"at":datetime.datetime.now(datetime.timezone.utc).isoformat(),"before":before,"checks":checks,"bindings":bindings},indent=2),encoding="utf-8")
runs=[]
for surface,cell in [("source","actual-390-no-preference"),("source","actual-1024-reduce-text200"),("source","long-390-no-preference"),("installed","short-390-no-preference"),("installed","long-1024-no-preference")]:
 env=os.environ.copy();env["NODETRACE_RAW_ONLY"]=cell
 out=O/(surface+"-"+cell)
 args=["node","scripts/raw-reading-proof.mjs",str(P/"E6d-nodetrace-raw-before"),str(out)]
 if surface=="installed":args.extend([str(C),str(P/"E6d-nodetrace-raw-installed-accepted")])
 proc=subprocess.run(args,cwd=N,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=150)
 (O/(surface+"-"+cell+".log")).write_bytes(proc.stdout)
 result={"surface":surface,"cell":cell,"exit":proc.returncode,"report":str(out/"report.json")}
 if (out/"report.json").exists():
  r=read(out/"report.json");result.update(ok=r["ok"],checks=len(r["checks"]),captures=len(r["captures"]),failure=r.get("failure"))
 runs.append(result);print(json.dumps(result),flush=True)
 (O/"runs.json").write_text(json.dumps(runs,indent=2),encoding="utf-8")
 if proc.returncode:break
after=snap()
for name,b in receipt["sourceFiles"].items():check("frozen source remains "+name,sha((N/name).read_bytes())==b["sha256"])
for name,h in cr["installedBefore"].items():check("protected installed remains "+name,sha((C/name).read_bytes())==h)
check("source HEAD index refs status unchanged",before==after)
(P/"E6d_NODETRACE_RAW_FINAL_JUDGE_BINDINGS.json").write_text(json.dumps({"at":datetime.datetime.now(datetime.timezone.utc).isoformat(),"before":before,"after":after,"checks":checks,"bindings":bindings,"runs":runs},indent=2),encoding="utf-8")
print(json.dumps({"allPass":all(x.get("ok") for x in runs),"runs":len(runs),"custodyChecks":len(checks)}),flush=True)

