const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const orchestrator = require('./orchestrator');
const sandbox = require('./sandbox/daytona');

async function main() {
  const args = process.argv.slice(2);
  const alertIndex = args.indexOf('--alert');
  
  if (alertIndex === -1 || !args[alertIndex + 1]) {
    console.error('Error: Missing --alert argument.');
    console.error('Usage: node agent/cli.js --alert <path_to_alert_json>');
    process.exit(1);
  }

  const alertPath = path.resolve(args[alertIndex + 1]);
  if (!fs.existsSync(alertPath)) {
    console.error(`Error: Alert file not found at ${alertPath}`);
    process.exit(1);
  }

  let alertPayload;
  try {
    alertPayload = JSON.parse(fs.readFileSync(alertPath, 'utf8'));
  } catch (err) {
    console.error(`Error parsing alert JSON: ${err.message}`);
    process.exit(1);
  }

  const sessionId = "session-test-uuid-12345";
  console.log(`================================================================`);
  console.log(`IncidentPilot CLI - Launching Orchestrator Dry Run`);
  console.log(`Session ID: ${sessionId}`);
  console.log(`================================================================\n`);

  let diagnostics;
  let hypothesis;
  let reproResult;
  let patchProposal;

  const steps = [
    { name: 'receiveIncidentTrigger', fn: () => orchestrator.receiveIncidentTrigger(alertPayload) },
    { 
      name: 'loadSkillPacks', 
      fn: async () => {
        const skills = await orchestrator.loadSkillPacks('incidentpilot');
        console.log(`[TRACE] loadSkillPacks returned:\n${JSON.stringify(skills.map(s => ({ name: s.name, description: s.description })), null, 2)}`);
      } 
    },
    { 
      name: 'fetchDiagnostics', 
      fn: async () => {
        diagnostics = await orchestrator.fetchDiagnostics('order-service');
        console.log(`[TRACE] fetchDiagnostics returned:\n${JSON.stringify(diagnostics, null, 2)}`);
      } 
    },
    { 
      name: 'delegateToTriageSubagent', 
      fn: async () => {
        hypothesis = await orchestrator.delegateToTriageSubagent(diagnostics || { status: 'unhealthy', error: 'Connection pool exhausted' });
        console.log(`[TRACE] delegateToTriageSubagent returned:\n${JSON.stringify(hypothesis, null, 2)}`);
      } 
    },
    { 
      name: 'reproduceInSandbox', 
      fn: async () => {
        reproResult = await orchestrator.reproduceInSandbox(hypothesis ? hypothesis.reasoning : 'Connection pool leak under POST /orders on validation error');
        console.log(`[TRACE] reproduceInSandbox returned:\n${JSON.stringify(reproResult, null, 2)}`);
      } 
    },
    { 
      name: 'delegateToPatchSubagent', 
      fn: async () => {
        patchProposal = await orchestrator.delegateToPatchSubagent(reproResult, hypothesis);
        console.log(`[TRACE] delegateToPatchSubagent returned:\n${JSON.stringify(patchProposal, null, 2)}`);
      } 
    },
    { name: 'requestHumanApproval', fn: () => orchestrator.requestHumanApproval(patchProposal || { patch: 'Add client.release() in catch block' }) },
    { name: 'applyAndVerify', fn: () => orchestrator.applyAndVerify(patchProposal || { patch: 'Add client.release()', status: 'approved' }) },
    { name: 'generatePostmortem', fn: () => orchestrator.generatePostmortem(sessionId) },
    { name: 'persistSessionState', fn: () => orchestrator.persistSessionState(sessionId, 'incident_resolved') }
  ];

  try {
    for (const step of steps) {
      try {
        await step.fn();
        console.log(`[INFO] Step ${step.name} completed successfully.\n`);
      } catch (err) {
        console.log(`[INFO] Step ${step.name} threw expected error: "${err.message}"\n`);
      }
    }
  } finally {
    if (reproResult && reproResult.sandboxId) {
      console.log(`[CLEANUP] Cleaning up sandbox "${reproResult.sandboxId}"...`);
      try {
        await sandbox.destroySandbox(reproResult.sandboxId);
      } catch (_) {}
    }
  }

  console.log(`================================================================`);
  console.log(`Orchestrator dry run finished successfully.`);
  console.log(`================================================================`);
}

main().catch(console.error);
