const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { Octokit } = require('@octokit/rest');

// Load .env
let token = process.env.GITHUB_TOKEN;
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const match = envContent.match(/^GITHUB_TOKEN=(.*)$/m);
  if (match) {
    token = match[1].trim();
  }
}

if (!token) {
  console.error("Error: GITHUB_TOKEN is not defined in environment or .env file.");
  process.exit(1);
}

const octokit = new Octokit({ auth: token });

async function run() {
  console.log("Fetching authenticated user info...");
  const user = await octokit.users.getAuthenticated();
  const username = user.data.login;
  console.log(`Authenticated as: ${username}`);

  console.log("Creating GitHub repository 'incidentpilot'...");
  try {
    await octokit.repos.createForAuthenticatedUser({
      name: 'incidentpilot',
      description: 'IncidentPilot: Autonomous Incident Response Orchestrator',
      private: false
    });
    console.log("Repository created successfully.");
  } catch (err) {
    if (err.status === 422) {
      console.log("Repository 'incidentpilot' already exists.");
    } else {
      throw err;
    }
  }

  const remoteUrl = `https://x-token-auth:${token}@github.com/${username}/incidentpilot.git`;
  console.log(`Configuring git remote with URL: https://github.com/${username}/incidentpilot.git`);

  try {
    execSync('git remote remove origin', { stdio: 'ignore' });
  } catch (_) {}

  execSync(`git remote add origin ${remoteUrl}`);
  
  console.log("Pushing main branch to GitHub...");
  execSync('git branch -M main');
  execSync('git push -u origin main', { stdio: 'inherit' });
  console.log("Pushed successfully!");
  console.log(`Repository URL: https://github.com/${username}/incidentpilot`);
}

run().catch(err => {
  console.error("Failed to create and push repository:", err);
  process.exit(1);
});
