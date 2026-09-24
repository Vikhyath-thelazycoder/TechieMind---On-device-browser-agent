# TechyMind Implementation Plan

**Project:** TechyMind — Privacy-First Autonomous Browser Agent  
**Document ID:** IMPL-PLAN-01  
**Date:** September 2026  
**Lead Engineer:** Principal AI Systems & Security Architect  

---

## 1. Plan Overview & Priority Tiers

This implementation plan coordinates all required enhancements across five distinct priorities:
- **P0**: Privacy / Security / SIH Compliance (Fail-closed gates, PII integrity, CoT suppression)
- **P1**: Core Agent Reliability & Cross-Browser (Firefox build, Ollama connection, CDP clicks)
- **P2**: TechyMind UX Transformation (Top navigation, Settings tab, Drag-and-drop Import JSON)
- **P3**: Video-Derived Features (Multilingual voice input, on-screen click ripple animation)
- **P4**: Polish & Comprehensive Verification (Residual branding removal, Playwright test suite)

---

## 2. Priority P0 — Privacy, Security & SIH Compliance

### Task P0.1: Hardened Fail-Closed Pre-Network Gate
- **Exact Files**:
  - `src/lib/privacy-firewall.js`
  - `src/lib/sih-mode.js`
  - `src/background/privacy-loop.js`
- **Existing Behavior**: Checks run on screen context; in some paths an incomplete envelope might log a warning rather than unconditionally aborting.
- **Target Behavior**: If any privacy check (`redactionOk`, `faceCoverageOk`, `visualPiiCoverageOk`, `textSanitized`) fails, `assertSafeForNetwork` throws `PrivacyBlockedError` and halts transmission immediately with zero byte leakage.
- **Implementation Method**: Enforce strict boolean assertions in `sanitizeScreenContext`; if `stats.faceDetectFailed` or `stats.ocrFailed` is true, immediately mark `verificationPassed: false` and return fail-closed blank fallback or throw.
- **Security Implications**: Eliminates silent privacy degradation.
- **Acceptance Criteria**: `security.test.js` passes with 100% assertions; network interception confirms no raw pixels escape.
- **Test Method**: Automated unit tests (`node TechyMindBench/security.test.js`) and Playwright network interception test.

### Task P0.2: Complete Chain-of-Thought (CoT) Suppression
- **Exact Files**:
  - `src/sidepanel/sidepanel.js` (`sanitizeStepText`, `renderIncomingStep`)
- **Existing Behavior**: `sanitizeStepText` uses heuristic keyword matching; unstructured model reasoning tokens longer than 70 chars could leak if they lack specific trigger prefixes.
- **Target Behavior**: No internal model reasoning, prompts, or raw thoughts are exposed to the user. All intermediate thinking steps are mapped strictly to safe, clean activity statuses (`Searching...`, `Reading page...`, `Extracting...`, `Running task...`, `Waiting for confirmation...`, `Completed`).
- **Implementation Method**: Rewrite `sanitizeStepText` to guarantee that whenever `type === 'thinking'` or `type === 'spin'`, the returned string is unconditionally chosen from the safe activity status whitelist.
- **Security Implications**: Protects user-facing UI from prompt injection artifacts, internal system prompts, and confusing raw reasoning.
- **Acceptance Criteria**: Sidepanel transcript contains zero raw reasoning phrases; only safe activity status pills are rendered.
- **Test Method**: Playwright test asserting DOM content of `.step-text`.

---

## 3. Priority P1 — Core Agent Reliability & Cross-Browser

### Task P1.1: Firefox Build Identity & Compatibility
- **Exact Files**:
  - `scripts/build-firefox.mjs`
- **Existing Behavior**: `GECKO_ID` is set to legacy `opencomet-sih@opencomet.dev`.
- **Target Behavior**: `GECKO_ID` set to `techymind@techymind.dev`.
- **Implementation Method**: Update constant in `scripts/build-firefox.mjs`. Verify drift guards and run `npm run build:firefox`.
- **Security Implications**: Aligns Gecko extension identity with TechyMind product identity.
- **Acceptance Criteria**: `npm run build:firefox` compiles successfully to `dist/firefox/` without errors or guard drift.
- **Test Method**: CLI build execution and Playwright Firefox launch test.

---

## 4. Priority P2 — TechyMind UX Transformation

### Task P2.1: Top Navigation Alignment with Dedicated Settings Tab
- **Exact Files**:
  - `src/sidepanel/sidepanel.html`
  - `src/sidepanel/sidepanel.js`
  - `src/sidepanel/sidepanel.css`
