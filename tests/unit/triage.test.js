const triage = require('../../agent/subagents/triage');
const loader = require('../../agent/skills/loader');

describe('Triage Subagent Unit Tests', () => {
  it('should correctly classify connection-leak diagnostics payload with confidence above threshold', async () => {
    const diagnostics = {
      logs: [
        { level: "WARN", event: "validation_failure", msg: "Connection LEAKED" },
        { level: "ERROR", event: "connection_leak", msg: "leak warning" }
      ],
      metrics: {
        poolSize: 5,
        activeConnections: 5,
        idleConnections: 0,
        waitingConnections: 1,
        requestLatencyP99Ms: 2000,
        errorRatePercent: 100
      }
    };

    const skills = loader.loadSkillPacks('incidentpilot');
    const triageSkill = skills.find(s => s.name === 'incident-triage') || {};

    const hypothesis = await triage.runTriageSubagent(diagnostics, triageSkill.content || '');

    expect(hypothesis.category).toBe('connection-leak');
    expect(hypothesis.confidence).toBeGreaterThanOrEqual(0.80);
    expect(hypothesis.suspectedFile).toBe('src/orders.js');
    expect(hypothesis.evidence.length).toBeGreaterThan(0);
  });

  it('should classify memory-leak', async () => {
    const hypothesis = await triage.runTriageSubagent({ logs: [{ message: "out of memory" }] }, '');
    expect(hypothesis.category).toBe('memory-leak');
  });
});
