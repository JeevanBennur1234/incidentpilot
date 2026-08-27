#!/usr/bin/env bash
set -e

echo "=== STARTING INCIDENTPILOT DEMO RUNBOOK ==="

# 1. Start demo service
echo "[DEMO] Starting target Express microservice..."
cd demo-service
docker compose down -v 2>/dev/null || true
docker compose up --build -d

echo "[DEMO] Service started. Waiting for database to be ready..."
sleep 5

# 2. Trigger load crash
echo "[DEMO] Service healthy, triggering database client pool exhaustion..."
node scripts/trigger-crash.js >/dev/null 2>&1 &
CRASH_PID=$!

# 3. Wait for crash to reproduce
echo "[DEMO] Waiting 15 seconds for connection pool leak to exhaust resources..."
sleep 15
echo "[DEMO] Pool exhausted. Triggering IncidentPilot orchestrator..."
cd ..

# 4. Run orchestrator
echo "=========================================================="
echo "LAUNCHING INCIDENTPILOT AUTOMATED DIAGNOSTICS & TRIAGE"
echo "=========================================================="
echo "[DEMO] Running orchestrator with pool-exhaustion alert payload..."
echo "[DEMO] THIS IS THE HUMAN-IN-THE-LOOP GATE - approving now when prompted."
echo "=========================================================="

node agent/cli.js --alert mock-alerts/pool-exhaustion.json

echo "=========================================================="
echo "[DEMO] Incident successfully resolved!"
echo "[DEMO] Postmortem report details:"
echo "=========================================================="
POSTMORTEM_FILE="postmortems/session-test-uuid-12345.md"
if [ -f "$POSTMORTEM_FILE" ]; then
  echo "Postmortem Path: $POSTMORTEM_FILE"
  echo "--- File Content ---"
  cat "$POSTMORTEM_FILE"
  echo "--------------------"
else
  echo "Warning: Postmortem report file not found at $POSTMORTEM_FILE"
fi

# 8. Clean shutdown
echo "[DEMO] Performing clean shutdown of microservice containers..."
cd demo-service
docker compose down -v
cd ..

echo "=== DEMO RUNBOOK COMPLETE ==="
