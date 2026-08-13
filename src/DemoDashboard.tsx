import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowRight, CheckCircle2, CircleDot, Code2, Database, FileJson, Image, Layers3, ListChecks, Map, Network, Play, Route, Terminal } from "lucide-react";
import { TraceLensPanel, TraceLensProvider, type NodeTraceState, type TraceCoachState, type TraceCoachStep } from "./trace";
import { LiveGraphRail } from "./trace/LiveGraphRail";

type CoachTab = "overview" | "steps" | "flow" | "raw";

const seedState: NodeTraceState = {
  generatedAt: "loading",
  session: {
    id: "loading",
    title: "NodeTrace local happy path",
    status: "loading",
    summary: "Loading public/nodetrace-state.json",
  },
  builderCapable: false,
  surfaces: [],
  proofs: [],
  traces: [],
  codeOwnership: [],
};

export function DemoDashboard() {
  const [state, setState] = useState<NodeTraceState>(seedState);
  const [activeCoachStepId, setActiveCoachStepId] = useState<string | null>(null);
  const [coachTab, setCoachTab] = useState<CoachTab>("overview");
  const coach = state.coach;
  const activeCoachStep = useMemo(
    () => coach?.steps.find((step) => step.id === activeCoachStepId) ?? coach?.steps.find((step) => step.id === coach.activeStepId) ?? coach?.steps[0],
    [activeCoachStepId, coach],
  );

  useEffect(() => {
    fetch("./nodetrace-state.json", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : seedState))
      .then((nextState: NodeTraceState) => setState(nextState))
      .catch(() => setState(seedState));
  }, []);

  const heroStats = useMemo(
    () => [
      { detail: coach?.sourceMode === "live" ? "latest full" : "local checkout", label: "Source app", value: "NodeRoom" },
      { detail: "ordered labels", label: "Coach steps", value: String(coach?.steps.length ?? 0) },
      { detail: "overview, steps, minimap, raw", label: "Trace tabs", value: "4" },
    ],
    [coach],
  );
  return (
    <TraceLensProvider builderCapable={state.builderCapable}>
      <main className="shell">
        <section className="workspace">
          <header className="showcase" data-nodetrace-surface="shell.statusStrip">
            <div className="showcaseCopy">
              <p className="eyebrow">
                <Route size={13} aria-hidden="true" /> NodeRoom codebase trace
              </p>
              <h1>Portable trace UI for agent apps.</h1>
              <p>{state.session.summary}</p>
              <div className="showcaseActions">
                <div className="command">
                  <Terminal size={15} aria-hidden="true" />
                  <code>npm run understand:noderoom</code>
                </div>
                <div className="command">
                  <Terminal size={15} aria-hidden="true" />
                  <code>npm run capture:noderoom:real</code>
                </div>
                <div className="command">
                  <Terminal size={15} aria-hidden="true" />
                  <code>npm run trace-coach:sqlite</code>
                </div>
                <span className="sourcePill">
                  <CircleDot size={13} aria-hidden="true" /> no API key required
                </span>
              </div>
            </div>
            <aside className="launchCard" aria-label="Trace Coach launch path">
              <div className="launchHead">
                <span>Live sample</span>
                <strong>{state.session.status}</strong>
              </div>
              <div className="launchFlow" aria-label="SQLite to trace UI flow">
                <span><Database size={14} aria-hidden="true" /> SQLite</span>
                <ArrowRight size={14} aria-hidden="true" />
                <span><Layers3 size={14} aria-hidden="true" /> NodeRoom trace</span>
                <ArrowRight size={14} aria-hidden="true" />
                <span><Play size={14} aria-hidden="true" /> browser UI</span>
              </div>
              <div className="heroStats">
                {heroStats.map((stat) => (
                  <div key={stat.label}>
                    <span>{stat.label}</span>
                    <strong>{stat.value}</strong>
                    <small>{stat.detail}</small>
                  </div>
                ))}
              </div>
              <div className="launchCheck">
                <CheckCircle2 size={15} aria-hidden="true" />
                <span>Seeded from real NodeRoom files, code-browser captures, selectors, DOMRects, running-app screenshots, and flow metadata.</span>
              </div>
            </aside>
          </header>

          {coach && activeCoachStep ? (
            <TraceCoachPanel
              activeStep={activeCoachStep}
              activeTab={coachTab}
              coach={coach}
              setActiveTab={setCoachTab}
              setActiveStepId={setActiveCoachStepId}
            />
          ) : null}

          {state.traces.length > 0 ? <LiveGraphRail traces={state.traces} /> : null}

        </section>
      </main>

      <TraceLensPanel state={state} />
    </TraceLensProvider>
  );
}

