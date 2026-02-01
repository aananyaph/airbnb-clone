// Run `node --check` on all .js files (excluding node_modules)
// Exit with non-zero code if any file fails.
const { execSync } = require('child_process');
const { join } = require('path');
const fs = require('fs');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function (file) {
    file = join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      if (file.includes('node_modules')) return;
      results = results.concat(walk(file));
    } else {
      if (file.endsWith('.js')) results.push(file);
    }
  });
  return results;
}

const root = process.cwd();
const files = walk(root);
let failed = false;
files.forEach((f) => {
  try {
    execSync(`node --check "${f}"`, { stdio: 'ignore' });
  } catch (e) {
    console.error(`Syntax error in: ${f}`);
    failed = true;
  }
});
if (failed) process.exit(2);
console.log('✅ All JS files passed node --check');
