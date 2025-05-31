const fs = require('fs');
const path = require('path');

const chromeManifest = JSON.parse(fs.readFileSync('./manifest.json', 'utf8'));

const firefoxManifest = { ...chromeManifest };

if (firefoxManifest.background && firefoxManifest.background.service_worker) {
    delete firefoxManifest.background.service_worker;
    firefoxManifest.background.scripts = ['background.js'];
    firefoxManifest.background.persistent = false;
}

const firefoxManifestPath = path.join('dist', 'firefox', 'manifest.json');
fs.writeFileSync(firefoxManifestPath, JSON.stringify(firefoxManifest, null, 2));

const backgroundScript = fs.readFileSync('./background.js', 'utf8');
const firefoxBackgroundScript = backgroundScript.replace(
  'const browserAPI = typeof browser !== \'undefined\' ? browser : chrome;',
  `const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

console.log('[Firefox Background] Script loaded');

browserAPI.runtime.onStartup.addListener(() => {
  console.log('[Firefox Background] Extension startup');
});

browserAPI.runtime.onInstalled.addListener(() => {
  console.log('[Firefox Background] Extension installed');
});`
);

const firefoxBackgroundPath = path.join('dist', 'firefox', 'background.js');
fs.writeFileSync(firefoxBackgroundPath, firefoxBackgroundScript);

console.log('Firefox manifest.json and background.js created successfully'); 