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

  describe('Input Validation & Error Handling', () => {
    it('should throw error if serviceName is missing, empty, or not a string', () => {
      expect(() => fetchServiceLogs()).toThrow("Invalid serviceName: Must be a non-empty string.");
      expect(() => fetchServiceLogs(null)).toThrow("Invalid serviceName: Must be a non-empty string.");
      expect(() => fetchServiceLogs("")).toThrow("Invalid serviceName: Must be a non-empty string.");
      expect(() => fetchServiceLogs("   ")).toThrow("Invalid serviceName: Must be a non-empty string.");
    });

    it('should throw error if serviceName contains invalid characters (injection protection)', () => {
      expect(() => fetchServiceLogs("order-service; rm -rf /")).toThrow("Invalid serviceName: Only alphanumeric, hyphen, and underscore characters are allowed.");
      expect(() => fetchServiceLogs("order$service")).toThrow("Invalid serviceName: Only alphanumeric, hyphen, and underscore characters are allowed.");
    });

    it('should throw error if sinceMinutes is invalid', () => {
      expect(() => fetchServiceLogs("order-service", -5)).toThrow("Invalid sinceMinutes: Must be a positive finite number.");
      expect(() => fetchServiceLogs("order-service", NaN)).toThrow("Invalid sinceMinutes: Must be a positive finite number.");
      expect(() => fetchServiceLogs("order-service", Infinity)).toThrow("Invalid sinceMinutes: Must be a positive finite number.");
      expect(() => fetchServiceLogs("order-service", "abc")).toThrow("Invalid sinceMinutes: Must be a positive finite number.");
    });

    it('should throw error in tools/call handler if args are missing', async () => {
      await expect(handler({
        method: "tools/call",
        params: { name: "get_logs" }
      })).rejects.toThrow("Missing arguments for tool execution.");
    });

    it('should throw error in tools/call handler if serviceName is missing', async () => {
      await expect(handler({
        method: "tools/call",
        params: { name: "get_logs", arguments: {} }
      })).rejects.toThrow("Missing required argument: 'serviceName'");

      await expect(handler({
        method: "tools/call",
        params: { name: "get_metrics", arguments: {} }
      })).rejects.toThrow("Missing required argument: 'serviceName'");
    });
  });
});
