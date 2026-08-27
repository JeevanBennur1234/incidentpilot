#!/usr/bin/env bash
set -e

echo "=== RESETTING INCIDENTPILOT DEMO STATE ==="

# 1. Reset SQLite DB
DB_FILE="db/incidentpilot.db"
if [ -f "$DB_FILE" ]; then
  echo "[RESET] Deleting SQLite database..."
  rm -f "$DB_FILE"
fi

# 2. Clean up sandboxes folder
SANDBOXES_DIR="db/sandboxes"
if [ -d "$SANDBOXES_DIR" ]; then
  echo "[RESET] Cleaning up sandboxes directory..."
  rm -rf "$SANDBOXES_DIR"/*
fi

# 3. Clean up postmortems folder
POSTMORTEMS_DIR="postmortems"
if [ -d "$POSTMORTEMS_DIR" ]; then
  echo "[RESET] Cleaning up postmortems directory..."
  rm -rf "$POSTMORTEMS_DIR"/*
fi

# 4. Clean up sessions state files
SESSIONS_DIR="db/sessions"
if [ -d "$SESSIONS_DIR" ]; then
  echo "[RESET] Cleaning up sessions directory..."
  rm -rf "$SESSIONS_DIR"/*
fi

# 5. Reset demo service git changes
echo "[RESET] Resetting local Git modifications..."
git checkout -- demo-service/server.js 2>/dev/null || true

echo "=== RESET COMPLETE ==="
