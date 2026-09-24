# TechyMind Codebase Audit & System Forensics

**Project:** TechyMind — Privacy-First Autonomous Browser Agent  
**Base Architecture:** OpenComet / OpenCometAI Extension Architecture  
**Document ID:** TECHYMIND-AUDIT-01  
**Date:** September 2026  
**Auditor:** Lead AI Systems & Security Engineer  

---

## 1. Executive Summary

This forensic audit investigates the actual codebase located at `/Users/vikhyathmgowda007/Developer/ssssss/OpenCometAI`. The system is a Manifest V3 browser extension built with modern vanilla JavaScript (ES modules) designed for autonomous web browsing, deep multi-tab research, web data extraction, and visual webpage understanding with strict on-device privacy protection (zero raw pixel/DOM leakage before sanitization).

---

## 2. Extension Architecture & Entrypoints

### 2.1 Manifest Configuration (`manifest.json`)
- **Manifest Version**: 3
- **Name**: `TechyMind — Privacy-First Browser Agent` (`short_name`: `TechyMind`)
- **Background**: Service Worker module at `src/background/sw.js` (dynamic module imports supported in Chromium).
- **Side Panel**: Registered via `side_panel.default_path: "src/sidepanel/sidepanel.html"`.
- **Options UI**: Registered via `"options_ui": { "page": "src/settings/settings.html", "open_in_tab": true }`.
- **Content Scripts**: `src/content/agent.js` and `src/content/dom-detector.js` injected at `document_idle`.
- **Permissions**:
  - Chrome MV3: `activeTab`, `tabs`, `scripting`, `storage`, `sidePanel`, `debugger`, `tabGroups`, `notifications`, `downloads`, `offscreen`, `bookmarks`, `alarms`, `pageCapture`, `readingList`.
  - Host permissions: `<all_urls>`, `https://huggingface.co/*`, `https://cdn.jsdelivr.net/*`.
  - CSP: `script-src 'self' 'wasm-unsafe-eval'; connect-src 'self' https: http://127.0.0.1:* http://localhost:* data: blob:; worker-src 'self'; style-src 'self' 'unsafe-inline';`.

### 2.2 Core Modules & File Breakdown
| Subsystem | Key Files | Functionality |
| :--- | :--- | :--- |
| **Sidepanel UI** | `src/sidepanel/sidepanel.html`<br>`src/sidepanel/sidepanel.js`<br>`src/sidepanel/sidepanel.css` | User interface, chat-first stream, action cards, mode dropdown (Search/Deep Search/Scrape), model selection pill, live privacy stats, slash skill menu. |
| **Settings UI** | `src/settings/settings.html`<br>`src/settings/settings.js`<br>`src/settings/settings.css` | Dedicated options tab. AI & Models (Ollama, Compatible), Privacy & Vision (Privacy Wall, Live Inspector), Deep Research providers, Profile, Skills editor, Diagnostics, About card. |
| **Service Worker** | `src/background/sw.js`<br>`src/background/state.js` | Extension lifecycle, task state hydration, message routing (`START_AGENT`, `STOP_AGENT`, etc.), tab-group sandbox coordinator, keeper alarms. |
| **Agent Loops** | `src/background/sw.js` (standard loop)<br>`src/background/privacy-loop.js` (privacy loop) | Multi-step agent execution, planner/navigator/synthesizer/verifier roles, guardian authorization gate, fail-closed privacy checkpoints. |
| **Browser Actions** | `src/background/actions.js`<br>`src/content/dom-detector.js`<br>`src/content/agent.js` | Click, type, scroll, navigate, keypress, select, download, tab manage, CDP trusted clicks, DOM UID tagging, live overlay indicator. |
| **Privacy Firewall** | `src/lib/privacy-firewall.js`<br>`src/lib/privacy-agent.js`<br>`src/lib/sih-mode.js` | The fail-closed privacy boundary (`RAW SCREEN → NEVER NETWORK`). Sanitizes context into a cryptographically verified envelope, strips raw CSS selectors/labels/PII from manifest. |
| **PII & Vision** | `src/lib/pii-detector.js`<br>`src/lib/canvas-redactor.js`<br>`src/lib/mediapipe-face.js`<br>`src/lib/ocr-pii.js`<br>`src/lib/local-vision.js` | Deterministic regex (including full Indian PII suite: Aadhaar, PAN, Voter ID, Passport, DL, IFSC, UPI, GSTIN), canvas blurring/blackout, MediaPipe BlazeFace, Tesseract OCR for canvas/image PII. |
| **Model Providers** | `src/lib/providers.js`<br>`src/lib/local-llm.js`<br>`src/lib/local-llm-engine.js` | OpenAI-compatible APIs, Anthropic, Gemini, Groq, local Ollama runtime (`gemma3:12b`, `qwen2.5:7b`), in-browser WebGPU Transformers.js fallback. |
| **Research & Tools** | `src/lib/deepsearch.js`<br>`src/lib/browser-research.js`<br>`src/lib/skills.js`<br>`src/lib/export.js` | Multi-query query decomposition, parallel tab crawlers, HTML readable scraper, JSON/CSV/TXT/Markdown export. |
| **Offscreen Runtime** | `src/offscreen/offscreen.html`<br>`src/offscreen/offscreen.js`<br>`src/lib/offscreen-client.js` | Isolated DOM context for heavy WASM/WebGL/GPU tasks (MediaPipe FaceDetector, Tesseract OCR, YOLO). |

