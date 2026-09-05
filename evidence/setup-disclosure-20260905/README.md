# Setup disclosure and current trace inspection

A developer opening a saved trace can reach the first records on a phone and reveal setup when needed. The native Setup and trace provenance disclosure starts closed. Current status, errors, Retry and Inspect remain visible. The header and first Inspect action use the selected coach step's actual registered surface; the normal installed sample retains its existing Status entry.

The [independent final judgment](E6e_NODETRACE_DISCLOSURE_FINAL_JUDGE.md.txt) approves this scoped repair with a capture limitation. The exact [machine judgment](E6e_NODETRACE_DISCLOSURE_FINAL_JUDGE.json) and [manifest](manifest.json) bind all seven reviewed files, original inputs, before/after pixels, preserved failures and the source/installed contracts.

- Source: 92 checks and 15 captures; normal installed Next: 79 checks and 15 captures. Both independently replayed with the same results. The source uses the exact six-event before input; the fresh normal installed app has its own generated four-event sample without a coach.
- The ordinary final Next installer completes all four phases in 106655ms. Its 53 protected inputs and exact source-to-installed transformations remain unchanged during browser proof. Original consumers are preserved.
- Independent causal/host checks pass 14; a single desktop capture follow-up passes six; source/metadata custody passes 33. At 390 pixels the source header shrinks from 939.66 to 325.75 pixels, and installed from 802.19 to 303.25. Native keyboard, resize, selected Raw/entity/history and loading/error/Retry behavior pass. Provenance text wraps at actual doubled header text.
- Scoped D3 Progressive disclosure moves from observed 3 to 5. Other criteria are not rescored. Full criterion/dimension/overall grades and the 4.5 readiness target remain open.

## Replay

Use a fresh isolated checkout of this reviewed source, Node22, `npm ci` and `npx playwright install chromium`. On Linux use `npx playwright install --with-deps chromium`. Preserve any existing checkout's owner state; run the preparation below only in the fresh isolated checkout.

This is a recorded-input replay. The proof compares exact source-input bytes with the retained before artifact. Git's committed snapshot normalizes line endings to LF; the recorded input contains CRLF. They represent the same JSON, but only the recorded bytes satisfy this oracle. Copy the portable recorded input before building; the build copies those exact bytes into dist. This intentionally prepares the local fixture and does not change the committed snapshot or claim a fresh external capture.

```sh
node -e "require('node:fs').copyFileSync('evidence/setup-disclosure-20260905/E6e-nodetrace-disclosure-before/source-actual-input.json', 'public/nodetrace-state.json')"
npm run build
node scripts/setup-disclosure-proof.mjs evidence/setup-disclosure-20260905/E6e-nodetrace-disclosure-before /absolute/path/to/new-source-proof
```

For a new normal Next consumer, run the existing `npm run installer:next:e2e` with `NODETRACE_KEEP_E2E_TARGET=1`, keep its returned directory, and add that absolute directory as the third argument to the same proof command. The proof verifies the consumer's current source/style transformations and its actual sample; it never substitutes a coach into normal installed cases. Use a fresh output directory. The proof owns local servers; do not run concurrent builds. Loading, error and empty scenarios are explicitly routed local fixtures, not provider incidents.

## Limits and preserved corrections

One independent installed1440 screenshot has a blank graph region. Its cause is unknown, and its DOM checks do not certify pixels. A single fresh unchanged viewport visibly shows the graph. Transparent direct WebGL exports also fail to represent the painted native screenshot. See the [capture observation](E6e-nodetrace-disclosure-final-judge/installed-1440-capture/pixel-observation.json) and [fresh native viewport](E6e-nodetrace-disclosure-final-judge/installed-1440-capture/installed-1440-current-viewport.png). This does not claim all captures had a painted graph or certify rendering reliability at scale.

Earlier probe failures used the wrong entity locator, overlooked lens history entries, or expected the empty Next host announcer to disappear. The app's own load error clears after exactly two requests; the host announcer is separate and retained in the actual shadow-DOM observation. Root pixel review also caught enlarged provenance ellipsis, fixed by wrapping only these labels. The metadata judge caught a Windows text-encoding error; the two current documents were restored from explicit UTF-8 Git baselines and only their intended citations/header guidance reapplied. Bad copies and the earlier frozen receipt remain raw evidence.

The complete prior Raw payload and graph/data owners remain protected. Text enlargement applies to the header, not browser zoom or the whole app. Physical devices, assistive technology, fresh human usability, field performance and production are not certified. The isolated happy-path SQLite file stays local and is explicitly excluded from this packet; original owner state was not read or changed.
