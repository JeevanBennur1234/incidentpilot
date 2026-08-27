Write-Output "=== STARTING INCIDENTPILOT DEMO RUNBOOK ==="

# 1. Start demo service
Write-Output "[DEMO] Starting target Express microservice..."
Set-Location demo-service
docker compose down -v 2>$null
docker compose up --build -d

Write-Output "[DEMO] Service started. Waiting for database to be ready..."
Start-Sleep -Seconds 5

# 2. Trigger load crash
Write-Output "[DEMO] Service healthy, triggering database client pool exhaustion..."
Start-Process node -ArgumentList "scripts/trigger-crash.js" -NoNewWindow

# 3. Wait for crash to reproduce
Write-Output "[DEMO] Waiting 15 seconds for connection pool leak to exhaust resources..."
Start-Sleep -Seconds 15
Write-Output "[DEMO] Pool exhausted. Triggering IncidentPilot orchestrator..."
Set-Location ..

# 4. Run orchestrator
Write-Output "=========================================================="
Write-Output "LAUNCHING INCIDENTPILOT AUTOMATED DIAGNOSTICS & TRIAGE"
Write-Output "=========================================================="
Write-Output "[DEMO] Running orchestrator with pool-exhaustion alert payload..."
Write-Output "[DEMO] THIS IS THE HUMAN-IN-THE-LOOP GATE - approving now when prompted."
Write-Output "=========================================================="

node agent/cli.js --alert mock-alerts/pool-exhaustion.json

Write-Output "=========================================================="
Write-Output "[DEMO] Incident successfully resolved!"
Write-Output "[DEMO] Postmortem report details:"
Write-Output "=========================================================="
$PostmortemFile = "postmortems/session-test-uuid-12345.md"
if (Test-Path $PostmortemFile) {
  Write-Output "Postmortem Path: $PostmortemFile"
  Write-Output "--- File Content ---"
  Get-Content $PostmortemFile
  Write-Output "--------------------"
} else {
  Write-Output "Warning: Postmortem report file not found at $PostmortemFile"
}

# 8. Clean shutdown
Write-Output "[DEMO] Performing clean shutdown of microservice containers..."
Set-Location demo-service
docker compose down -v
Set-Location ..

Write-Output "=== DEMO RUNBOOK COMPLETE ==="
