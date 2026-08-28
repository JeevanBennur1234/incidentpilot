const fs = require('fs');
const path = require('path');

function parseSkillFile(filePath) {
  const fileContent = fs.readFileSync(filePath, 'utf8');
  const parentDirName = path.basename(path.dirname(filePath));
  
  // Look for frontmatter (--- YAML --- markdown content)
  const match = fileContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    return {
      name: parentDirName,
      description: '',
      content: fileContent.trim()
    };
  }
  
  const yamlContent = match[1];
  const content = match[2];
  
  const metadata = {};
  const lines = yamlContent.split('\n');
  let currentKey = null;
  let currentVal = '';
  
  for (const line of lines) {
    if (line.includes(':')) {
      if (currentKey) {
        metadata[currentKey] = currentVal.trim();
      }
      const parts = line.split(':');
      currentKey = parts[0].trim();
      let val = parts.slice(1).join(':').trim();
      if (val === '>-' || val === '>') {
        currentVal = '';
      } else {
        currentVal = val;
      }
    } else {
      if (currentKey) {
        currentVal += ' ' + line.replace(/^\s*-?\s*/, '').trim();
      }
    }
  }
  if (currentKey) {
    metadata[currentKey] = currentVal.trim();
  }
  
  return {
    name: metadata.name || parentDirName,
    description: metadata.description || '',
    content: content.trim()
  };
}

function loadSkillPacks(repoName) {
  const skillsDir = __dirname;
  const items = fs.readdirSync(skillsDir, { withFileTypes: true });
  
  const skills = [];
  for (const item of items) {
    if (item.isDirectory()) {
      const skillFilePath = path.join(skillsDir, item.name, 'SKILL.md');
      if (fs.existsSync(skillFilePath)) {
        try {
          const parsed = parseSkillFile(skillFilePath);
          skills.push(parsed);
        } catch (err) {
          console.error(`Error parsing skill file ${item.name}/SKILL.md:`, err.message);
        }
      }
    }
  }
  return skills;
}

module.exports = {
  loadSkillPacks
};
