import { useEffect, useRef, useState } from "react";
import { useTraceLens, type SurfaceHit, type TraceCoachState } from "./trace";

export type CoachTab = "overview" | "steps" | "flow" | "raw";
export const coachTabs: CoachTab[] = ["overview", "steps", "flow", "raw"];
const lensKeys = { surfaceId: "surface", artifactId: "artifact", elementId: "element", targetRef: "target" } as const;

function readSelection() {
  const params = new URL(window.location.href).searchParams;
  const tab = params.get("tab") as CoachTab;
  const surfaceId = params.get("surface");
  const hit = surfaceId ? Object.fromEntries(Object.entries(lensKeys).flatMap(([key, param]) => {
    const value = params.get(param);
    return value && value.length <= 256 ? [[key, value]] : [];
  })) as unknown as SurfaceHit : null;
  return { step: params.get("step"), tab: coachTabs.includes(tab) ? tab : "overview" as CoachTab, hit: hit?.surfaceId ? hit : null };
}

function writeSelection(values: Record<string, string | null>, replace = false) {
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(values)) {
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  }
  if (url.href !== window.location.href) window.history[replace ? "replaceState" : "pushState"](window.history.state, "", url);
}

const signature = (hit: SurfaceHit | null) => hit ? JSON.stringify(Object.keys(lensKeys).map((key) => hit[key as keyof SurfaceHit] ?? null)) : "";

// Demo routing only. Installed hosts keep their own router and the existing lens API.
export function useDemoNavigation(coach: TraceCoachState | undefined, ready: boolean) {
  const { open, hit, openHit, close } = useTraceLens();
  const [selection, setSelection] = useState(readSelection);
  const pendingLens = useRef<string | null>(signature(selection.hit));
  const currentLens = useRef("");

  useEffect(() => {
    const restore = () => {
      const next = readSelection();
      setSelection(next);
      if (!ready) return;
      const wanted = signature(next.hit);
      pendingLens.current = currentLens.current === wanted ? null : wanted;
      if (next.hit) openHit(next.hit);
      else close();
    };
    restore();
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, [close, openHit, ready]);

  useEffect(() => {
    if (!ready) return;
    const next = open ? hit : null;
    currentLens.current = signature(next);
    if (pendingLens.current !== null) {
      if (pendingLens.current === currentLens.current) pendingLens.current = null;
      return;
    }
    writeSelection(Object.fromEntries(Object.entries(lensKeys).map(([key, param]) => [param, next?.[key as keyof SurfaceHit] ?? null])));
  }, [hit, open, ready]);

  useEffect(() => {
    if (!coach) return;
    const step = coach.steps.find((entry) => entry.id === selection.step)?.id
      ?? coach.steps.find((entry) => entry.id === coach.activeStepId)?.id ?? coach.steps[0]?.id ?? null;
    if (step !== selection.step) setSelection((current) => ({ ...current, step }));
    // Normalize an invalid deep link only after its actual dataset is available.
    writeSelection({ step, tab: selection.tab === "overview" ? null : selection.tab }, true);
  }, [coach, selection.step, selection.tab]);

  const select = (step: string | null, tab: CoachTab) => {
    setSelection((current) => ({ ...current, step, tab }));
    writeSelection({ step, tab: tab === "overview" ? null : tab });
  };
  return {
    step: selection.step,
    tab: selection.tab,
    selectStep: (step: string, tab: CoachTab = "overview") => select(step, tab),
    selectTab: (tab: CoachTab) => select(selection.step, tab),
  };
}
