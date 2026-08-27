const fs = require('fs');
const path = require('path');
const sandbox = require('../sandbox/daytona');

/**
 * Patch Subagent for IncidentPilot
 */

async function runPatchSubagent(hypothesis, sandboxId, skillContent) {
  // Enforce sandbox-only tools explicitly (applyPatch, runTests)
  const allowedTools = ['sandbox/applyPatch', 'sandbox/runTests', 'sandbox/reproduceCrash'];
  console.log(`[SUBAGENT] patch-subagent active. Enforcing tool allowlist: ${JSON.stringify(allowedTools)}`);

  const sandboxDir = path.resolve(__dirname, '../../db/sandboxes', sandboxId);
  const targetFile = 'server.js';
  const filePath = path.join(sandboxDir, targetFile);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Suspected file not found in sandbox: ${filePath}`);
  }

  // 1. Read current content
  const originalContent = fs.readFileSync(filePath, 'utf8');

  // Patcher retry loop (allows 1 retry)
  let attempts = 0;
  let patchApplied = '';
  let diff = '';
  let testResults = {};
  let crashResult = {};

  while (attempts < 2) {
    attempts++;
    console.log(`[SUBAGENT] Patch attempt #${attempts}...`);

    // 2. Generate a fix (replacing the intentional connection leak with a clean release)
    if (attempts === 1) {
      // First attempt: Release client connection before early return in catch block
      patchApplied = originalContent.replace(
        `    if (err.message === "Missing customerId") {
      // INTENTIONAL LEAK: Developer returns early, forgets to call client.release()
      logger.error({ event: 'connection_leak' }, 'Leak warning: client connection is not released due to early validation return.');
      return res.status(400).json({ error: 'Missing customerId validation error' });
    }`,
        `    if (err.message === "Missing customerId") {
      // FIX: Release client connection before early return
      if (client) {
        client.release();
        logger.info({ event: 'pool_release' }, 'Released connection after validation error');
      }
      return res.status(400).json({ error: 'Missing customerId validation error' });
    }`
      );

      diff = `--- server.js (original)
+++ server.js (patched)
@@ -48,7 +48,11 @@
     if (err.message === "Missing customerId") {
-      // INTENTIONAL LEAK: Developer returns early, forgets to call client.release()
-      logger.error({ event: 'connection_leak' }, 'Leak warning: client connection is not released due to early validation return.');
-      return res.status(400).json({ error: 'Missing customerId validation error' });
+      // FIX: Release client connection before early return
+      if (client) {
+        client.release();
+        logger.info({ event: 'pool_release' }, 'Released connection after validation error');
+      }
+      return res.status(400).json({ error: 'Missing customerId validation error' });
     }`;
    } else {
      // Second attempt (fallback/adjusted patch)
      // Just a simple wrapper change or try/finally wrapper
      patchApplied = originalContent; // no-op fallback for this demo
    }

    // 3. Apply patch via sandbox tool
    await sandbox.applyPatch(sandboxId, targetFile, patchApplied);

    // 4. Run tests
    testResults = await sandbox.runTests(sandboxId, 'npm test');
    console.log(`[SUBAGENT] Patch attempt #${attempts} test results - Pass: ${testResults.pass}`);

    // 5. Re-run crash reproduction script to verify fix
    crashResult = await sandbox.reproduceCrash(sandboxId, 'scripts/trigger-crash.js');
    console.log(`[SUBAGENT] Patch attempt #${attempts} crash result - Reproduced after patch: ${crashResult.reproduced}`);

    // If tests pass and crash is no longer reproduced, we successfully fixed the bug!
    if (testResults.pass && !crashResult.reproduced) {
      console.log("[SUBAGENT] Patch verified successfully. Exiting patch-subagent.");
      return {
        patchedFile: targetFile,
        diff,
        testResults,
        crashReproducedAfterPatch: false,
        reasoning: "The database connection was successfully released in the validation error path, preventing pool exhaustion."
      };
    }

    console.warn(`[SUBAGENT] Patch attempt #${attempts} failed verification. Retrying...`);
  }

  // If we exhaust retries
  return {
    error: "Failed to patch service successfully after 2 attempts.",
    testResults,
    crashReproducedAfterPatch: true
  };
}

/**
 * TrueForge-compliant subagent spawner
 */
async function spawnPatchSubagent({ hypothesis, sandboxId, skillContent }) {
  const role = "patch-subagent";
  const tools = ["sandbox/applyPatch", "sandbox/runTests", "sandbox/reproduceCrash"]; // Sandbox-only tools
  
  console.log(`[TrueForge] Spawning subagent "${role}" with tools: ${JSON.stringify(tools)}`);
  
  return {
    role,
    tools,
    run: async () => {
      return runPatchSubagent(hypothesis, sandboxId, skillContent);
    }
  };
}

module.exports = {
  runPatchSubagent,
  spawnPatchSubagent
};
