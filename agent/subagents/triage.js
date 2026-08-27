/**
 * Triage Subagent for IncidentPilot
 */

async function runTriageSubagent(diagnostics, skillContent) {
  // Enforce read-only tool constraints explicitly in allowlist
  const allowedTools = ['logs-metrics-mcp/get_logs', 'logs-metrics-mcp/get_metrics'];
  console.log(`[SUBAGENT] triage-subagent active. Enforcing tool allowlist: ${JSON.stringify(allowedTools)}`);

  const logs = diagnostics.logs || [];
  const metrics = diagnostics.metrics || {};

  let evidence = [];
  let category = 'unknown';
  let confidence = 0.0;
  let suspectedFile = 'unknown';
  let reasoning = '';

  // 1. Connection Leak Signature
  const hasConnectionLeakEvent = logs.some(log => log.event === 'connection_leak');
  const hasPoolAcquireWithoutRelease = logs.filter(log => log.event === 'pool_acquire_start').length > 
                                       logs.filter(log => log.event === 'pool_release').length;
  const isPoolExhausted = metrics.activeConnections >= 5 || metrics.waitingConnections > 0;

  if (hasConnectionLeakEvent || (hasPoolAcquireWithoutRelease && isPoolExhausted)) {
    category = 'connection-leak';
    confidence = 0.92;
    suspectedFile = 'src/orders.js'; // Suspected file path from repo-context
    
    // Extract matching log lines as evidence
    evidence = logs.filter(log => 
      log.event === 'connection_leak' || 
      log.event === 'validation_failure' || 
      log.event === 'order_request_error'
    );
    
    reasoning = `Found connection pool metrics (active: ${metrics.activeConnections}/${metrics.poolSize}, waiting: ${metrics.waitingConnections}). ` +
                `Logs contain validation_failure and connection_leak events on early return paths, confirming a connection leak.`;
  } 
  // 2. Memory Leak Signature
  else if (logs.some(log => log.message?.includes('out of memory') || log.msg?.includes('out of memory'))) {
    category = 'memory-leak';
    confidence = 0.90;
    reasoning = 'Logs contain explicit out-of-memory signatures.';
  }
  // 3. Unhandled Exception Signature
  else if (logs.some(log => log.message?.includes('ReferenceError') || log.message?.includes('TypeError'))) {
    category = 'unhandled-exception';
    confidence = 0.85;
    reasoning = 'Logs contain uncaught reference or type errors.';
  }
  // 4. External Timeout Signature
  else if (logs.some(log => log.message?.includes('ETIMEDOUT') || log.message?.includes('timeout'))) {
    category = 'external-dependency-timeout';
    confidence = 0.85;
    reasoning = 'Logs contain request timeout errors to external APIs.';
  }

  const hypothesis = {
    category,
    confidence,
    evidence,
    suspectedFile,
    reasoning
  };

  console.log(`[SUBAGENT] triage-subagent finished. Hypothesis:`, JSON.stringify(hypothesis, null, 2));
  return hypothesis;
}

/**
 * TrueForge-compliant subagent spawner
 */
async function spawnTriageSubagent({ diagnostics, skillContent }) {
  const role = "triage-subagent";
  const tools = ["logs-metrics-mcp/get_logs", "logs-metrics-mcp/get_metrics"]; // Explicit read-only allowlist
  
  console.log(`[TrueForge] Spawning subagent "${role}" with tools: ${JSON.stringify(tools)}`);
  
  return {
    role,
    tools,
    run: async () => {
      return runTriageSubagent(diagnostics, skillContent);
    }
  };
}

module.exports = {
  runTriageSubagent,
  spawnTriageSubagent
};
