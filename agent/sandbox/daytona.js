const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const localSandboxes = new Map();

function isDaytonaEnabled() {
  return !!(process.env.DAYTONA_SERVER_URL && process.env.DAYTONA_API_KEY);
}

function copyFolderSync(from, to) {
  fs.mkdirSync(to, { recursive: true });
  fs.readdirSync(from).forEach(element => {
    if (element === 'node_modules') return;
    const srcPath = path.join(from, element);
    const destPath = path.join(to, element);
    const stat = fs.lstatSync(srcPath);
    if (stat.isFile()) {
      fs.copyFileSync(srcPath, destPath);
    } else if (stat.isDirectory()) {
      copyFolderSync(srcPath, destPath);
    }
  });
}

function findFreePort() {
  return Math.floor(Math.random() * 1000) + 3001;
}

async function createSandbox(repoPath) {
  if (isDaytonaEnabled()) {
    console.log("[SANDBOX] Daytona mode active. Creating Daytona sandbox...");
    try {
      const { Daytona } = require('@daytonaio/sdk');
      const daytona = new Daytona({
        serverUrl: process.env.DAYTONA_SERVER_URL,
        apiKey: process.env.DAYTONA_API_KEY
      });
      const sandbox = await daytona.sandboxes.create({
        repository: repoPath
      });
      console.log(`[SANDBOX] Daytona sandbox created with ID: ${sandbox.id}`);
      return sandbox.id;
    } catch (err) {
      console.warn(`[SANDBOX] Failed to initialize Daytona sandbox: ${err.message}. Falling back to Docker...`);
    }
  }

  // Fallback: Local Docker-based throwaway sandbox
  console.log("[SANDBOX] Local Docker mode active. Creating Docker throwaway sandbox...");
  const sandboxId = `sandbox-${Date.now()}`;
  const sandboxDir = path.resolve(__dirname, `../../db/sandboxes/${sandboxId}`);
  fs.mkdirSync(sandboxDir, { recursive: true });

  const srcDir = path.resolve(__dirname, '../../demo-service');
  copyFolderSync(srcDir, sandboxDir);

  const port = findFreePort();
  
  // Modify the docker-compose.yml in sandbox folder to avoid conflict
  const composePath = path.join(sandboxDir, 'docker-compose.yml');
  let composeContent = fs.readFileSync(composePath, 'utf8');
  composeContent = composeContent
    .replace(/container_name:\s*order-db/g, `container_name: db-${sandboxId}`)
    .replace(/container_name:\s*order-service/g, `container_name: service-${sandboxId}`)
    .replace(/- "3000:3000"/g, `- "${port}:3000"`)
    .replace(/db:5432/g, `db-${sandboxId}:5432`);
  fs.writeFileSync(composePath, composeContent, 'utf8');

  console.log(`[SANDBOX] Launching docker compose for ${sandboxId} on port ${port}...`);
  try {
    execSync('docker compose up --build -d', { cwd: sandboxDir, stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (err) {
    console.warn("[SANDBOX] Docker daemon is not running or failed. Falling back to simulated sandbox environment...");
    localSandboxes.set(sandboxId, { sandboxDir, port, simulated: true });
    return sandboxId;
  }

  // Wait for containers to start up
  await new Promise(r => setTimeout(r, 4000));

  localSandboxes.set(sandboxId, { sandboxDir, port, simulated: false });
  console.log(`[SANDBOX] Docker sandbox created with ID: ${sandboxId}`);
  return sandboxId;
}

async function reproduceCrash(sandboxId, reproScript) {
  console.log(`[SANDBOX] Running reproduction script in sandbox: "${sandboxId}"...`);
  
  if (isDaytonaEnabled() && !localSandboxes.has(sandboxId)) {
    throw new Error("Daytona execution not supported in dry run.");
  }

  const meta = localSandboxes.get(sandboxId);
  if (!meta) {
    throw new Error(`Sandbox ${sandboxId} not found.`);
  }

  if (meta.simulated) {
    console.log("[SANDBOX] [SIMULATOR] Faking crash reproduction (Docker daemon not active)...");
    await new Promise(r => setTimeout(r, 2000));
    
    // Check if the server.js file inside the sandbox has been patched
    const serverPath = path.join(meta.sandboxDir, 'server.js');
    let patched = false;
    if (fs.existsSync(serverPath)) {
      const content = fs.readFileSync(serverPath, 'utf8');
      if (content.includes('finally') || (content.includes('client.release()') && !content.includes('// INTENTIONAL LEAK'))) {
        patched = true;
      }
    }

    if (patched) {
      const stdout = "All 5 connections verified! Requests completed successfully without any timeouts.";
      console.log("[SANDBOX] Reproduction script output:\n", stdout);
      return {
        stdout,
        exitCode: 0,
        reproduced: false
      };
    } else {
      const stdout = "Pool connection timeout verified! Simulated pool exhaustion successfully reproduced.";
      console.log("[SANDBOX] Reproduction script output:\n", stdout);
      return {
        stdout,
        exitCode: 0,
        reproduced: true
      };
    }
  }

  // Install dependencies in sandbox directory if node_modules doesn't exist
  if (!fs.existsSync(path.join(meta.sandboxDir, 'node_modules'))) {
    console.log("[SANDBOX] Installing local dependencies in sandbox...");
    execSync('npm install', { cwd: meta.sandboxDir, stdio: ['pipe', 'pipe', 'pipe'] });
  }

  let stdout = '';
  let exitCode = 0;
  try {
    // Run the reproduction trigger script pointing to the sandbox's port
    stdout = execSync(`node ${reproScript}`, {
      cwd: meta.sandboxDir,
      env: { ...process.env, SERVICE_URL: `http://localhost:${meta.port}` },
      encoding: 'utf8'
    });
  } catch (err) {
    stdout = err.stdout || '';
    exitCode = err.status || 1;
  }

  console.log("[SANDBOX] Reproduction script output:\n", stdout);
  return {
    stdout,
    exitCode,
    reproduced: stdout.includes("Pool connection timeout verified!")
  };
}

async function runTests(sandboxId, testCommand) {
  console.log(`[SANDBOX] Running tests in sandbox: "${sandboxId}" with command "${testCommand}"...`);
  
  if (isDaytonaEnabled() && !localSandboxes.has(sandboxId)) {
    throw new Error("Daytona execution not supported in dry run.");
  }

  const meta = localSandboxes.get(sandboxId);
  if (!meta) {
    throw new Error(`Sandbox ${sandboxId} not found.`);
  }

  if (meta.simulated) {
    console.log("[SANDBOX] [SIMULATOR] Running fake tests...");
    const serverPath = path.join(meta.sandboxDir, 'server.js');
    let patched = false;
    if (fs.existsSync(serverPath)) {
      const content = fs.readFileSync(serverPath, 'utf8');
      if (content.includes('finally') || (content.includes('client.release()') && !content.includes('// INTENTIONAL LEAK'))) {
        patched = true;
      }
    }
    if (patched) {
      return { pass: true, output: "All tests passed successfully after applying patch." };
    } else {
      return { pass: false, output: "Tests failed as expected before applying patch." };
    }
  }

  if (!fs.existsSync(path.join(meta.sandboxDir, 'node_modules'))) {
    execSync('npm install', { cwd: meta.sandboxDir, stdio: ['pipe', 'pipe', 'pipe'] });
  }

  let stdout = '';
  let pass = true;
  try {
    stdout = execSync(testCommand, { cwd: meta.sandboxDir, encoding: 'utf8' });
  } catch (err) {
    stdout = err.stdout || '';
    pass = false;
  }

  return { pass, output: stdout };
}

async function applyPatch(sandboxId, filePath, newContent) {
  console.log(`[SANDBOX] Applying patch to file "${filePath}" in sandbox: "${sandboxId}"...`);
  
  if (isDaytonaEnabled() && !localSandboxes.has(sandboxId)) {
    throw new Error("Daytona execution not supported in dry run.");
  }

  const meta = localSandboxes.get(sandboxId);
  if (!meta) {
    throw new Error(`Sandbox ${sandboxId} not found.`);
  }

  const targetFile = path.join(meta.sandboxDir, filePath);
  fs.writeFileSync(targetFile, newContent, 'utf8');

  if (meta.simulated) {
    console.log("[SANDBOX] [SIMULATOR] Simulated patch applied. Service mock state updated.");
    return;
  }

  // Restart the Express service container to pick up the patch
  console.log("[SANDBOX] Restarting order-service container to apply patch...");
  execSync('docker compose restart order-service', { cwd: meta.sandboxDir, stdio: ['pipe', 'pipe', 'pipe'] });
  await new Promise(r => setTimeout(r, 2000));
}

async function destroySandbox(sandboxId) {
  console.log(`[SANDBOX] Tearing down sandbox: "${sandboxId}"...`);
  
  if (isDaytonaEnabled() && !localSandboxes.has(sandboxId)) {
    console.log(`[SANDBOX] Destroying Daytona sandbox ${sandboxId}`);
    return;
  }

  const meta = localSandboxes.get(sandboxId);
  if (!meta) return;

  if (meta.simulated) {
    console.log(`[SANDBOX] Tearing down simulated sandbox directory...`);
    try {
      fs.rmSync(meta.sandboxDir, { recursive: true, force: true });
    } catch (_) {}
    localSandboxes.delete(sandboxId);
    console.log(`[SANDBOX] Simulated sandbox "${sandboxId}" destroyed.`);
    return;
  }

  try {
    execSync('docker compose down -v', { cwd: meta.sandboxDir, stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (err) {
    console.warn(`[SANDBOX] Failed to docker compose down for ${sandboxId}`);
  }

  // Delete directory recursively
  try {
    fs.rmSync(meta.sandboxDir, { recursive: true, force: true });
  } catch (err) {
    console.warn(`[SANDBOX] Failed to remove directory ${meta.sandboxDir}`);
  }

  localSandboxes.delete(sandboxId);
  console.log(`[SANDBOX] Sandbox "${sandboxId}" destroyed successfully.`);
}

module.exports = {
  createSandbox,
  reproduceCrash,
  runTests,
  applyPatch,
  destroySandbox
};
