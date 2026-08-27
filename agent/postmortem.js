const fs = require('fs');
const path = require('path');
const dbStore = require('./db/store');

function generatePostmortem(sessionId) {
  console.log(`[POSTMORTEM] Generating postmortem for session: "${sessionId}"...`);
  
  const timeline = dbStore.getSessionTimeline(sessionId);
  if (!timeline) {
    throw new Error(`No timeline data found for session ${sessionId}`);
  }

  const session = timeline.session;
  const events = timeline.events;

  const triageEvent = events.find(e => e.stage === 'triage_complete' || e.stage === 'triage complete');
  const triagePayload = triageEvent ? triageEvent.payload : {};

  const patchEvent = events.find(e => e.stage === 'patch_proposed' || e.stage === 'patch proposed');
  const patchPayload = patchEvent ? patchEvent.payload : {};

  const prEvent = events.find(e => e.stage === 'PR_opened' || e.stage === 'PR opened' || e.stage === 'pr_opened');
  const prPayload = prEvent ? prEvent.payload : {};

  const status = session.status;
  const startedAt = session.started_at;
  const endedAt = session.ended_at || new Date().toISOString();

  let md = `# Incident Postmortem - Session ${sessionId}

## Summary
- **Session Status**: ${status}
- **Incident Started**: ${startedAt}
- **Incident Ended**: ${endedAt}
- **Service Name**: order-service
- **Suspected File**: ${triagePayload.suspectedFile || 'server.js'}

## Timeline
`;

  events.forEach(e => {
    md += `- **${e.timestamp}** [${e.stage}]: ${JSON.stringify(e.payload)}\n`;
  });

  md += `
## Root Cause
- **Category**: ${triagePayload.category || 'connection-leak'}
- **Confidence**: ${triagePayload.confidence || 'N/A'}
- **Reasoning**: ${triagePayload.reasoning || 'N/A'}

## Fix Applied
\`\`\`diff
${patchPayload.diff || 'No patch was applied.'}
\`\`\`

## Verification Evidence
- **Tests Passed**: ${patchPayload.testResults ? patchPayload.testResults.pass : 'N/A'}
- **Verification Output**: ${patchPayload.testResults ? patchPayload.testResults.output : 'N/A'}
- **Crash Resolved**: ${patchPayload.crashReproducedAfterPatch === false ? 'YES' : 'NO'}

## PR Link
- **PR URL**: ${prPayload.prUrl || prPayload.htmlUrl || 'No PR opened (rejected/escalated).'}
- **Branch**: ${prPayload.branchName || 'N/A'}
`;

  const outputDir = path.resolve(__dirname, '../postmortems');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, `${sessionId}.md`);
  fs.writeFileSync(outputPath, md, 'utf8');
  console.log(`[POSTMORTEM] Written postmortem to: ${outputPath}`);
  return outputPath;
}

module.exports = {
  generatePostmortem
};
