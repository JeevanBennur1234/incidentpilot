const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const path = require('path');

// Ensure GITHUB_TOKEN is present
if (!process.env.GITHUB_TOKEN) {
  console.error("Error: GITHUB_TOKEN environment variable is not set.");
  console.error("Please run with: GITHUB_TOKEN=your_token TEST_REPO=owner/repo node tests/integration/github-mcp.manual-test.js");
  process.exit(1);
}

// Target repo path to test against (e.g. "JeevanBennur1234/devops_lab")
const TEST_REPO = process.env.TEST_REPO;
if (!TEST_REPO) {
  console.error("Error: TEST_REPO environment variable is not set.");
  console.error("Please run with: GITHUB_TOKEN=your_token TEST_REPO=owner/repo node tests/integration/github-mcp.manual-test.js");
  process.exit(1);
}

async function run() {
  console.log(`Starting manual integration test for GitHub MCP connector against repository: "${TEST_REPO}"...\n`);

  const transport = new StdioClientTransport({
    command: "node",
    args: [path.join(__dirname, "../../agent/connectors/github-mcp.js")]
  });

  const client = new Client({
    name: "github-mcp-tester",
    version: "1.0.0"
  }, {
    capabilities: {}
  });

  try {
    await client.connect(transport);
    console.log("Connected to GitHub MCP Server successfully.\n");

    const timestamp = Date.now();
    const branchName = `mcp-test-branch-${timestamp}`;
    const baseBranch = 'main';
    const filePath = 'test-github-mcp.txt';
    const newContent = `This is a test file created by the GitHub MCP connector at ${new Date(timestamp).toISOString()}.\n`;
    const commitMessage = 'test: add test file via github-mcp connector';

    // Step 1: Create branch
    console.log(`Step 1: Creating branch "${branchName}" from base "${baseBranch}"...`);
    const branchResult = await client.callTool({
      name: "create_branch",
      arguments: {
        repoPath: TEST_REPO,
        branchName,
        baseBranch
      }
    });
    console.log(`Result: ${branchResult.content[0].text}\n`);

    // Step 2: Commit file change
    console.log(`Step 2: Committing file "${filePath}" to branch "${branchName}"...`);
    const commitResult = await client.callTool({
      name: "commit_file_change",
      arguments: {
        repoPath: TEST_REPO,
        branchName,
        filePath,
        newContent,
        commitMessage
      }
    });
    console.log(`Result: ${commitResult.content[0].text}\n`);

    // Step 3: Open Pull Request
    console.log(`Step 3: Opening Pull Request...`);
    const prResult = await client.callTool({
      name: "open_pull_request",
      arguments: {
        repoPath: TEST_REPO,
        branchName,
        baseBranch,
        title: `Test PR - ${branchName}`,
        body: `Automated test pull request opened by IncidentPilot GitHub MCP manual verification test.`
      }
    });
    
    // Parse the JSON response
    const prInfo = JSON.parse(prResult.content[0].text);
    console.log(`SUCCESS! Pull Request opened:`);
    console.log(`- PR Number: ${prInfo.prNumber}`);
    console.log(`- PR URL: ${prInfo.htmlUrl}\n`);

    // Step 4: Fetch file content to verify read
    console.log(`Step 4: Fetching the created file content to verify read capability...`);
    const contentResult = await client.callTool({
      name: "get_file_content",
      arguments: {
        repoPath: TEST_REPO,
        filePath
      }
    });
    console.log(`Fetched File Content:\n----------------------\n${contentResult.content[0].text}----------------------\n`);

  } catch (err) {
    console.error("Test failed with error:", err);
  } finally {
    try {
      await transport.close();
      console.log("Stdio transport closed.");
    } catch (_) {}
  }
}

run();