---

## 3. Real Runtime Workflow Trace

Verification of the codebase reveals two primary agent execution modes:

### 3.1 Standard Agent Loop (Cloud / Hybrid)
```text
USER (Input in Sidepanel)
  ↓
TASK INPUT (Validated & mode selected: Search / Deep Search / Scrape)
  ↓
AGENT PLANNING (sw.js: runPlannerRole builds task plan)
  ↓
OBSERVATION (captureVisibleTab / fallbackScreenshot + dom-detector.js getPageInfo)
  ↓
SIH SCREENSHOT GATE (sih-mode.js: in SIH mode, raw screenshot is blocked from network; degrades to DOM)
  ↓
MODEL INFERENCE (providers.js: callAI sends prompt + sanitized context to model)
  ↓
ACTION PARSING (tool-calls.js / parseJSON parses action: click, type, scroll, wait, finish)
  ↓
TASK GUARDIAN (guardian-daemon.js: checks purchase/destructive/auth authorization)
  ↓
LOCAL ACTION EXECUTION (actions.js: executes DOM dispatch or CDP trusted click)
  ↓
VERIFICATION (agent-runtime.js: verifier role confirms DOM change or navigation)
  ↓
RESULT / NEXT STEP (STEP_UPDATE broadcast to Sidepanel UI)
```

### 3.2 Privacy Mode Loop (`runPrivacyAgent` in `src/background/privacy-loop.js`)
```text
USER (Input with Privacy Mode ON or SIH Mode active)
  ↓
LOCAL OBSERVATION (sw.js: captureVisibleTab fetches raw frame strictly in memory)
  ↓
ON-DEVICE PRIVACY PIPELINE (privacy-agent.js: captureAndSanitize)
  ├── 1. DOM Scan: sensitive inputs (passwords, cards, OTP, Aadhaar, PAN) tagged
  ├── 2. Face Detection: MediaPipe BlazeFace (offscreen WASM) detects all human faces
  ├── 3. OCR Visual PII: Tesseract scans non-DOM canvas/image text for PII
  ├── 4. Deterministic PII Scan: pii-detector.js matches emails, phones, Indian IDs, tokens
  └── 5. Canvas Redaction: canvas-redactor.js paints solid blackouts & Gaussian face blurs
  ↓
PRIVACY FIREWALL ENVELOPE (privacy-firewall.js: sanitizeScreenContext)
  ├── Strip raw CSS selectors, labels, and personal values from manifest
  ├── Generate normalized safe manifest (region_01, region_02, ...)
  └── Validate all checks (pipelineRan, redactionOk, faceCoverageOk, visualPiiCoverageOk)
      └── FAIL-CLOSED: if any stage errored, payload is blocked (PrivacyBlockedError)
  ↓
SANITIZED CONTEXT TRANSMISSION (server/server.js /agent/decide or local Ollama)
  ↓
ACTION PLAN GENERATION (Model returns JSON action targeting safe UIDs or coords)
  ↓
LOCAL ACTION EXECUTION (actions.js dispatches click, fill, scroll, or key)
  ↓
FOUR-STATE VERIFICATION (ACTION_EXECUTED, ACTION_VERIFIED, VERIFICATION_FAILED, ACTION_FAILED)
  ↓
RESULT (Final answer rendered in Sidepanel without chain-of-thought)
```

---

## 4. Security & Privacy Controls

1. **Fail-Closed Architecture**:
   - `sih-mode.js`: `isSihMode()` defaults to `true`. Raw screenshot decision blocks transmission.
   - `privacy-firewall.js`: `assertSafeForNetwork` throws `PrivacyBlockedError`. Zero raw pixels or unmasked text can cross to network.
   - Fallback frame policy: If redaction engine encounters an exception, it substitutes an empty blank canvas (zero user pixels) or completely aborts.
