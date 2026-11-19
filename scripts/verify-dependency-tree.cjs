const { spawnSync } = require('node:child_process');
const { resolve } = require('node:path');

// Use the same npm that launched the check, without relying on shell quoting.
if (!process.env.npm_execpath) {
  console.error('Run through npm run test:toolchain.');
  process.exit(1);
}
const result = spawnSync(process.execPath,
  [process.env.npm_execpath, 'ls', '--all', '--json'],
  { cwd: resolve(__dirname, '..'), encoding: 'utf8', timeout: 60000,
    maxBuffer: 16 * 1024 * 1024, windowsHide: true });
if (result.error || result.status !== 0) {
  console.error(result.error?.message || result.stderr || 'npm ls failed');
  process.exit(1);
}
const tree = JSON.parse(result.stdout);
if (tree.problems?.length) {
  console.error(tree.problems.join('\n'));
  process.exit(1);
}
console.log('Dependency tree: PASS (npm ls --all, exit 0)');
