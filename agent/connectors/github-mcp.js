const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const { Octokit } = require('@octokit/rest');

const server = new Server({
  name: "github-mcp",
  version: "1.0.0"
}, {
  capabilities: {
    tools: {}
  }
});

// Initialize Octokit dynamically using getters
const octokit = {
  get git() {
    return new Octokit({ auth: process.env.GITHUB_TOKEN }).git;
  },
  get repos() {
    return new Octokit({ auth: process.env.GITHUB_TOKEN }).repos;
  },
  get pulls() {
    return new Octokit({ auth: process.env.GITHUB_TOKEN }).pulls;
  },
  get issues() {
    return new Octokit({ auth: process.env.GITHUB_TOKEN }).issues;
  }
};

// Helper to parse "owner/repo" string
function parseRepo(repoPath) {
  const parts = repoPath.split('/');
  if (parts.length !== 2) {
    throw new Error(`Invalid repoPath format: "${repoPath}". Expected format: "owner/repo"`);
  }
  return { owner: parts[0], repo: parts[1] };
}

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_file_content",
        description: "Fetch a file's content from a GitHub repository.",
        inputSchema: {
          type: "object",
          properties: {
            repoPath: { type: "string", description: "Format: owner/repo" },
            filePath: { type: "string", description: "Path to the file inside the repo" }
          },
          required: ["repoPath", "filePath"]
        }
      },
      {
        name: "create_branch",
        description: "Create a new branch from a base branch in a GitHub repository.",
        inputSchema: {
          type: "object",
          properties: {
            repoPath: { type: "string", description: "Format: owner/repo" },
            branchName: { type: "string", description: "Name of the new branch to create" },
            baseBranch: { type: "string", description: "Base branch to branch off of (e.g. main)" }
          },
          required: ["repoPath", "branchName", "baseBranch"]
        }
      },
      {
        name: "commit_file_change",
        description: "Commit changes to a file on a branch.",
        inputSchema: {
          type: "object",
          properties: {
            repoPath: { type: "string", description: "Format: owner/repo" },
            branchName: { type: "string", description: "The branch to commit to" },
            filePath: { type: "string", description: "The path of the file to modify" },
            newContent: { type: "string", description: "Full new content of the file" },
            commitMessage: { type: "string", description: "Commit message" }
          },
          required: ["repoPath", "branchName", "filePath", "newContent", "commitMessage"]
        }
      },
      {
        name: "open_pull_request",
        description: "Create a new pull request on GitHub.",
        inputSchema: {
          type: "object",
          properties: {
            repoPath: { type: "string", description: "Format: owner/repo" },
            branchName: { type: "string", description: "Head branch (the branch containing changes)" },
            baseBranch: { type: "string", description: "Base branch to merge into (e.g. main)" },
            title: { type: "string", description: "PR title" },
            body: { type: "string", description: "PR description body" }
          },
          required: ["repoPath", "branchName", "baseBranch", "title", "body"]
        }
      },
      {
        name: "comment_on_pr",
        description: "Comment on an existing pull request or issue.",
        inputSchema: {
          type: "object",
          properties: {
            repoPath: { type: "string", description: "Format: owner/repo" },
            prNumber: { type: "number", description: "Pull request / Issue number" },
            commentBody: { type: "string", description: "Markdown text comment body" }
          },
          required: ["repoPath", "prNumber", "commentBody"]
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    const token = process.env.GITHUB_TOKEN;
    if (!token || token === 'your_github_token_here') {
      console.error(`[GITHUB MCP] No GITHUB_TOKEN environment variable configured. Emulating GitHub API call for "${name}"...`);
      if (name === "get_file_content") {
        return {
          content: [{ type: "text", text: "// Simulated file content" }]
        };
      }
      if (name === "create_branch") {
        return {
          content: [{ type: "text", text: `Successfully created branch "${args.branchName}" (SIMULATED SHA)` }]
        };
      }
      if (name === "commit_file_change") {
        return {
          content: [{ type: "text", text: `Successfully committed change to "${args.filePath}" (SIMULATED COMMIT SHA)` }]
        };
      }
      if (name === "open_pull_request") {
        return {
          content: [{ type: "text", text: JSON.stringify({ prNumber: 42, htmlUrl: `https://github.com/${args.repoPath}/pull/42`, prUrl: `https://github.com/${args.repoPath}/pull/42`, url: `https://github.com/${args.repoPath}/pull/42` }) }]
        };
      }
      if (name === "comment_on_pr") {
        return {
          content: [{ type: "text", text: `Successfully commented on issue/PR #${args.prNumber} (SIMULATED COMMENT ID)` }]
        };
      }
    }

    if (name === "get_file_content") {
      const { owner, repo } = parseRepo(args.repoPath);
      const res = await octokit.repos.getContent({
        owner,
        repo,
        path: args.filePath
      });

      // Handle file content returned in base64 encoding
      if (Array.isArray(res.data)) {
        throw new Error(`Path "${args.filePath}" is a directory, not a file.`);
      }
      
      let content = '';
      if (res.data.encoding === 'base64') {
        content = Buffer.from(res.data.content, 'base64').toString('utf8');
      } else {
        content = res.data.content;
      }

      return {
        content: [
          {
            type: "text",
            text: content
          }
        ]
      };
    }

    if (name === "create_branch") {
      const { owner, repo } = parseRepo(args.repoPath);
      // Get base branch SHA
      const baseRef = await octokit.git.getRef({
        owner,
        repo,
        ref: `heads/${args.baseBranch}`
      });

      const sha = baseRef.data.object.sha;

      // Create new branch reference
      const newRef = await octokit.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${args.branchName}`,
        sha
      });

      return {
        content: [
          {
            type: "text",
            text: `Successfully created branch "${args.branchName}" (SHA: ${sha})`
          }
        ]
      };
    }

    if (name === "commit_file_change") {
      const { owner, repo } = parseRepo(args.repoPath);
      
      // Get file SHA if it already exists on target branch
      let sha;
      try {
        const fileContent = await octokit.repos.getContent({
          owner,
          repo,
          path: args.filePath,
          ref: args.branchName
        });
        if (!Array.isArray(fileContent.data)) {
          sha = fileContent.data.sha;
        }
      } catch (err) {
        // File does not exist yet (will create new file)
      }

      const res = await octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: args.filePath,
        message: args.commitMessage,
        content: Buffer.from(args.newContent).toString('base64'),
        branch: args.branchName,
        sha
      });

      return {
        content: [
          {
            type: "text",
            text: `Successfully committed change to "${args.filePath}" (Commit SHA: ${res.data.commit.sha})`
          }
        ]
      };
    }

    if (name === "open_pull_request") {
      const { owner, repo } = parseRepo(args.repoPath);
      const pr = await octokit.pulls.create({
        owner,
        repo,
        head: args.branchName,
        base: args.baseBranch,
        title: args.title,
        body: args.body
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              prNumber: pr.data.number,
              htmlUrl: pr.data.html_url
            }, null, 2)
          }
        ]
      };
    }

    if (name === "comment_on_pr") {
      const { owner, repo } = parseRepo(args.repoPath);
      const comment = await octokit.issues.createComment({
        owner,
        repo,
        issue_number: args.prNumber,
        body: args.commentBody
      });

      return {
        content: [
          {
            type: "text",
            text: `Successfully commented on issue/PR #${args.prNumber} (Comment ID: ${comment.data.id})`
          }
        ]
      };
    }

    throw new Error(`Tool not found: ${name}`);
  } catch (err) {
    return {
      content: [
        {
          type: "text",
          text: `GitHub MCP Error: ${err.message}`
        }
      ],
      isError: true
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("GitHub MCP Server running on stdio");
}

if (require.main === module) {
  main().catch((err) => {
    console.error("Fatal error running GitHub MCP Server:", err);
    process.exit(1);
  });
}

module.exports = { server };
