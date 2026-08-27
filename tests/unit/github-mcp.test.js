const { server } = require('../../agent/connectors/github-mcp');

jest.mock('@octokit/rest', () => {
  return {
    Octokit: jest.fn().mockImplementation(() => {
      return {
        git: {
          getRef: jest.fn().mockResolvedValue({ data: { object: { sha: 'base-sha' } } }),
          createRef: jest.fn().mockResolvedValue({ data: {} })
        },
        repos: {
          getContent: jest.fn().mockResolvedValue({ data: { sha: 'file-sha', content: 'aGVsbG8=', encoding: 'base64' } }),
          createOrUpdateFileContents: jest.fn().mockResolvedValue({ data: { commit: { sha: 'commit-sha' } } })
        },
        pulls: {
          create: jest.fn().mockResolvedValue({ data: { number: 42, html_url: 'https://github.com/mock/pull/42' } })
        },
        issues: {
          createComment: jest.fn().mockResolvedValue({ data: { id: 101 } })
        }
      };
    })
  };
});

describe('GitHub MCP Connector Unit Tests', () => {
  const handler = server._requestHandlers.get('tools/call');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should run tools in simulated mode when GITHUB_TOKEN is not configured', async () => {
    const oldToken = process.env.GITHUB_TOKEN;
    delete process.env.GITHUB_TOKEN;

    const tools = ['get_file_content', 'create_branch', 'commit_file_change', 'open_pull_request', 'comment_on_pr'];
    for (const tool of tools) {
      const response = await handler({
        method: "tools/call",
        params: {
          name: tool,
          arguments: {
            repoPath: "owner/repo",
            filePath: "server.js",
            branchName: "branch",
            baseBranch: "main",
            newContent: "content",
            commitMessage: "commit",
            title: "title",
            body: "body",
            prNumber: 42,
            commentBody: "comment"
          }
        }
      });
      expect(response.content[0].text).toBeDefined();
    }

    process.env.GITHUB_TOKEN = oldToken;
  });

  it('should run tools via mocked Octokit when GITHUB_TOKEN is configured', async () => {
    process.env.GITHUB_TOKEN = 'real-mocked-token';

    // 1. get_file_content
    let response = await handler({
      method: "tools/call",
      params: {
        name: "get_file_content",
        arguments: { repoPath: "owner/repo", filePath: "server.js" }
      }
    });
    expect(response.content[0].text).toBe('hello');

    // 2. create_branch
    response = await handler({
      method: "tools/call",
      params: {
        name: "create_branch",
        arguments: { repoPath: "owner/repo", branchName: "fix", baseBranch: "main" }
      }
    });
    expect(response.content[0].text).toContain('Successfully created branch');

    // 3. commit_file_change
    response = await handler({
      method: "tools/call",
      params: {
        name: "commit_file_change",
        arguments: { repoPath: "owner/repo", branchName: "fix", filePath: "server.js", newContent: "fix", commitMessage: "fix" }
      }
    });
    expect(response.content[0].text).toContain('Successfully committed change');

    // 4. open_pull_request
    response = await handler({
      method: "tools/call",
      params: {
        name: "open_pull_request",
        arguments: { repoPath: "owner/repo", branchName: "fix", baseBranch: "main", title: "PR", body: "body" }
      }
    });
    const resultObj = JSON.parse(response.content[0].text);
    expect(resultObj.prNumber).toBe(42);

    // 5. comment_on_pr
    response = await handler({
      method: "tools/call",
      params: {
        name: "comment_on_pr",
        arguments: { repoPath: "owner/repo", prNumber: 42, commentBody: "LGTM" }
      }
    });
    expect(response.content[0].text).toContain('Successfully commented');

    delete process.env.GITHUB_TOKEN;
  });
});
