import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { LensMode, SurfaceHit, TraceLensState } from "./types";

interface TraceLensApi extends TraceLensState {
  openHit: (hit: SurfaceHit) => void;
  close: () => void;
  setMode: (mode: LensMode) => void;
}

const TraceLensContext = createContext<TraceLensApi | null>(null);

const surfaceSelector = "[data-nodetrace-surface],[data-noderoom-surface]";
const refSelector = "[data-element-id],[data-artifact-id],[data-target-ref]";

export function resolveTraceHit(target: EventTarget | null): SurfaceHit | null {
  if (!(target instanceof Element)) return null;
  const node = target.closest(surfaceSelector);
  if (!node) return null;
  const surfaceId = node.getAttribute("data-nodetrace-surface") ?? node.getAttribute("data-noderoom-surface");
  if (!surfaceId) return null;

  const refNode = target.closest(refSelector);
  const scope = refNode && node.contains(refNode) ? refNode : node;
  return {
    surfaceId,
    artifactId: scope.getAttribute("data-artifact-id") ?? node.getAttribute("data-artifact-id") ?? undefined,
    elementId: scope.getAttribute("data-element-id") ?? undefined,
    targetRef: scope.getAttribute("data-target-ref") ?? undefined,
  };
}

export function TraceLensProvider({
  builderCapable = false,
  children,
  enabled = true,
}: {
  builderCapable?: boolean;
  children: ReactNode;
  enabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [hit, setHit] = useState<SurfaceHit | null>(null);
  const [mode, setModeRaw] = useState<LensMode>("review");

  const openHit = useCallback((nextHit: SurfaceHit) => {
    setHit(nextHit);
    setOpen(true);
  }, []);
  const close = useCallback(() => setOpen(false), []);
  const setMode = useCallback(
    (nextMode: LensMode) => setModeRaw(nextMode === "builder" && !builderCapable ? "review" : nextMode),
    [builderCapable],
  );

  useEffect(() => {
    if (!enabled) return;
    const onClick = (event: MouseEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey || event.button !== 0) return;
      const resolved = resolveTraceHit(event.target);
      if (!resolved) return;
      event.preventDefault();
      event.stopPropagation();
      openHit(resolved);
    };
    window.addEventListener("click", onClick, true);
    return () => window.removeEventListener("click", onClick, true);
  }, [enabled, openHit]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      // A native modal owns Escape, including when another dialog is above it.
      if (event.key === "Escape" && !document.querySelector(":modal")) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const value = useMemo<TraceLensApi>(
    () => ({
      open,
      hit,
      mode: builderCapable ? mode : "review",
      builderCapable,
      openHit,
      close,
      setMode,
    }),
    [builderCapable, close, hit, mode, open, openHit, setMode],
  );

  return <TraceLensContext.Provider value={value}>{children}</TraceLensContext.Provider>;
}

export function useTraceLens(): TraceLensApi {
  const context = useContext(TraceLensContext);
  if (!context) throw new Error("useTraceLens must be used within TraceLensProvider");
  return context;
}
