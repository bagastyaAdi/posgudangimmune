const fs = require('fs');
const path = require('path');

const directoriesToScan = ['./src', './'];
const ignoreDirs = ['node_modules', 'dist', '.git'];
const fileExtensions = ['.js', '.jsx', '.html', '.css', '.json'];

function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;
  
  content = content.replace(/TEIKO/g, 'GUDANG IMMUNE');
  content = content.replace(/Teiko/g, 'Gudang Immune');
  content = content.replace(/teiko/g, 'gudang-immune');
  
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated: ${filePath}`);
  }
}

function scanDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      if (!ignoreDirs.includes(file) && !fullPath.includes('pos_teiko')) {
        scanDirectory(fullPath);
      }
    } else {
      const ext = path.extname(fullPath);
      if (fileExtensions.includes(ext) && file !== 'package-lock.json' && file !== 'replace.js') {
        replaceInFile(fullPath);
      }
    }
  }
}

scanDirectory('./src');
replaceInFile('./index.html');
replaceInFile('./package.json');

console.log('Replacement complete.');
