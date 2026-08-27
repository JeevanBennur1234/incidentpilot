Write-Output "=== RESETTING INCIDENTPILOT DEMO STATE ==="

# 1. Reset SQLite DB
$DbFile = "db/incidentpilot.db"
if (Test-Path $DbFile) {
  Write-Output "[RESET] Deleting SQLite database..."
  Remove-Item $DbFile -Force
}

# 2. Clean up sandboxes folder
$SandboxesDir = "db/sandboxes"
if (Test-Path $SandboxesDir) {
  Write-Output "[RESET] Cleaning up sandboxes directory..."
  Remove-Item "$SandboxesDir\*" -Recurse -Force -ErrorAction SilentlyContinue
}

# 3. Clean up postmortems folder
$PostmortemsDir = "postmortems"
if (Test-Path $PostmortemsDir) {
  Write-Output "[RESET] Cleaning up postmortems directory..."
  Remove-Item "$PostmortemsDir\*" -Recurse -Force -ErrorAction SilentlyContinue
}

# 4. Clean up sessions state files
$SessionsDir = "db/sessions"
if (Test-Path $SessionsDir) {
  Write-Output "[RESET] Cleaning up sessions directory..."
  Remove-Item "$SessionsDir\*" -Recurse -Force -ErrorAction SilentlyContinue
}

# 5. Reset demo service git changes
Write-Output "[RESET] Resetting local Git modifications..."
git checkout -- demo-service/server.js 2>$null

Write-Output "=== RESET COMPLETE ==="
