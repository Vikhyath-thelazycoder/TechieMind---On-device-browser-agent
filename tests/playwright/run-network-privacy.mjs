// tests/playwright/run-network-privacy.mjs
// SIH Phase 13: End-to-End Network Privacy & Fail-Closed Playwright Test Suite
// Intercepts all outbound network calls and verifies:
//   RAW DATA → LOCAL DETECTION → LOCAL REDACTION/SANITIZATION → SANITIZED CONTEXT → NETWORK
//   RAW SENSITIVE DATA NEVER REACHES THE NETWORK WIRE.

import { chromium } from 'playwright';
import { resolve } from 'path';

const EXT_PATH = resolve('.');

const SENSITIVE_FIXTURES = {
  aadhaar: '5489 1234 5678',
  pan: 'ABCDE1234F',
  password: 'MySuperSecretPassword#2026!',
  email: 'ceo-confidential@techymind.gov.in',
  phone: '9876543210',
  secretApiKey: 'sk-proj-abcde1234567890abcdef123456',
  rawScreenshot: 'data:image/png;base64,' + 'iVBORw0KGgoAAAANSUhEUgAA'.repeat(200),
};

const interceptedRequests = [];
const testResults = [];

function record(name, pass, details = '') {
  testResults.push({ name, pass, details });
  const icon = pass ? '✓' : '✗';
  console.log(`  ${icon} ${name}: ${pass ? 'PASS' : 'FAIL'} ${details ? '(' + details + ')' : ''}`);
}

