const fs = require('fs');
const path = require('path');

function parseSkillFile(filePath) {
  const fileContent = fs.readFileSync(filePath, 'utf8');
  
  // Look for frontmatter (--- YAML --- markdown content)
  const match = fileContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    return {
      name: path.basename(filePath, '.md'),
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
    name: metadata.name || path.basename(filePath, '.md'),
    description: metadata.description || '',
    content: content.trim()
  };
}

function loadSkillPacks(repoName) {
  const skillsDir = __dirname;
  const files = fs.readdirSync(skillsDir);
  const skillFiles = files.filter(f => f.endsWith('.md'));
  
  const skills = [];
  for (const file of skillFiles) {
    const filePath = path.join(skillsDir, file);
    try {
      const parsed = parseSkillFile(filePath);
      skills.push(parsed);
    } catch (err) {
      console.error(`Error parsing skill file ${file}:`, err.message);
    }
  }
  return skills;
}

module.exports = {
  loadSkillPacks
};
