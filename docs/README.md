# TechyMind Documentation

Documentation for **TechyMind** — the privacy-first autonomous browser agent. Start at the root [`README.md`](../README.md); the benchmark has its own home in [`TechyMindBench/`](../TechyMindBench/README.md).

## Folder map

```
docs/
├── changelog/     ← release notes
├── guides/        ← install, features, demos, developer & debugging guides
├── architecture/  ← privacy architecture deep-dive
├── research/      ← measured latency research that shaped the speed profiles
├── project/       ← roadmap & historical project notes
└── assets/        ← brand icons + demo test pages
```

## Start here

| Document | What it covers |
|---|---|
| [Getting Started](./guides/GETTING_STARTED.md) | Installation, API keys, first task |
| [Features Guide](./guides/FEATURES_GUIDE.md) | Auto Scraper, Deep Research, Skills, Privacy modes |
| [FAQ & Troubleshooting](./guides/FAQ.md) | Common questions and fixes |

## Development & debugging

| Document | What it covers |
|---|---|
| [Developer Guide](./guides/DEVELOPER_GUIDE.md) | Architecture overview, environment, workflows |
| [Diagnostics & Logging](./guides/DIAGNOSTICS_LOGGING.md) | Console channels, log capture, debugging the agent loop |
| [DOM Detector](./guides/DOM_DETECTOR.md) | Element tagging with boxes + numeric badges, uid relocation chain |
| [Privacy Vision](./architecture/PRIVACY_VISION.md) | Redaction architecture deep-dive (pipeline stages, cascade, firewall) |
| [File-by-File Guide](./architecture/FILE_GUIDE.md) | Developer map of privacy pipeline modules and background loop |
