const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');

const root = path.resolve(__dirname, '..');
const target = path.join(root, '.env');
let content = fs.readFileSync(fs.existsSync(target) ? target : path.join(root, '.env.example'), 'utf8');
const line = /^JWT_SECRET\s*=\s*(.*)$/m;
const current = (content.match(line)?.[1] ?? '').trim().replace(/^(['"])(.*)\1$/, '$2');
if (Buffer.byteLength(current, 'utf8') < 32 || current === 'brewlite_super_secret_jwt_key_2026') {
  const replacement = `JWT_SECRET=${randomBytes(48).toString('hex')}`;
  content = line.test(content) ? content.replace(line, replacement) : `${content.trimEnd()}\n${replacement}\n`;
  fs.writeFileSync(target, content, { mode: 0o600 });
  console.log('Created a private JWT secret in .env. Existing tokens must sign in again. Other settings were preserved.');
} else {
  console.log('Kept the existing private JWT secret.');
}
