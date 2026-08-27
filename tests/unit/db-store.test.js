const dbStore = require('../../agent/db/store');

describe('SQLite DB Store Unit Tests', () => {
  const sessionId = `test-session-${Date.now()}`;

  it('should persist session starting states and events', () => {
    dbStore.persistSessionState(sessionId, {
      stage: 'incident_triggered',
      payload: { test: 'data' }
    });

    const timeline = dbStore.getSessionTimeline(sessionId);
    expect(timeline).toBeDefined();
    expect(timeline.session).toBeDefined();
    expect(timeline.session.id).toBe(sessionId);
    expect(timeline.session.status).toBe('active');
    expect(timeline.events.length).toBe(1);
    expect(timeline.events[0].stage).toBe('incident_triggered');
  });

  it('should update terminal status when resolved', () => {
    dbStore.persistSessionState(sessionId, 'incident_resolved');
    
    const timeline = dbStore.getSessionTimeline(sessionId);
    expect(timeline.session.status).toBe('incident_resolved');
    expect(timeline.session.ended_at).toBeDefined();
  });
});
