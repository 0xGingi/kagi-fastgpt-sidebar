const fs = require('fs');
const path = require('path');

const chromeManifest = JSON.parse(fs.readFileSync('./manifest.json', 'utf8'));

const firefoxManifest = { ...chromeManifest };

if (firefoxManifest.background && firefoxManifest.background.service_worker) {
    delete firefoxManifest.background.service_worker;
    firefoxManifest.background.scripts = ['background.js'];
}

const firefoxManifestPath = path.join('dist', 'firefox', 'manifest.json');
fs.writeFileSync(firefoxManifestPath, JSON.stringify(firefoxManifest, null, 2));

const backgroundScript = fs.readFileSync('./background.js', 'utf8');
const firefoxBackgroundPath = path.join('dist', 'firefox', 'background.js');
fs.writeFileSync(firefoxBackgroundPath, backgroundScript);

console.log('Firefox manifest.json and background.js created successfully'); 