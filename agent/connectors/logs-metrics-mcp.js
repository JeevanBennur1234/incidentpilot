const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const { execSync } = require('child_process');

const server = new Server({
  name: "logs-metrics-mcp",
  version: "1.0.0"
}, {
  capabilities: {
    tools: {}
  }
});

// Helper to get logs
function fetchServiceLogs(serviceName, sinceMinutes = 5) {
  let logLines = [];
  try {
    const timeStr = `${sinceMinutes}m`;
    const rawLogs = execSync(`docker logs order-service --since ${timeStr}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
    const lines = rawLogs.split('\n').filter(l => l.trim().length > 0);
    for (const line of lines) {
      try {
        logLines.push(JSON.parse(line));
      } catch {
        logLines.push({ message: line, raw: true });
      }
    }
  } catch (err) {
    // Mock / Fallback logs if docker logs is unavailable or fails
    logLines = [
      { level: "INFO", time: new Date(Date.now() - 60000).toISOString(), event: "server_started", port: 3000, msg: "order-service running on port 3000" },
      { level: "INFO", time: new Date(Date.now() - 50000).toISOString(), event: "pool_connect", msg: "Database client connected to pool" },
      { level: "INFO", time: new Date(Date.now() - 40000).toISOString(), event: "order_request_received", body: {}, msg: "Received order creation request" },
      { level: "INFO", time: new Date(Date.now() - 40000).toISOString(), event: "pool_acquire_start", msg: "Acquiring database connection from pool" },
      { level: "INFO", time: new Date(Date.now() - 40000).toISOString(), event: "pool_acquire_success", msg: "Successfully acquired connection" },
      { level: "INFO", time: new Date(Date.now() - 38000).toISOString(), event: "db_query_start", msg: "Executing database query (simulated)..." },
      { level: "INFO", time: new Date(Date.now() - 36000).toISOString(), event: "db_query_complete", msg: "Database query completed" },
      { level: "WARN", time: new Date(Date.now() - 36000).toISOString(), event: "validation_failure", msg: "Validation failed: missing customerId. Connection LEAKED due to unhandled block." },
      { level: "ERROR", time: new Date(Date.now() - 36000).toISOString(), event: "order_request_error", err: "Missing customerId", msg: "Error in order processing" },
      { level: "ERROR", time: new Date(Date.now() - 35000).toISOString(), event: "connection_leak", msg: "Leak warning: client connection is not released due to early validation return." }
    ];
  }
  return logLines;
}

// Define request handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_logs",
        description: "Read service log output and return parsed JSON log entries",
        inputSchema: {
          type: "object",
          properties: {
            serviceName: { type: "string", description: "The microservice name (e.g. order-service)" },
            sinceMinutes: { type: "number", description: "Fetch logs since this many minutes ago (default: 5)" }
          },
          required: ["serviceName"]
        }
      },
      {
        name: "get_metrics",
        description: "Fetch a metrics snapshot for the service, including database pool metrics",
        inputSchema: {
          type: "object",
          properties: {
            serviceName: { type: "string", description: "The microservice name (e.g. order-service)" }
          },
          required: ["serviceName"]
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "get_logs") {
    const logs = fetchServiceLogs(args.serviceName, args.sinceMinutes);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(logs, null, 2)
        }
      ]
    };
  }

  if (name === "get_metrics") {
    const logs = fetchServiceLogs(args.serviceName, 5);
    
    let leaks = 0;
    let totalRequests = 0;
    let errorRequests = 0;
    for (const log of logs) {
      if (log.event === 'connection_leak') leaks++;
      if (log.event === 'order_request_received') totalRequests++;
      if (log.event === 'order_request_error') errorRequests++;
    }

    const activeConnections = Math.min(5, leaks);
    const idleConnections = 5 - activeConnections;
    const errorRate = totalRequests > 0 ? (errorRequests / totalRequests) * 100 : 0;

    const metrics = {
      poolSize: 5,
      activeConnections,
      idleConnections,
      waitingConnections: activeConnections >= 5 ? 1 : 0,
      requestLatencyP99Ms: activeConnections >= 5 ? 2000 : 250,
      errorRatePercent: parseFloat(errorRate.toFixed(2)) || 20.0
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(metrics, null, 2)
        }
      ]
    };
  }

  throw new Error(`Tool not found: ${name}`);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Logs and Metrics MCP Server running on stdio");
}

if (require.main === module) {
  main().catch((err) => {
    console.error("Fatal error running MCP Server:", err);
    process.exit(1);
  });
}

module.exports = { server, fetchServiceLogs };
