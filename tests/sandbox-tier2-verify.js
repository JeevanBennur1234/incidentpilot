/**
 * Tier 2 Docker sandbox verification:
 * createSandbox → reproduceCrash → runTests → destroySandbox
 * Captures `docker ps` output mid-execution and after teardown.
 */
const { execSync } = require('child_process');
const sandbox = require('../agent/sandbox/daytona');

// Ensure Daytona env vars are NOT set so we exercise Tier 2
delete process.env.DAYTONA_SERVER_URL;
delete process.env.DAYTONA_API_KEY;

function dockerPs() {
  return execSync('docker ps --format "table {{.ID}}\\t{{.Image}}\\t{{.Names}}\\t{{.Status}}"', { encoding: 'utf8' });
}

async function main() {
  console.log('\n=== Tier 2 Docker Sandbox Verification ===\n');

  // ── createSandbox ──────────────────────────────────────────────────────────
  console.log('[1/4] createSandbox...');
  const sandboxId = await sandbox.createSandbox('incidentpilot');
  console.log(`      sandboxId: ${sandboxId}`);

  console.log('\n[docker ps DURING execution]:');
  const duringPs = dockerPs();
  console.log(duringPs);

  // ── reproduceCrash ─────────────────────────────────────────────────────────
  console.log('[2/4] reproduceCrash...');
  const crashResult = await sandbox.reproduceCrash(sandboxId, 'scripts/trigger-crash.js');
  console.log(`      reproduced: ${crashResult.reproduced}`);
  console.log(`      stdout: ${crashResult.stdout.trim()}`);

  // ── runTests ───────────────────────────────────────────────────────────────
  console.log('\n[3/4] runTests...');
  const testResult = await sandbox.runTests(sandboxId, 'npm test');
  console.log(`      pass: ${testResult.pass}`);
  console.log(`      output: ${testResult.output.trim()}`);

  // ── destroySandbox ─────────────────────────────────────────────────────────
  console.log('\n[4/4] destroySandbox...');
  await sandbox.destroySandbox(sandboxId);

  console.log('\n[docker ps AFTER teardown]:');
  const afterPs = dockerPs();
  console.log(afterPs);

  console.log('=== Tier 2 verification complete ===\n');

  // Return structured evidence for README update
  return { sandboxId, duringPs, afterPs, crashResult, testResult };
}

main().catch(err => {
  console.error('Verification failed:', err.message);
  process.exit(1);
});
