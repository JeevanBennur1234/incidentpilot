const { server, fetchServiceLogs } = require('../../agent/connectors/logs-metrics-mcp');
const child_process = require('child_process');

jest.mock('child_process');

describe('Logs and Metrics MCP Connector Unit Tests', () => {
  const handler = server._requestHandlers.get('tools/call');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should parse raw Docker logs when execSync succeeds', () => {
    const rawDockerOutput = '{"level":"INFO","event":"test_event","msg":"hello"}\nnot-json-line\n';
    child_process.execSync.mockReturnValue(rawDockerOutput);

    const logs = fetchServiceLogs('order-service', 5);
    expect(logs.length).toBe(2);
    expect(logs[0].event).toBe('test_event');
    expect(logs[1].message).toBe('not-json-line');
  });

  it('should call get_logs tool successfully via MCP JSON-RPC handler', async () => {
    child_process.execSync.mockImplementation(() => {
      throw new Error('Docker offline');
    });

    const response = await handler({
      method: "tools/call",
      params: {
        name: "get_logs",
        arguments: {
          serviceName: "order-service",
          sinceMinutes: 5
        }
      }
    });

    const resultObj = JSON.parse(response.content[0].text);
    expect(resultObj.length).toBeGreaterThan(0);
    expect(resultObj.some(l => l.event === 'connection_leak')).toBe(true);
  });

  it('should call get_metrics tool successfully via MCP JSON-RPC handler', async () => {
    child_process.execSync.mockImplementation(() => {
      throw new Error('Docker offline');
    });

    const response = await handler({
      method: "tools/call",
      params: {
        name: "get_metrics",
        arguments: {
          serviceName: "order-service"
        }
      }
    });

    const resultObj = JSON.parse(response.content[0].text);
    expect(resultObj.poolSize).toBe(5);
    expect(resultObj.activeConnections).toBe(1);
    expect(resultObj.waitingConnections).toBe(0);
  });
});
