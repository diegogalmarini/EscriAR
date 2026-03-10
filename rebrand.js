const fs = require('fs');
const path = require('path');

const replacements = [
  { from: /NotiAR/g, to: 'EscriAR' },
  { from: /NotiAr/g, to: 'EscriAr' },
  { from: /notiar/g, to: 'escriar' },
  { from: /NOTIAR/g, to: 'ESCRIAR' }
];

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let newContent = content;
  for (const r of replacements) {
    newContent = newContent.replace(r.from, r.to);
  }
  if (content !== newContent) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`Updated: ${filePath}`);
  }
}

function walkDir(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walkDir(fullPath);
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx') || fullPath.endsWith('.md') || fullPath.endsWith('.json')) {
      processFile(fullPath);
    }
  }
}

// Process directories
walkDir(path.join(__dirname, 'src'));
walkDir(path.join(__dirname, 'supabase_migrations'));
walkDir(path.join(__dirname, 'test-files'));
walkDir(path.join(__dirname, 'scripts'));

// Process specific root files
const rootFiles = [
  'package.json', 'README.md', 'DIARIO.md', 'DIARIO_DESARROLLO.md', 
  'ENV_GUIDE.md', 'MANUAL_USUARIO.md', 'ROADMAP.md', 'ARCHITECTURE_PLAN.md', 
  'ACTUALIZACION_ANUAL.md', 'RUN_MIGRATIONS.md', '.env.example'
];

for (const f of rootFiles) {
  const p = path.join(__dirname, f);
  if (fs.existsSync(p)) {
    processFile(p);
  }
}