function TraceCoachPanel({
  activeStep,
  activeTab,
  coach,
  setActiveTab,
  setActiveStepId,
}: {
  activeStep: TraceCoachStep;
  activeTab: CoachTab;
  coach: TraceCoachState;
  setActiveTab: (tab: CoachTab) => void;
  setActiveStepId: (stepId: string) => void;
}) {
  const sourceModeLabel = coach.sourceMode === "live" ? "latest full live checkout" : "full local checkout";
  const activeNodeId = activeStep.diagram.nodeId;
  const rect = activeStep.uiCapture.rect;
  const tabs: Array<{ id: CoachTab; label: string; Icon: typeof ListChecks }> = [
    { id: "overview", label: "Overview", Icon: ListChecks },
    { id: "steps", label: "Steps", Icon: Code2 },
    { id: "flow", label: "Minimap", Icon: Network },
    { id: "raw", label: "Raw JSON", Icon: FileJson },
  ];
  const rawPayload = {
    sourceRepo: coach.sourceRepo,
    sourceMode: coach.sourceMode,
    activeStep,
    graph: {
      nodes: coach.graphNodes,
      edges: coach.graphEdges,
    },
  };

  return (
    <section className="coachPanel r-tracevu" data-nodetrace-surface={activeStep.surfaceId}>
      <aside className="coachList r-tracevu-list" aria-label="NodeRoom trace records">
        <div className="coachSource">
          <span>Source app</span>
          <strong>NodeRoom</strong>
          <small>
            {sourceModeLabel} - {coach.sourceRepo} - {coach.steps.length} guided steps
          </small>
        </div>
        {coach.steps.map((step) => (
          <button
            key={step.id}
            type="button"
            className="r-tracevu-rec"
            data-on={String(step.id === activeStep.id)}
            data-testid="trace-record"
            onClick={() => {
              setActiveStepId(step.id);
              setActiveTab("overview");
            }}
          >
            <span className="r-tracevu-rec-head">
              <Activity size={13} aria-hidden="true" />
              <span className="r-tracevu-rec-title">{step.title}</span>
              <span className="r-tracevu-pill" data-tone="ok">pass</span>
            </span>
            <span className="r-tracevu-rec-sub">{step.narrative}</span>
            <span className="r-tracevu-rec-meta">
              {step.group ?? "Trace"} - {step.stepLabel} - {step.codeBlock.filePath}
            </span>
          </button>
        ))}
      </aside>

      <div className="coachDetail r-tracevu-detail">
        <header className="r-tracevu-detail-head">
          <strong>{activeStep.title}</strong>
          <p>{activeStep.narrative}</p>
          <div className="r-tracevu-tabs" role="tablist" aria-label="NodeRoom trace detail">
            {tabs.map(({ id, label, Icon }) => (
              <button key={id} type="button" role="tab" aria-selected={activeTab === id} data-on={String(activeTab === id)} onClick={() => setActiveTab(id)}>
                <Icon size={12} aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
        </header>

        <div className="r-tracevu-detail-body">
          {activeTab === "overview" ? (
            <div className="coachOverview">
              <section className="coachPane codePane" aria-label="Code slice">
                <div className="paneTitle">
                  <Code2 size={17} aria-hidden="true" />
                  <span>{activeStep.sourceView.activeFile}</span>
                </div>
                <small>
                  {activeStep.sourceView.repositoryRoot} - lines {activeStep.sourceView.highlightStartLine}-{activeStep.sourceView.highlightEndLine}
                </small>
                <img className="evidenceShot ideShot" src={assetPath(activeStep.sourceView.imagePath)} alt={`Source capture for ${activeStep.sourceView.activeFile}`} />
              </section>

              <section className="coachPane uiPane" aria-label="UI capture">
                <div className="paneTitle">
                  <Image size={17} aria-hidden="true" />
                  <span>{activeStep.uiCapture.selector}</span>
                </div>
                <small>
                  DOMRect x{rect.x} y{rect.y} w{rect.width} h{rect.height}
                </small>
                <img className="evidenceShot uiShot" src={assetPath(activeStep.uiCapture.screenshotPath)} alt={activeStep.uiCapture.alt} />
              </section>
            </div>
          ) : null}

          {activeTab === "steps" ? (
            <div className="r-tracevu-groups">
              {Object.entries(groupCoachSteps(coach.steps)).map(([group, steps]) => (
                <details key={group} className="r-tracevu-group" open data-testid="trace-group">
                  <summary>
                    <span className="r-tracevu-group-name">{group}</span>
                    <span className="r-tracevu-group-count">{steps.length}</span>
                  </summary>
                  <ol className="r-tracevu-steps">
                    {steps.map((step) => (
                      <li key={step.id}>
                        <button type="button" className="r-tracevu-step" data-testid="trace-step" data-tone="ok" onClick={() => setActiveStepId(step.id)}>
                          <span className="r-tracevu-step-idx">{step.order}</span>
                          <span className="r-tracevu-step-body">
                            <span className="r-tracevu-step-label">{step.title}</span>
                            <span className="r-tracevu-step-detail">{step.narrative}</span>
                            <span className="r-tracevu-metrics">
                              <span><b>{step.codeBlock.filePath}</b> code</span>
                              <span><b>{step.uiCapture.selector}</b> selector</span>
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ol>
                </details>
              ))}
            </div>
          ) : null}

          {activeTab === "flow" ? (
            <section className="coachPane mapPane" aria-label="Trace coach flow">
              <div className="paneTitle">
                <Map size={17} aria-hidden="true" />
                <span>{activeStep.mapCapture.model}</span>
              </div>
              <small>
                {coach.graphNodes.length} nodes - {coach.graphEdges.length} edges - {activeStep.mapCapture.graphPath}
              </small>
              <img className="evidenceShot mapShot" src={assetPath(activeStep.mapCapture.imagePath)} alt={`Codebase minimap focused on ${activeStep.diagram.nodeId}`} />
              <div className="graphNodes">
                {coach.graphNodes.map((node) => (
                  <span key={node.id} className={node.id === activeNodeId ? "active" : ""}>
                    {node.label}
                  </span>
                ))}
              </div>
              <ol className="graphEdges" aria-label="Trace graph edges">
                {coach.graphEdges.map((edge) => (
                  <li key={edge.id}>{edge.from} {"->"} {edge.to}: {edge.label}</li>
                ))}
              </ol>
              <pre>{activeStep.diagram.source}</pre>
            </section>
          ) : null}

          {activeTab === "raw" ? (
            <pre className="r-tracevu-raw" data-testid="trace-raw">{JSON.stringify(rawPayload, null, 2)}</pre>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function groupCoachSteps(steps: TraceCoachStep[]): Record<string, TraceCoachStep[]> {
  return steps.reduce<Record<string, TraceCoachStep[]>>((groups, step) => {
    const group = step.group ?? "Trace";
    groups[group] = [...(groups[group] ?? []), step];
    return groups;
  }, {});
}

function assetPath(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
}