- **Existing Behavior**: Header has `Agent`, `History`, and `New` buttons. Settings was placed on the privacy bar.
- **Target Behavior**: Top navigation features:
  - `Agent` (active view)
  - `History` (history view)
  - `Settings ↗` (opens `src/settings/settings.html` in dedicated browser tab via `chrome.runtime.openOptionsPage()`)
  - `New` chat button cleanly aligned on the right.
  Settings opens in a dedicated tab without replacing or destroying the active agent session.
- **Implementation Method**: Add `#topNavSettings` button to `.header-nav`; attach click handler invoking `chrome.runtime.openOptionsPage()`.
- **Acceptance Criteria**: Clicking Settings in top nav opens dedicated tab; active agent state in side panel is completely preserved.
- **Test Method**: Playwright click test on `#topNavSettings`.

### Task P2.2: Modern Drag-and-Drop Import JSON Experience
- **Exact Files**:
  - `src/settings/settings.html`
  - `src/settings/settings.js`
  - `src/settings/settings.css`
- **Existing Behavior**: Simple hidden file input with a button.
- **Target Behavior**: Interactive drag-and-drop zone with visual hover feedback, file picker button, schema validation, error display for invalid JSON, and success confirmation modal.
- **Implementation Method**: Create `.drop-zone` element in `settings.html`; add `dragover`, `dragleave`, `drop` listeners in `settings.js`; parse JSON and validate required keys before saving to storage.
- **Acceptance Criteria**: Dropping a valid JSON file restores settings with toast confirmation; invalid file shows descriptive error message.
- **Test Method**: Playwright file drop and input simulation test.

---

## 5. Priority P3 — Video-Derived Features

### Task P3.1: Multilingual Voice Input (Speech-to-Text)
- **Exact Files**:
  - `src/sidepanel/sidepanel.html`
  - `src/sidepanel/sidepanel.js`
  - `src/sidepanel/sidepanel.css`
- **Existing Behavior**: Text-only input in `#taskInput`.
- **Target Behavior**: Microphone icon button in the input bar. Clicking toggles voice listening (Web Speech API `webkitSpeechRecognition`). Language selector allows toggling between English (`en-IN`), Hindi (`hi-IN`), and Kannada (`kn-IN`). Live voice transcript automatically populates `#taskInput`.
- **Implementation Method**: Check `window.webkitSpeechRecognition || window.SpeechRecognition`. Add recording pulse animation. On `result`, append transcript to `#taskInput`.
- **Security Implications**: Audio processing is handled by the browser's native speech engine.
- **Acceptance Criteria**: Microphone button toggles listening state; transcribed text appears in task input.
- **Test Method**: Mocked speech recognition test in browser.

### Task P3.2: Visual Click Ripple Indicator on Target Webpage
- **Exact Files**:
  - `src/content/agent.js`
  - `src/background/actions.js`
- **Existing Behavior**: Agent clicks elements without an animated localized coordinate indicator on the page.
- **Target Behavior**: Upon executing a click action, an expanding crimson ripple circle is rendered at `(x, y)` target coordinates on the target webpage for 700ms.
- **Implementation Method**: In `src/content/agent.js`, inject `createClickRipple(x, y)` creating a keyframe-animated DOM circle. Call via message or content script injection during `actions.js` click execution.
- **Acceptance Criteria**: Clicks display a visible expanding pulse at the element position.
- **Test Method**: Browser visual inspection and Playwright verification.

---

## 6. Priority P4 — Polish, Branding Audit & Comprehensive Verification

### Task P4.1: Eradication of Residual User-Facing Old Branding
- **Exact Files**:
  - `src/content/agent.js` ("Open Comet is working" → "TechyMind is working")
  - `src/lib/prompts.js` ("You are Open Comet" → "You are TechyMind")
  - `src/lib/tab-sandbox.js` ("Open Comet Task" → "TechyMind Task")
  - `src/sidepanel/sidepanel.html` (`exportFolderInput` placeholder)
  - `docs/` guides and READMEs
- **Target Behavior**: Zero unintended user-facing `OpenComet` strings remain.
- **Test Method**: Python regex scanner across all `.js`, `.html`, `.css`, and `.md` files.

### Task P4.2: Playwright Verification Suite (24 Test Items + Network Privacy)
- **Exact Files**:
  - `tests/playwright/techymind.spec.js`
  - `tests/playwright/network-privacy.spec.js`
- **Target Behavior**: Comprehensive automated test coverage validating extension launch, branding, home layout, mode selector, settings tab, privacy wall, live inspector, import JSON, export, light/dark themes, and network intercept privacy.
- **Test Method**: `npx playwright test` executing against Chromium and Firefox.
