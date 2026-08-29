# IncidentPilot: Onboarding and Project Setup Guide

Welcome to **IncidentPilot**! This guide outlines the step-by-step instructions to set up the project, run tests, spin up the standalone MCP servers, and integrate with TrueForge and local Ollama.

---

## 1. Prerequisites
Ensure you have the following installed on your machine:
*   **Operating System:** Windows 10/11 with **WSL2** (Ubuntu distribution recommended).
*   **Node.js:** version `>= 22.0.0` (installed on both Windows host and inside WSL via `nvm`).
*   **Docker Desktop:** (with integration enabled for WSL2).
*   **Ollama:** (running on the Windows host).
*   **Git**

---

## 2. Step-by-Step Installation

### Step 1: Clone the Repository
Inside your WSL terminal (or Windows terminal, depending on where you run the orchestrator), clone the repository and navigate to the project directory:
```bash
git clone https://github.com/JeevanBennur1234/incidentpilot.git
cd incidentpilot
```

### Step 2: Install Node Dependencies
Install all the npm dependencies:
```bash
npm install
```

### Step 3: Configure Environment Variables
Create a `.env` file in the root directory:
```bash
cp .env.example .env
```
Open `.env` and fill in your GitHub Token (required for GitHub integration and PR commands):
```env
GITHUB_TOKEN=your_github_personal_access_token_here
```

---

## 3. How to Run the Tests
Verify the installation by running the test suites:

*   **Run all Unit Tests (Safe and fast, does not need Docker/Compose):**
    ```bash
    npx jest tests/unit/ --no-coverage
    ```
*   **Run Integration Tests (Spins up real Docker containers, takes a few minutes):**
    ```bash
    npx jest tests/integration/ --no-coverage
    ```

---

## 4. Launching the Standalone MCP Servers
IncidentPilot exposes its tools as standalone HTTP/SSE servers so external agents (like TrueForge) can connect to them.

### Start the Logs & Metrics MCP Server
Exposes `get_logs` and `get_metrics` tools. Runs on port `3001` by default.
```bash
npm run mcp:logs
```
*   **SSE Handshake Link:** `http://localhost:3001/sse`

### Start the GitHub MCP Server
Exposes GitHub API interaction tools (branches, commits, pull requests, comments). Runs on port `3002` by default.
```bash
npm run mcp:github
```
*   **SSE Handshake Link:** `http://localhost:3002/sse`

---

## 5. Setting up TrueForge (in WSL) and Local Ollama

### Step 1: Set up Ollama on Windows Host
Ollama runs on Windows but needs to allow connections from WSL:
1. Quit Ollama from the Windows system tray.
2. Add a system environment variable:
   * **Variable name:** `OLLAMA_HOST`
   * **Variable value:** `0.0.0.0`
3. Launch Ollama again.
4. Download the recommended model (Qwen 2.5 Coder 3B or 1.5B):
   ```bash
   ollama run qwen2.5-coder:3b
   ```

### Step 2: Run TrueForge inside WSL (Native Linux Partition)
To avoid sluggish I/O and database locking issues over WSL mounts, always run TrueForge in the native WSL ext4 filesystem (e.g. `~/projects/`):
```bash
# Navigate to native WSL path
cd ~/projects/Agent-Harness/incidentpilot

# Start TrueForge binding to 0.0.0.0
HOST=0.0.0.0 PORT=8790 npx --yes @truefoundry/trueforge
```
Access the TrueForge UI in your Windows browser:
*   `http://<WSL_IP>:8790` (Get WSL IP by running `hostname -I` in WSL).

### Step 3: Connect Custom Model in TrueForge
When adding a custom model in the TrueForge UI, configure the connection as follows:
*   **Base URL:** `http://10.255.255.254:11434/v1` *(the default WSL nameserver IP representing the Windows host)*
*   **API Key:** `ollama`
*   **Model ID:** `qwen2.5-coder:3b`

### Step 4: Import IncidentPilot Skills into TrueForge
TrueForge expects each imported skill to live in its own subfolder containing a file named `SKILL.md`. This is already structured under the `agent/skills/` directory:
*   **Triage Runbook:** `agent/skills/incident-triage/SKILL.md`
*   **Patcher Policies:** `agent/skills/patch-policy/SKILL.md`
*   **Repository Context:** `agent/skills/repo-context/SKILL.md`
