const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const required = [
  'index.html',
  'client.html',
  'netlify.toml',
  path.join('netlify', 'functions', 'client-portal.js')
];
for (const file of required) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) {
    console.error(`[verify] Missing required deploy file: ${file}`);
    process.exit(1);
  }
}
try {
  require.resolve('@netlify/blobs');
} catch (error) {
  console.error('[verify] @netlify/blobs is not installed. Check package.json and npm install output.');
  process.exit(1);
}
console.log('[verify] Static files, Function source, and @netlify/blobs dependency are ready for Netlify bundling.');
