const triageSubagent = require('../../agent/subagents/triage');
const patcherSubagent = require('../../agent/subagents/patcher');
const sandbox = require('../../agent/sandbox/daytona');
const loader = require('../../agent/skills/loader');
const orchestrator = require('../../agent/orchestrator');
const fs = require('fs');
const path = require('path');

describe('End-to-End Orchestrator Flow Integration Tests', () => {
  beforeEach(() => {
    delete process.env.MOCK_APPROVAL;
  });

  it('Happy Path: Alert -> Triage -> Sandbox Repro -> Patch -> Approved PR -> Postmortem', async () => {
    process.env.MOCK_APPROVAL = 'approve';

    // 1. Alert trigger
    const alert = { id: "alert-123", service: "order-service" };
    await orchestrator.receiveIncidentTrigger(alert);

    // 2. Fetch diagnostics
    const diagnostics = await orchestrator.fetchDiagnostics('order-service');

    // 3. Delegate to triage
    const hypothesis = await orchestrator.delegateToTriageSubagent(diagnostics);
    expect(hypothesis.category).toBe('connection-leak');

    // 4. Sandbox reproduction
    const reproResult = await orchestrator.reproduceInSandbox(hypothesis.reasoning);
    expect(reproResult.reproduced).toBe(true);

    // 5. Delegate to patch
    const patchProposal = await orchestrator.delegateToPatchSubagent(reproResult, hypothesis);
    patchProposal.sandboxId = reproResult.sandboxId;
    expect(patchProposal.crashReproducedAfterPatch).toBe(false);
    expect(patchProposal.testResults.pass).toBe(true);

    // 6. Human approval gate and PR opened
    const approvalResult = await orchestrator.requestHumanApproval(patchProposal, hypothesis);
    expect(approvalResult.status).toBe('applied_and_verified');
    expect(approvalResult.prUrl).toContain('pull/42');

    // 7. Clean up sandbox
    await sandbox.destroySandbox(reproResult.sandboxId);

    // 8. Verify postmortem generated
    const postmortemPath = path.resolve(__dirname, '../../postmortems/session-test-uuid-12345.md');
    expect(fs.existsSync(postmortemPath)).toBe(true);
    fs.unlinkSync(postmortemPath);
  }, 30000);

  it('Rejection Path: Alert -> Triage -> Sandbox Repro -> Patch -> Rejected -> No PR -> Postmortem', async () => {
    process.env.MOCK_APPROVAL = 'reject';

    // 1. Alert trigger
    const alert = { id: "alert-123", service: "order-service" };
    await orchestrator.receiveIncidentTrigger(alert);

    // 2. Fetch diagnostics
    const diagnostics = await orchestrator.fetchDiagnostics('order-service');

    // 3. Delegate to triage
    const hypothesis = await orchestrator.delegateToTriageSubagent(diagnostics);

    // 4. Sandbox reproduction
    const reproResult = await orchestrator.reproduceInSandbox(hypothesis.reasoning);

    // 5. Delegate to patch
    const patchProposal = await orchestrator.delegateToPatchSubagent(reproResult, hypothesis);
    patchProposal.sandboxId = reproResult.sandboxId;

    // 6. Human approval gate (should reject and throw)
    await expect(orchestrator.requestHumanApproval(patchProposal, hypothesis)).rejects.toThrow(
      "Incident patch rejected by human supervisor."
    );

    // 7. Clean up sandbox
    await sandbox.destroySandbox(reproResult.sandboxId);

    // 8. Verify postmortem generated
    const postmortemPath = path.resolve(__dirname, '../../postmortems/session-test-uuid-12345.md');
    expect(fs.existsSync(postmortemPath)).toBe(true);
    fs.unlinkSync(postmortemPath);
  }, 30000);

  it('Sandbox Fallback to Docker path', async () => {
    const sandboxId = await sandbox.createSandbox('incidentpilot');
    expect(sandboxId).toContain('sandbox-');

    const reproResult = await sandbox.reproduceCrash(sandboxId, 'scripts/trigger-crash.js');
    expect(reproResult.reproduced).toBe(true);

    await sandbox.destroySandbox(sandboxId);
  }, 30000);
});
