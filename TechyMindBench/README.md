# TechyMindBench — Documentation & Usage Guide

**TechyMindBench** is the measured benchmark suite of **TechyMind**. It
scores the real extension — the real capture → perception → sanitize → network gate →
action → verification loop — across multiple tiers, and every number it prints is
**measured from the real runtime**: nothing is asserted, hard-coded, or fabricated.
All fixture data is synthetic (no real personal data, ever).

> **This folder is the operational home of the benchmark.** The specification —
> motivation, design principles, tier architecture, stable case IDs, the measured
> scoreboard, and the known-limitations policy — lives in **[TECHYMIND_BENCH.md](./TECHYMIND_BENCH.md)**.

---

## 1. Folder map

| Path | What it is |
|---|---|
| `run-techymind-bench.mjs` | **One-command auto-run** of validation tiers against TechyMind itself (see §2) |
| `run-all.js` + `suites.js` | UNIT tier orchestrator (Node, no browser needed) |
| `privacy.bench.js` · `redaction.bench.js` · `visual-context.bench.js` | UNIT suites: PII P/R, redaction geometry, visual-context accuracy |
| `security.test.js` · `fuzz.test.js` · `server-validation.test.js` | UNIT suites: network gate invariants, 216-case leakage fuzz, inbound validation |
| `fixtures/pii-corpus.json` | 514-case checksum-validated PII corpus (positives + negatives) |
| `pages/` | 16 synthetic pages with embedded ground truth (`generate-pages.mjs` regenerates them) |
| `browser/harness.mjs` | BROWSER tier — REAL pixels, real screenshots at DPR 1–2, real in-page pipeline |
| `browser/runner.html` | Single-page interactive runner with Export JSON |
| `e2e/run-e2e.mjs` | E2E tier — the real unpacked extension driven through reproducible tasks |
| `e2e/run-e2e-real.mjs` | E2E-REAL tier — same loop with YOUR model (BYO provider) |
| `e2e/run-adversarial.mjs` | ADVERSARIAL tier — 23 wire-capture cases (12 privacy + 11 injection) |
| `results/` | Every report the harnesses write — import these into **Settings → Privacy & Vision** |

---

## 2. Quick start (copy-paste)

```bash
# ONE COMMAND — runs UNIT validation against TechyMind and writes a summary:
node TechyMindBench/run-techymind-bench.mjs --unit

# Equivalent npm scripts:
npm run bench            # UNIT + E2E
npm run bench:unit       # Node suites only — no browser required
npm run bench:all        # all tiers
```

What "against TechyMind itself" means: the harnesses load
the **real unpacked extension** into Chromium (Playwright `--load-extension`), point its
decision endpoint at the scripted mock-VLM (or your own model for E2E-REAL), and drive
real tasks through the extension's actual service worker, offscreen ML runtime and
privacy firewall. The only mocked component is the decision *brain*, and only where the
tier says so — every byte the pipeline produces is the extension's own.

Exit code `0` = every tier that ran passed.

---

## 3. Tier guide

### 3.1 UNIT — Node suites (run anywhere, seconds)

```bash
node TechyMindBench/run-all.js          # all suites, human-readable table
node TechyMindBench/run-all.js --json   # machine-readable
node TechyMindBench/run-all.js --only=privacy   # a single suite
```

| Suite | Metric | What it measures |
|---|---|---|
| `privacy.bench.js` | PII precision/recall | TP/FP/FN per PII type over `fixtures/pii-corpus.json` — regex + checksum validators (Luhn/Verhoeff/mod-97) + contextual risk scoring |
| `redaction.bench.js` | Redaction precision | region coverage, mean IoU, over-redaction %, style mapping (secret→blackout, personal→pixelate, face→blur), safe-manifest integrity |
| `visual-context.bench.js` | Visual context accuracy | page-type classification accuracy, visual-element recognition, adaptive ViT gate decisions |
| `security.test.js` | Security invariant | network gate blocks: raw screenshots, secret-shaped text, unsafe manifests, privacy-off payloads; fail-closed on detector crash |
| `fuzz.test.js` | Leakage fuzz | 216 seeded cases (8 secret families × 9 channels) — zero leakage |

Targets are encoded per suite (P≥0.97, R≥0.95, coverage≥0.98, accuracy≥0.95…).
**Exit code 0 = every target met.**

---

## 4. Reading the results

1. Every run writes timestamped JSON reports into `TechyMindBench/results/`.
2. `run-techymind-bench.mjs` additionally writes a summary report.
3. Import reports into the Settings page under Privacy & Vision scorecard.
