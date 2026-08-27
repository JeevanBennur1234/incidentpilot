const postmortem = require('../../agent/postmortem');
const dbStore = require('../../agent/db/store');
const fs = require('fs');

describe('Postmortem Generator Unit Tests', () => {
  const sessionId = `test-postmortem-${Date.now()}`;

  beforeAll(() => {
    dbStore.persistSessionState(sessionId, {
      stage: 'incident_triggered',
      payload: { id: "alert-123", service: "order-service" }
    });
    dbStore.persistSessionState(sessionId, {
      stage: 'triage complete',
      payload: { category: "connection-leak", confidence: 0.92, reasoning: "Suspected leak" }
    });
    dbStore.persistSessionState(sessionId, {
      stage: 'patch proposed',
      payload: { patchedFile: "server.js", diff: "+ Release", testResults: { pass: true, output: "Pass" } }
    });
    dbStore.persistSessionState(sessionId, 'incident_resolved');
  });

  it('should generate markdown postmortem with all sections present', () => {
    const reportPath = postmortem.generatePostmortem(sessionId);
    expect(fs.existsSync(reportPath)).toBe(true);

    const content = fs.readFileSync(reportPath, 'utf8');
    expect(content).toContain('## Summary');
    expect(content).toContain('## Timeline');
    expect(content).toContain('## Root Cause');
    expect(content).toContain('## Fix Applied');
    expect(content).toContain('## Verification Evidence');
    expect(content).toContain('## PR Link');

    // Cleanup
    try {
      fs.unlinkSync(reportPath);
    } catch (_) {}
  });
});