2. **Indian Identity & Financial PII Suite**:
   - Aadhaar (12-digit & 16-digit VID with Verhoeff validation).
   - PAN (alphanumeric pattern with context scoring and mid-entry handling).
   - Voter ID (EPIC 3-letter + 7-digit pattern).
   - Passport & Driving License (context-gated patterns).
   - IFSC (bank branch identifier) & UPI VPA (handles across major Indian banks).
   - GSTIN & Indian bank account numbers.
3. **Task Group Sandbox (`tab-sandbox.js`)**:
   - Multi-tab browsing operations are bounded to isolated Chrome tab groups with color coding and title tags (`TechyMind Task`).
   - Prevents agent from touching or closing user tabs outside the task boundary.
4. **Prompt Injection Defense (`prompt-defense.js`)**:
   - Untrusted web content is wrapped in nonced security fences (`<<<fenced_content_NONCE>>>`).
   - Invisible Unicode and bidi-override characters (`\u200B`, `\u202E`, etc.) are stripped at wire boundary.
5. **Guardian Daemon (`guardian-daemon.js`)**:
   - Sensitive operations (financial purchases, credential submission, account creation) require explicit user confirmation or text matching.
   - Fault shutdown trips on repeated unauthorized attempts.

---

## 5. Existing Browser Support

1. **Chromium (Chrome, Edge, Brave)**:
   - Full Manifest V3 support.
   - Chrome sidePanel API for docked side panel.
   - Offscreen document API (`chrome.offscreen`) for WASM/WebGL acceleration.
   - Chrome Debugger API (`chrome.debugger`) for trusted input dispatch.
2. **Mozilla Firefox**:
   - Build script `scripts/build-firefox.mjs` transforms manifest:
     - Replaces `service_worker` with classic background event page `src/background/firefox-bg.js`.
     - Filters out Chrome-only permissions (`sidePanel`, `offscreen`, `debugger`, `tabGroups`).
     - Falls back to opening side panel as a browser tab on toolbar click.
     - Falls back to in-page hidden iframe for ML tasks where `chrome.offscreen` is absent.
   - Output directory: `dist/firefox/`.

---

## 6. Existing Test Suites & Benchmarking

- **Unit Benchmarks**: `TechyMindBench/run-techymind-bench.mjs --unit`
  - Runs in ~1 second. Verifies unit logic, privacy firewall envelopes, and Indian PII detectors.
- **Security & Privacy Leakage Suite**: `TechyMindBench/security.test.js`
  - 29 tests validating password, credit card, Aadhaar, PAN, and prompt injection defense.
- **Privacy Fuzz Suite**: `TechyMindBench/fuzz.test.js`
  - 216 test cases across 8 PII families and 9 potential leakage channels. 100% pass, 0 leaks.
- **Server Validation**: `TechyMindBench/server-validation.test.js`
  - Validates API request parsing, rate limiting, and token authentication.
- **Adversarial & E2E Suites**: `TechyMindBench/e2e/run-adversarial.mjs`, `TechyMindBench/e2e/run-e2e.mjs`.

---

## 7. Known Limitations & Audit Findings

1. **Top Navigation Inconsistency**:
   - The primary transformation spec requires `Agent`, `History`, `Settings` in top navigation, with `Settings` opening in a dedicated browser tab. In an earlier iteration, `Settings` was moved next to the privacy toggle. Both entrypoints can coexist cleanly, but Top Navigation must have the three designated buttons.
2. **Chain-of-Thought Filtering**:
   - `sidepanel.js` has a heuristic `sanitizeStepText`, but unstructured chain-of-thought tokens from certain models could occasionally slip through if they don't match specific prefix conditions. A strict fallback to safe status states (`Running task...`, `Reading page...`, etc.) is needed.
3. **Import JSON UX**:
   - Settings page currently has a basic file input without an interactive drag-and-drop zone, live JSON schema validation feedback, and confirmation dialog.
4. **Gecko Application ID**:
   - `scripts/build-firefox.mjs` currently defines `GECKO_ID = 'opencomet-sih@opencomet.dev'`. This must be updated to `techymind@techymind.dev`.
5. **Residual Branding References**:
   - 573 references across source files, packaging scripts, and guides still mention OpenComet. User-facing labels in `agent.js` ("Open Comet is working") and `prompts.js` ("You are Open Comet") must be branded to TechyMind.
