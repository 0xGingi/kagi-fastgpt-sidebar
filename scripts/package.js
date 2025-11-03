const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

function run(cmd, opts = {}) {
  execSync(cmd, { stdio: 'inherit', ...opts });
}

function main() {
  const target = process.argv[2]; // 'chrome' | 'firefox' | 'both'
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  const version = pkg.version;
  const dist = path.join(__dirname, '..', 'dist');

  if (!fs.existsSync(dist)) {
    console.error('dist directory not found. Build first.');
    process.exit(1);
  }

  if (target === 'chrome' || target === 'both' || !target) {
    const dir = path.join(dist, 'chrome');
    if (fs.existsSync(dir)) {
      run(`bash -lc "cd '${dir}' && zip -r ../kagi-fastgpt-chrome-v${version}.zip ."`);
    }
  }

  if (target === 'firefox' || target === 'both' || !target) {
    const dir = path.join(dist, 'firefox');
    if (fs.existsSync(dir)) {
      run(`bash -lc "cd '${dir}' && zip -r ../kagi-fastgpt-firefox-v${version}.zip ."`);
    }
  }
}

main();

