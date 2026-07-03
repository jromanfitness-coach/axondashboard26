const fs = require('fs');
const path = require('path');
const required = ['index.html', 'client.html', 'netlify.toml', 'server/axon-api.js', 'package.json'];
for (const file of required) {
  if (!fs.existsSync(path.join(process.cwd(), file))) throw new Error(`Missing required file: ${file}`);
}
const staticFiles = ['index.html', 'client.html', 'README.md', '.env.example'];
const protectedEnvNames = ['INITIAL_ADMIN_PIN', 'CLIENT_PORTAL_PIN', 'ADMIN_PUBLISH_SECRET', 'AUTH_SESSION_SECRET'];
for (const name of protectedEnvNames) {
  const value = process.env[name];
  if (!value) continue;
  for (const file of staticFiles) {
    const content = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
    if (content.includes(value)) throw new Error(`Protected value from ${name} was found in ${file}. Remove it before deployment.`);
  }
}
const config = fs.readFileSync(path.join(process.cwd(), 'netlify.toml'), 'utf8');
if (!/functions\s*=\s*"server"/.test(config)) throw new Error('Netlify function directory must be server.');
const fn = fs.readFileSync(path.join(process.cwd(), 'server/axon-api.js'), 'utf8');
if (!/getStore\(STORE_NAME\)/.test(fn)) throw new Error('Expected Netlify Blobs getStore(storeName) usage was not found.');
console.log('[verify] Static assets contain no configured secret values and the v31 server function is ready.');
