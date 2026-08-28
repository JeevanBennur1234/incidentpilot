const path = require('path');
// Load environment variables from .env
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const express = require('express');
const cors = require('cors');
const { SSEServerTransport } = require('@modelcontextprotocol/sdk/server/sse.js');
const { createLogsMetricsServer } = require('../connectors/logs-metrics-mcp.js');

const app = express();
app.use(cors());
app.use(express.json());

const transports = new Map();

app.get('/sse', async (req, res) => {
  console.log('Received GET request to /sse (Logs-Metrics SSE transport)');
  const transport = new SSEServerTransport('/messages', res);
  const sessionId = transport.sessionId;
  transports.set(sessionId, transport);
  
  res.on('close', () => {
    console.log(`Connection closed for session ${sessionId}`);
    transports.delete(sessionId);
  });

  const server = createLogsMetricsServer();
  await server.connect(transport);
});

app.post('/messages', async (req, res) => {
  const sessionId = req.query.sessionId;
  const transport = transports.get(sessionId);
  if (!transport) {
    res.status(404).send('Session not found or expired');
    return;
  }
  await transport.handlePostMessage(req, res, req.body);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Logs-Metrics MCP Server running on http://localhost:${PORT}`);
  console.log(`SSE endpoint: http://localhost:${PORT}/sse`);
  console.log(`POST endpoint: http://localhost:${PORT}/messages`);
});