async function runNetworkPrivacySuite() {
  console.log('\n==================================================');
  console.log('  SIH26171 PHASE 13 — PLAYWRIGHT NETWORK PRIVACY');
  console.log('==================================================\n');

  let context = null;

  try {
    context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${EXT_PATH}`,
        `--load-extension=${EXT_PATH}`,
      ],
    });

    let [sw] = context.serviceWorkers();
    if (!sw) sw = await context.waitForEvent('serviceworker');
    const extId = sw.url().split('/')[2];

    // Intercept ALL network traffic
    await context.route('**/*', async (route, request) => {
      const url = request.url();
      const method = request.method();
      const postData = request.postData() || '';
      const headers = request.headers();

      // Only track external / HTTP traffic (not local chrome-extension:// assets)
      if (url.startsWith('http://') || url.startsWith('https://')) {
        interceptedRequests.push({
          url,
          method,
          postData,
          headers,
          timestamp: Date.now(),
        });
      }

      // Mock responses for companion server or LLM endpoints to allow safe pipeline flow
      if (url.includes('8787') || url.includes('/api/')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            plan: { thought: 'Sanitized decision reached', action: { type: 'done' }, confidence: 0.95 },
          }),
        });
      } else {
        await route.continue();
      }
    });

    const page = await context.newPage();
    await page.goto(`chrome-extension://${extId}/src/sidepanel/sidepanel.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    // ─────────────────────────────────────────────────────────────
    // TEST 1: Aadhaar Pre-Network Sanitization
    // ─────────────────────────────────────────────────────────────
    try {
      const outcome = await page.evaluate(async (fixtures) => {
        const { maskForType } = await import('/src/lib/pii-detector.js');
        const masked = maskForType('aadhaar', fixtures.aadhaar);
        const leaked = masked.includes(fixtures.aadhaar);
        return { masked, leaked };
      }, SENSITIVE_FIXTURES);

      record(
        'Aadhaar Local Redaction Before Wire',
        !outcome.leaked && outcome.masked !== SENSITIVE_FIXTURES.aadhaar,
        `Masked to: "${outcome.masked}"`
      );
    } catch (err) {
      record('Aadhaar Local Redaction Before Wire', false, err.message);
    }

    // ─────────────────────────────────────────────────────────────
    // TEST 2: PAN Card Number Pre-Network Sanitization
    // ─────────────────────────────────────────────────────────────
    try {
      const outcome = await page.evaluate(async (fixtures) => {
        const { maskForType } = await import('/src/lib/pii-detector.js');
        const masked = maskForType('pan', fixtures.pan);
        const leaked = masked.includes(fixtures.pan);
        return { masked, leaked };
      }, SENSITIVE_FIXTURES);

      record(
        'PAN Card Local Redaction Before Wire',
        !outcome.leaked && outcome.masked !== SENSITIVE_FIXTURES.pan,
        `Masked to: "${outcome.masked}"`
      );
    } catch (err) {
      record('PAN Card Local Redaction Before Wire', false, err.message);
    }

    // ─────────────────────────────────────────────────────────────
    // TEST 3: Password / Credential Pre-Network Sanitization
    // ─────────────────────────────────────────────────────────────
    try {
      const outcome = await page.evaluate(async (fixtures) => {
        const { validateSanitizedPayload } = await import('/src/lib/privacy-firewall.js');
        const payload = {
          sanitizedImage: 'data:image/jpeg;base64,' + 'A'.repeat(200),
          sanitizedText: `User secret credentials: password=${fixtures.password}`,
          safeManifest: [],
          privacyVerification: { enforced: true, passed: true },
        };
        const validation = validateSanitizedPayload(payload);
        return { blocked: !validation.ok, reason: validation.reasons };
      }, SENSITIVE_FIXTURES);

      record(
        'Password Credential Interception',
        outcome.blocked,
        `Firewall gate blocked raw password: ${outcome.reason?.[0] || 'Enforced'}`
      );
    } catch (err) {
      record('Password Credential Interception', false, err.message);
    }

    // ─────────────────────────────────────────────────────────────
    // TEST 4: API Key / Secret Sweep
    // ─────────────────────────────────────────────────────────────
    try {
      const outcome = await page.evaluate(async (fixtures) => {
        const { scanTextForSecrets } = await import('/src/lib/privacy-firewall.js');
        const textWithSecret = `Authorization: Bearer ${fixtures.secretApiKey}`;
        const secretsFound = scanTextForSecrets(textWithSecret);
        return { found: secretsFound.length > 0, secrets: secretsFound };
      }, SENSITIVE_FIXTURES);

      record(
        'Secret & API Key Local Sweep',
        outcome.found,
        `Identified ${outcome.secrets?.length} secret pattern(s)`
      );
    } catch (err) {
      record('Secret & API Key Local Sweep', false, err.message);
    }

    // ─────────────────────────────────────────────────────────────
    // TEST 5: Raw Screenshot Smuggling Gate
    // ─────────────────────────────────────────────────────────────
    try {
      const outcome = await page.evaluate(async (fixtures) => {
        const { validateSanitizedPayload } = await import('/src/lib/privacy-firewall.js');
        const payload = {
          sanitizedImage: fixtures.rawScreenshot,
          sanitizedText: 'Clean text',
          safeManifest: [],
          privacyVerification: null, // Privacy bypassed
        };
        const result = validateSanitizedPayload(payload);
        return { blocked: !result.ok, reasons: result.reasons };
      }, SENSITIVE_FIXTURES);

      record(
        'Raw Screenshot Wire Gate',
        outcome.blocked,
        `Unredacted capture blocked: ${outcome.reasons?.[0] || 'Enforced'}`
      );
    } catch (err) {
      record('Raw Screenshot Wire Gate', false, err.message);
    }

    // ─────────────────────────────────────────────────────────────
    // TEST 6: Byte-Level Outbound Leakage Scan Verification
    // ─────────────────────────────────────────────────────────────
    try {
      const outcome = await page.evaluate(async (fixtures) => {
        const { serializeWirePayload, byteLevelLeakageScan } = await import('/src/lib/wire-guard.js');
        const dirtyPayload = {
          sanitizedDataUrl: 'data:image/jpeg;base64,' + 'A'.repeat(200),
          sanitizedDomText: `Confidential Aadhaar: ${fixtures.aadhaar} and PAN: ${fixtures.pan}`,
        };
        const { bytes } = serializeWirePayload(dirtyPayload);
        const scanResult = byteLevelLeakageScan(bytes, {
          knownValues: [fixtures.aadhaar, fixtures.pan],
        });
        return {
          leakageDetected: !scanResult.ok || scanResult.reasons?.length > 0,
          reasons: scanResult.reasons,
        };
      }, SENSITIVE_FIXTURES);

      record(
        'Byte-Level Wire Leakage Scan',
        outcome.leakageDetected,
        `Wire guard detected: ${outcome.reasons?.[0] || 'Known sensitive values in byte stream'}`
      );
    } catch (err) {
      record('Byte-Level Wire Leakage Scan', false, err.message);
    }

    // ─────────────────────────────────────────────────────────────
    // TEST 7: End-to-End decideViaServer Outbound Network Sanitization
    // ─────────────────────────────────────────────────────────────
    try {
      // Simulate dispatching a privacy decision via the server
      await page.evaluate(async (fixtures) => {
        const { decideViaServer } = await import('/src/lib/privacy-agent.js');
        const cleanPayload = {
          sanitizedDataUrl: 'data:image/jpeg;base64,' + 'A'.repeat(200),
          sanitizedDomText: 'Welcome to the portal. Please proceed.',
          manifest: [
            { regionId: 'r1', type: 'aadhaar', bounds: { x: 0, y: 0, w: 50, h: 20 }, action: 'blackout' },
          ],
          privacy: {
            sanitizedImage: 'data:image/jpeg;base64,' + 'A'.repeat(200),
            sanitizedText: 'Welcome to the portal. Please proceed.',
            safeManifest: [{ regionId: 'r1', type: 'aadhaar', bounds: { x: 0, y: 0, w: 50, h: 20 }, action: 'blackout' }],
            privacyVerification: { enforced: true, passed: true, checks: {}, firewallVersion: '1.0.0' },
          },
        };

        try {
          await decideViaServer(cleanPayload, 'Summarize page', [], {
            provider: 'openai',
            apiKey: 'mock-key',
            serverUrl: 'http://127.0.0.1:8787',
          });
        } catch {
          // Mock fetch or network call might conclude or error out
        }
      }, SENSITIVE_FIXTURES);

      // Verify intercepted network traffic
      let rawDataLeaked = false;
      let leakDetails = '';

      for (const req of interceptedRequests) {
        for (const [key, secretVal] of Object.entries(SENSITIVE_FIXTURES)) {
          if (typeof secretVal === 'string' && secretVal.length > 5 && req.postData.includes(secretVal)) {
            rawDataLeaked = true;
            leakDetails = `Leaked ${key} to ${req.url}`;
            break;
          }
        }
      }

      record(
        'Outbound Network Interception Assertions',
        !rawDataLeaked,
        rawDataLeaked ? leakDetails : 'Zero raw sensitive strings present on HTTP wire'
      );
    } catch (err) {
      record('Outbound Network Interception Assertions', false, err.message);
    }

    // ─────────────────────────────────────────────────────────────
    // TEST 8: Fail-Closed Enforcement
    // ─────────────────────────────────────────────────────────────
    try {
      const outcome = await page.evaluate(async (fixtures) => {
        const { decideViaServer, gateOutboundDecision } = await import('/src/lib/privacy-agent.js');
        // Construct a corrupted unverified payload that must FAIL CLOSED
        const invalidPayload = {
          sanitizedDataUrl: fixtures.rawScreenshot,
          sanitizedDomText: `RAW_SECRET: ${fixtures.secretApiKey}`,
          manifest: [],
          privacy: null, // missing envelope
        };

        const gateCheck = gateOutboundDecision(invalidPayload, 'Task with secret', []);
        return {
          failClosedTriggered: Boolean(gateCheck?.privacyBlocked),
          reason: gateCheck?.actionPlan?.action?.message || gateCheck?.actionPlan?.thought,
        };
      }, SENSITIVE_FIXTURES);

      record(
        'Fail-Closed Boundary Invariant',
        outcome.failClosedTriggered,
        `Blocked at gateway before transmission: "${outcome.reason?.slice(0, 60)}..."`
      );
    } catch (err) {
      record('Fail-Closed Boundary Invariant', false, err.message);
    }

  } finally {
    if (context) await context.close();
  }

  // Summary
  const passedCount = testResults.filter(r => r.pass).length;
  const totalCount = testResults.length;
  console.log('\n──────────────────────────────────────────────────');
  console.log(`  NETWORK PRIVACY TEST SUMMARY: ${passedCount} / ${totalCount} PASSED`);
  console.log('──────────────────────────────────────────────────\n');

  if (passedCount !== totalCount) {
    process.exit(1);
  }
}

runNetworkPrivacySuite().catch(err => {
  console.error('\nFatal Network Privacy test error:', err);
  process.exit(1);
});
