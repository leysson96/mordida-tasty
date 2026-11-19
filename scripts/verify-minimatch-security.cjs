const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const { resolve } = require('node:path');
const { spawnSync } = require('node:child_process');

const root = process.env.AUDIT_DEPENDENCY_ROOT || resolve(__dirname, '..');
const rootRequire = createRequire(resolve(root, 'package.json'));
const consumers = ['glob', '@typescript-eslint/typescript-estree'];

if (process.argv[2] === 'stress') {
  const r = createRequire(rootRequire.resolve('glob/package.json'));
  const { Minimatch } = r('minimatch');
  for (const length of [4, 8, 12, 16]) {
    const pattern = '**/../'.repeat(length) + '*.ts';
    const started = performance.now();
    const matcher = new Minimatch(pattern, { optimizationLevel: 2 });
    matcher.match('src/a.ts');
    console.log(JSON.stringify({ length, ms: Math.round(performance.now() - started), expansions: matcher.globParts.length }));
    assert.ok(matcher.globParts.length <= 1000, 'Pattern expansion exceeds the audit bound');
  }
} else {
  for (const consumer of consumers) {
    const r = createRequire(rootRequire.resolve(consumer + '/package.json'));
    const { minimatch, Minimatch } = r('minimatch');
    const expectedVersion = consumer === 'glob' ? '11.0.9' : '11.0.4';
    assert.equal(r('minimatch/package.json').version, expectedVersion);
    for (const [file, pattern, options, expected] of [
      ['src/a.ts', '**/*.ts', {}, true],
      ['src/a.js', '**/*.ts', {}, false],
      ['src/.hidden.ts', '**/*.ts', {}, false],
      ['src/.hidden.ts', '**/*.ts', { dot: true }, true],
      ['src/a.ts', '**/*.{ts,tsx}', {}, true],
      ['src/a.ts', '!**/*.js', {}, true],
      ['C:/repo/src/a.ts', 'C:/repo/**/*.ts', { platform: 'win32' }, true],
    ]) {
      assert.equal(minimatch(file, pattern, options), expected);
      assert.equal(new Minimatch(pattern, options).match(file), expected);
    }
    console.log(consumer + ': patched API compatible with test corpus');
  }
  const legacyRequire = createRequire(rootRequire.resolve('eslint/package.json'));
  assert.equal(typeof legacyRequire('minimatch'), 'function');
  console.log('Legacy callable API preserved; version ' + legacyRequire('minimatch/package.json').version + '. Advisory status is checked separately with npm audit.');
  const glob = rootRequire('glob');
  assert.ok(glob.globSync('apps/api/src/**/*.spec.ts', { cwd: root }).length >= 32);
  const child = spawnSync(process.execPath, ['--max-old-space-size=128', __filename, 'stress'], {
    cwd: root, encoding: 'utf8', timeout: 5000, windowsHide: true,
  });
  assert.ifError(child.error);
  assert.equal(child.status, 0, child.stderr);
  process.stdout.write(child.stdout);
}
