import { Activity, ArrowUpRight, FileSearch, Lock, ShieldCheck, X } from "lucide-react";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import type { CodeOwnershipReceipt, NodeTraceState, TraceProof } from "./types";
import { useTraceLens } from "./TraceLensProvider";
import "./trace.css";

export function TraceLensPanel({
  onOpenSource,
  state,
}: {
  onOpenSource?: (proof: TraceProof) => void;
  state: NodeTraceState;
}) {
  const { builderCapable, close, hit, mode, open, setMode } = useTraceLens();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pointerStartedOutside = useRef(false);
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    const opener = document.activeElement;
    dialog.showModal();
    dialog.querySelector<HTMLButtonElement>(".nt-close")?.focus();
    return () => {
      dialog.close();
      if (opener instanceof HTMLElement && opener.isConnected && opener !== document.body) opener.focus();
      else (document.querySelector<HTMLButtonElement>("[data-trace-inspect]:not(:disabled)") ?? document.querySelector<HTMLElement>("main[tabindex]"))?.focus();
    };
  }, [open]);
  // Registry absence is a visible missing-data result, never fabricated proof.
  const meta = state.surfaces.find((surface) => surface.id === hit?.surfaceId) ?? null;

  if (!open || !hit) return null;

  const proofCards = filterByHit(state.proofs, hit.surfaceId, hit.artifactId, hit.elementId).slice(0, 6);
  const traceRows = filterByHit(state.traces, hit.surfaceId, hit.artifactId, hit.elementId).slice(-6).reverse();
  const ownership = state.codeOwnership.find((entry) => entry.surfaceId === hit.surfaceId) ?? null;

  return (
      <dialog ref={dialogRef} className="nt-panel" role="dialog" aria-modal="true" aria-label={`Trace Lens: ${meta?.label ?? "Surface unavailable"}`} onCancel={(event) => { event.preventDefault(); close(); }} onPointerDown={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        pointerStartedOutside.current = event.button === 0 && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom);
      }} onPointerCancel={() => { pointerStartedOutside.current = false; }} onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (pointerStartedOutside.current && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) close();
        pointerStartedOutside.current = false;
      }} onKeyDown={(event) => {
        if (event.key !== "Tab" || event.altKey || event.ctrlKey || event.metaKey) return;
        const controls = [...event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), a[href]")].filter((node) => node.tabIndex >= 0 && node.getClientRects().length > 0);
        const first = controls[0], last = controls[controls.length - 1];
        const destination = event.shiftKey && document.activeElement === first ? last : !event.shiftKey && document.activeElement === last ? first : null;
        // Native modal inertness protects the page; wrap endpoints so Tab does not enter browser chrome.
        if (destination) { event.preventDefault(); destination.focus(); }
      }}>
        <header className="nt-head">
          <FileSearch size={15} aria-hidden="true" />
          <strong>{meta?.label ?? "Surface unavailable"}</strong>
          {builderCapable ? (
            <div className="nt-modes" role="group" aria-label="Trace Lens mode">
              <button type="button" aria-pressed={mode === "review"} data-on={String(mode === "review")} onClick={() => setMode("review")}>
                Review
              </button>
              <button type="button" aria-pressed={mode === "builder"} data-on={String(mode === "builder")} onClick={() => setMode("builder")}>
                Builder
              </button>
            </div>
          ) : null}
          <button type="button" className="nt-close" onClick={close} aria-label="Close Trace Lens">
            <X size={15} aria-hidden="true" />
          </button>
        </header>

        <div className="nt-body">
          <p className="nt-about">{meta?.about ?? `No registry entry is available for “${hit.surfaceId}” in this state file. Regenerate or load the matching trace data.`}</p>
          {(hit.elementId || hit.artifactId) ? <p className="nt-about">Showing matching records where available; otherwise these records describe the surrounding surface. This selection does not verify the exact element.</p> : null}

          <TraceRegion icon={<ShieldCheck size={13} aria-hidden="true" />} title="Business proof">
            {proofCards.length > 0 ? (
              proofCards.map((proof) => (
                <article key={proof.id} className="nt-proof" data-status={proof.status}>
                  <div className="nt-proofHead">
                    <strong>{proof.title}</strong>
                    <span>{proof.status.replace(/_/g, " ")}</span>
                  </div>
                  <p>{proof.detail}</p>
                  <footer>
                    <span>{proof.sourceLabel} - {Math.round(proof.confidence * 100)}%</span>
                    {proof.sourceUrl ? (
                      <a href={proof.sourceUrl} target="_blank" rel="noreferrer">
                        Open source <ArrowUpRight size={12} aria-hidden="true" />
                      </a>
                    ) : onOpenSource ? (
                      <button type="button" onClick={() => onOpenSource(proof)}>
                        Open source <ArrowUpRight size={12} aria-hidden="true" />
                      </button>
                    ) : <span>Source opening is unavailable in this host.</span>}
                  </footer>
                </article>
              ))
            ) : (
              <p className="nt-empty">
                {meta?.proofAvailable ? "No business proof is attached to this surface yet." : meta ? "This surface does not publish business proof." : "Business proof availability is unknown for this unregistered surface."}
              </p>
            )}
          </TraceRegion>

          <TraceRegion icon={<Activity size={13} aria-hidden="true" />} title="Runtime trace">
            {traceRows.length > 0 ? (
              <ol className="nt-traces">
                {traceRows.map((trace) => (
                  <li key={trace.id}>
                    <span>{trace.phase}</span>
                    <strong>{trace.summary}</strong>
                    <em>{trace.actor} - {trace.durationMs}ms</em>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="nt-empty">No recent runtime trace rows for this surface.</p>
            )}
          </TraceRegion>

          <TraceRegion icon={<Lock size={13} aria-hidden="true" />} title="Code ownership">
            {builderCapable && mode === "builder" && ownership ? (
              <CodeOwnership ownership={ownership} />
            ) : (
              <p className="nt-empty nt-locked">
                Builder access only. Component, query, mutation, skill, and test ownership must come from a privileged server route.
              </p>
            )}
          </TraceRegion>
        </div>
      </dialog>
  );
}

function TraceRegion({ children, icon, title }: { children: ReactNode; icon: ReactNode; title: string }) {
  return (
    <section className="nt-region">
      <div className="nt-regionHead">
        {icon}
        {title}
      </div>
      {children}
    </section>
  );
}

function CodeOwnership({ ownership }: { ownership: CodeOwnershipReceipt }) {
  return (
    <dl className="nt-owner">
      <div>
        <dt>Owner</dt>
        <dd>{ownership.ownerLabel}</dd>
      </div>
      <div>
        <dt>Component</dt>
        <dd>{ownership.componentRef}</dd>
      </div>
      <div>
        <dt>Backend</dt>
        <dd>{ownership.backendRef}</dd>
      </div>
      <div>
        <dt>Query</dt>
        <dd>{ownership.queryRef}</dd>
      </div>
      <div>
        <dt>Mutation</dt>
        <dd>{ownership.mutationRef}</dd>
      </div>
      <div>
        <dt>Skill</dt>
        <dd>{ownership.skillRef}</dd>
      </div>
      <div>
        <dt>Test</dt>
        <dd>{ownership.testRef}</dd>
      </div>
    </dl>
  );
}

function filterByHit<T extends { surfaceId: string; artifactId?: string; elementId?: string }>(
  rows: T[],
  surfaceId: string,
  artifactId?: string,
  elementId?: string,
) {
  const exact = rows.filter((row) => {
    if (row.surfaceId !== surfaceId) return false;
    if (elementId && row.elementId !== elementId) return false;
    if (artifactId && row.artifactId !== artifactId) return false;
    return true;
  });
  return exact.length > 0 ? exact : rows.filter((row) => row.surfaceId === surfaceId);
}
