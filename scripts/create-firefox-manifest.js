const fs = require('fs');
const path = require('path');

const chromeManifest = JSON.parse(fs.readFileSync('./manifest.json', 'utf8'));

const {
  background,
  action,
  host_permissions = [],
  permissions = [],
  ...rest
} = chromeManifest;

const filteredPerms = permissions.filter((p) => p !== 'scripting');
const hostPerms = Array.isArray(host_permissions) ? host_permissions : [];
const mergedPerms = Array.from(new Set([...(filteredPerms || []), ...hostPerms]));

const browserAction = action
  ? {
      default_title: action.default_title,
      default_icon: action.default_icon,
      ...(action.default_popup ? { default_popup: action.default_popup } : {}),
    }
  : undefined;

const firefoxManifest = {
  ...rest,
  manifest_version: 2,
  background: {
    scripts: ['background.js'],
  },
  ...(browserAction ? { browser_action: browserAction } : {}),
  permissions: mergedPerms,
};

const firefoxManifestPath = path.join('dist', 'firefox', 'manifest.json');
fs.writeFileSync(firefoxManifestPath, JSON.stringify(firefoxManifest, null, 2));

const backgroundScript = fs.readFileSync('./background.js', 'utf8');
const firefoxBackgroundPath = path.join('dist', 'firefox', 'background.js');
fs.writeFileSync(firefoxBackgroundPath, backgroundScript);

console.log('Firefox MV2 manifest.json and background.js created successfully'); 
