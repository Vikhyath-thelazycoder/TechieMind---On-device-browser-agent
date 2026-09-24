# TechyMind: Features and Workflow

This document is a practical overview of what the project does, how its pieces
fit together, and how to run it locally. TechyMind is primarily a browser
extension; the companion Node server is optional.

## What the project is

TechyMind is a Manifest V3 browser agent that can browse, research, extract
data, and automate browser tasks from a side panel. Its defining constraint is
privacy: page context is inspected and sensitive information is redacted in the
browser before any context is sent to a remote model.

## Main features

### Browser automation

- Accepts a natural-language task in the side panel.
- Reads the current page using DOM context, tagged interactive elements, and
  screenshots.
- Performs verified browser actions such as click, type, scroll, navigation,
  tab management, and page interaction.
- Re-evaluates the page after actions and stops when the task is complete,
  blocked, rejected, or reaches its step limit.
- Runs task tabs inside a visible tab-group sandbox.

### Built-in workflows

The input area provides dedicated modes for:

- **Search / Agent**: multi-step browser tasks and page interactions.
- **Deep Search / Deep Research**: searches multiple sources/tabs, reads relevant pages, and
  synthesizes a report with sources.
- **Scrape / Extract Data**: finds page data and returns structured results suitable
  for JSON, CSV, or Markdown export.
- **Summaries**: produces a focused summary of the current page.

### Skill library

The extension ships with reusable skills:

1. Summarize page
2. Deep research
3. Extract data
4. Compare prices
5. Fill form
6. Find alternatives
7. Manage bookmarks
8. Monitor page
9. Organize tabs
10. Read later
11. Save page
12. Screenshot walkthrough

Skills are Markdown files under `skills/<skill-id>/SKILL.md`. They include
metadata such as keywords, supported hosts, tools, and completion checklists.
Users can select them from the quick skill menu or invoke them as reusable
workflows.

### Privacy and safety

TechyMind enforces privacy directly on-device:

- **Biometric protection**: Local MediaPipe models identify face regions and
  blur them.
- **Credential masking**: Passwords, authentication fields, and credit cards are
  obscured with black rectangles.
- **PII redaction**: Regex and checksum rules identify sensitive IDs (Aadhaar,
  PAN, SSN, emails, phone numbers) and replace them with `[REDACTED:<type>]`.
- **Fail-closed firewall**: If the redaction pipeline encounters an error, a
  blank 1×1 frame is sent rather than raw pixels.
- **Task Guardian**: Checks user tasks for dangerous operations and asks for
  explicit authorization when appropriate.

## Repository architecture

| Component | Responsibility |
| --- | --- |
| `src/sidepanel/` | User interface, task input, compact mode selector, top navigation, history |
| `src/settings/` | Dedicated options page in a full browser tab |
| `src/background/sw.js` | Service-worker orchestration, routing, task loop, approvals |
| `src/background/actions.js` | Browser action execution and page operations |
| `src/content/agent.js` | Page-side interaction and agent status overlay |
| `src/content/dom-detector.js` | Interactive-element discovery and stable element IDs |
| `src/offscreen/` | Isolated local ML, OCR, and vision work |
| `src/lib/privacy-agent.js` | Privacy configuration and sanitized captures |
| `src/lib/providers.js` | Provider selection, capability checks, and AI calls |
| `src/lib/skill-library.js` | Loads and parses Markdown skills |
| `server/` | Optional sanitized-payload companion server |
| `TechyMindBench/` | Unit, browser, E2E, privacy, and adversarial validation |

## Run the extension

1. Open `chrome://extensions` (or the equivalent page in Brave, Edge, or
   another Chromium browser).
2. Enable **Developer mode**.
3. Choose **Load unpacked** and select the repository root containing
   `manifest.json`.
4. Pin **TechyMind** 🔒 and open its side panel.
5. In Settings (`Settings ↗`), select a local model (Ollama) or a cloud provider and configure
   its credentials. Never commit keys to source control.
6. Enter a task such as:
   `Summarize this page in five bullet points.`
7. Use Ask mode when reviewing every action; use Auto mode only for trusted,
   low-risk tasks.

Reload the extension from `chrome://extensions` after source changes. Inspect
the service worker, side panel, and active tab separately when debugging.

## Run the optional companion server

```bash
cd server
npm install
npm start
```

The server listens on `http://0.0.0.0:8787` by default. It accepts sanitized
screenshots, sanitized DOM text, a redaction manifest, task context, history,
and provider settings. It exposes:

| Endpoint | Purpose |
| --- | --- |
| `GET /health` | Liveness check |
| `GET /config` | Configured-provider status |
| `POST /agent/decide` | Return the next structured action plan |
| `POST /vision/describe` | Describe a sanitized image for debugging |

For a fully local setup, run Ollama separately and set
`OLLAMA_BASE_URL=http://localhost:11434`. The server must only receive data
after the browser privacy pipeline has sanitized it.

## Validate the project

The dependency-free unit benchmark can be run from the repository root:

```bash
npm run bench:unit
```

Broader suites are available with `npm run bench` and `npm run bench:all`.
Benchmark reports are written under `TechyMindBench/results/`.

## Important limitations

- The extension needs a Chromium-based browser (or the documented Firefox
  fallback); Node alone does not launch the extension UI.
- A provider/model must be configured before an AI task can run.
- Local vision and local model performance depend on browser WebGPU support and
  available device memory.
- Websites can block extension scripting, cross-origin access, or automation.
- AI output is treated as a plan and is still subject to approval, guardian,
  privacy, and verification checks.
