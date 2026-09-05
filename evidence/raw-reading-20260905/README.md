# Raw trace reading proof

A developer comparing a trace value with its entity can read the complete JSON in a named, keyboard-focusable scroll region and reach the graph without scrolling through the entire payload. The two runtime edits preserve JSON content, graph behavior, styling and native browser scrolling.

The independent final verdict is **APPROVED_SCOPED_RUNTIME_WITH_CAPTURE_LIMITATION**. See [the exact judgment](E6d_NODETRACE_RAW_FINAL_JUDGE.md.txt), [machine judgment](E6d_NODETRACE_RAW_FINAL_JUDGE.json) and [exact manifest](manifest.json). The source was reviewed on canonical base `04891604227ab607a61557f49f2cdb41b28dd338`; the manifest binds the three reviewed working files. Commit identity is supplied by Git, not invented inside an earlier run.

- Source: 312 checks and 25 captured states across eleven viewport, component-text and motion cells, including a 60-second reading session, state recovery, history and entity comparison.
- Normally installed and built Next consumer: 104 checks and eight states, with 53 protected inputs. The normal sample has four traces and no coach; this reading test explicitly routes a recorded six-event coach and its 19 exact attachments. It does not claim the installer generated that fixture.
- Independent final review: 187 replay checks, 11 captured states, 170 custody checks and 20 viewed PNGs. At 1024 pixels the recorded document shrank from 4269 to 2269 pixels. At 390 pixels Raw shrank from 3214.5 to 548.59375 pixels.
- Scoped observations: D4 Information density improves from 3 to 4; R3 Canvas and panel adaptation from 3 to 5 within the Raw panel scope. D3 Progressive disclosure remains 3 for mobile setup prominence. Final dimension and overall grades remain unscored.

## Reproduce

From the source repository, run `npm ci`, `npx playwright install chromium` and `npm run build`, then the replay below. The existing Linux CI uses `npx playwright install --with-deps chromium` to provision the browser's system dependencies as well.

```sh
node scripts/raw-reading-proof.mjs evidence/raw-reading-20260905/E6d-nodetrace-raw-before /absolute/path/to/new-proof
```

For an ordinarily installed and built Next consumer, add its absolute directory and the complete attachment packet as the third and fourth arguments:

```sh
node scripts/raw-reading-proof.mjs evidence/raw-reading-20260905/E6d-nodetrace-raw-before /absolute/path/to/new-installed-proof /absolute/path/to/normal-next-consumer evidence/raw-reading-20260905/E6d-nodetrace-raw-installed-accepted
```

Use a new output directory. The script owns temporary local servers; do not run concurrent builds. The accepted source run used the retained `E6d-raw-proof-source-accepted.mjs.txt`; the current script adds consumer fixture/custody support without changing runtime bytes. The historical producer fixture is bound by the before packet, and routed input is explicitly labelled.

## Limits and preserved failures

The 1440-pixel full-page screenshot operation changed the unchanged command-row wrapping under both old and new Raw CSS. Its earlier DOM positions must not be treated as same-frame full-page geometry. The independent viewport-only 1440 comparison passed 22 checks. See [capture diagnosis](E6d-nodetrace-raw-1440-capture-cause/report.json) and [corrected viewport proof](E6d-nodetrace-raw-final-judge-layout-viewport1440/report.json).

Completed native scrolling waits for `scrollend`; rapidly interrupting End with Home can be swallowed by Chromium even without application scripts. No application key handler hides that browser behavior. Earlier locator failures, incomplete fixture attachment 404s and capture/probe failures are retained unchanged and explained by the causal judgments. The existing sidebar still determines part of desktop card height. Component text was doubled only inside Raw; this is not browser zoom. Physical devices, human usability, assistive technology and current performance were not certified by this slice.

Historical Markdown is stored as `.md.txt` so its original paths and prose remain raw evidence rather than current onboarding instructions. The manifest maps each exact copy back to its original reference. Shared integration is recorded separately after normal CI.
