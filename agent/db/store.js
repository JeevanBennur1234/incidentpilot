const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbDir = path.resolve(__dirname, '../../db');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}
const dbPath = path.join(dbDir, 'incidentpilot.db');
const db = new Database(dbPath);

// Initialize SQLite schema
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    alert_payload TEXT,
    started_at TEXT,
    status TEXT,
    ended_at TEXT
  );

  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT,
    timestamp TEXT,
    stage TEXT,
    payload_json TEXT,
    FOREIGN KEY(session_id) REFERENCES sessions(id)
  );
`);

function persistSessionState(sessionId, event) {
  let stage = '';
  let payload = null;

  if (typeof event === 'string') {
    stage = event;
  } else if (event && typeof event === 'object') {
    stage = event.stage || 'unknown';
    payload = event.payload !== undefined ? event.payload : event;
  }

  const timestamp = new Date().toISOString();
  
  // Try to check if session already exists
  const session = db.prepare('SELECT id FROM sessions WHERE id = ?').get(sessionId);
  if (!session) {
    let alertPayloadStr = '';
    if (stage === 'incident_triggered' && payload) {
      alertPayloadStr = JSON.stringify(payload);
    }
    db.prepare(`
      INSERT INTO sessions (id, alert_payload, started_at, status)
      VALUES (?, ?, ?, ?)
    `).run(sessionId, alertPayloadStr, timestamp, 'active');
  }

  // Update session status/ended_at if we reach a terminal stage
  if (stage === 'incident_resolved' || stage === 'incident_rejected_by_human' || stage === 'escalated_to_human') {
    db.prepare(`
      UPDATE sessions
      SET status = ?, ended_at = ?
      WHERE id = ?
    `).run(stage, timestamp, sessionId);
  }

  const payloadJson = payload ? JSON.stringify(payload) : '{}';
  db.prepare(`
    INSERT INTO events (session_id, timestamp, stage, payload_json)
    VALUES (?, ?, ?, ?)
  `).run(sessionId, timestamp, stage, payloadJson);

  console.log(`[DB] Persisted state for session "${sessionId}" - Stage: "${stage}"`);
}

function getSessionTimeline(sessionId) {
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
  if (!session) return null;

  const events = db.prepare('SELECT * FROM events WHERE session_id = ? ORDER BY timestamp ASC').all(sessionId);
  
  return {
    session,
    events: events.map(e => ({
      ...e,
      payload: JSON.parse(e.payload_json || '{}')
    }))
  };
}

module.exports = {
  persistSessionState,
  getSessionTimeline
};
