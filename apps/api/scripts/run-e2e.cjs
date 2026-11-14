const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');

if (!process.env.DATABASE_URL && fs.existsSync('.env.test')) process.loadEnvFile('.env.test');
let database = '';
try { database = new URL(process.env.DATABASE_URL).pathname.slice(1); } catch { /* validated below */ }
if (!/test/i.test(database)) {
  console.error('E2E yêu cầu DATABASE_URL trỏ tới DB test riêng. Xem README: Kiểm thử tự động.');
  process.exit(1);
}
// Only this test runner supplies an ephemeral test secret; the API never falls back.
process.env.JWT_SECRET ||= randomBytes(48).toString('hex');
const migrate = process.argv.includes('--migrate');
const args = migrate
  ? ['./node_modules/prisma/build/index.js', 'migrate', 'deploy']
  : ['--experimental-vm-modules', './node_modules/jest/bin/jest.js', '--config', './test/jest-e2e.json', '--runInBand', ...process.argv.slice(2)];
const result = spawnSync(process.execPath, args, { stdio: 'inherit', env: process.env });
if (result.error) console.error(result.error);
process.exit(result.status ?? 1);
