const loader = require('../../agent/skills/loader');

describe('Skills Loader Unit Tests', () => {
  it('should load all skill files and parse frontmatter and content correctly', () => {
    const skills = loader.loadSkillPacks('incidentpilot');
    expect(Array.isArray(skills)).toBe(true);
    expect(skills.length).toBeGreaterThanOrEqual(3);

    const triageSkill = skills.find(s => s.name === 'incident-triage');
    expect(triageSkill).toBeDefined();
    expect(triageSkill.description).toContain('Runbook for classifying diagnostics payload');
    expect(triageSkill.content).toContain('Progression Thresholds');

    const repoContext = skills.find(s => s.name === 'repo-context');
    expect(repoContext).toBeDefined();
    expect(repoContext.description).toContain('technology stack');
  });
});
