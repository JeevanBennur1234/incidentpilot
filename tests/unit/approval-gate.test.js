const orchestrator = require('../../agent/orchestrator');
const fs = require('fs');
const path = require('path');

describe('Approval Gate Unit Tests', () => {
  const patchProposal = {
    patchedFile: "server.js",
    diff: "--- server.js",
    testResults: { pass: true, output: "All passed" },
    crashReproducedAfterPatch: false,
    sandboxId: "sandbox-mock-123"
  };

  const hypothesis = {
    confidence: 0.92,
    reasoning: "Leak suspected"
  };

  it('should throw error and never call applyAndVerify when rejected', async () => {
    process.env.MOCK_APPROVAL = 'reject';

    let applyAndVerifyCalled = false;
    const originalApplyAndVerify = orchestrator.applyAndVerify;
    orchestrator.applyAndVerify = async (patch) => {
      applyAndVerifyCalled = true;
      return originalApplyAndVerify(patch);
    };

    await expect(orchestrator.requestHumanApproval(patchProposal, hypothesis)).rejects.toThrow(
      "Incident patch rejected by human supervisor."
    );

    expect(applyAndVerifyCalled).toBe(false);

    // Clean up mock state and restore
    orchestrator.applyAndVerify = originalApplyAndVerify;
    delete process.env.MOCK_APPROVAL;
  });
});
