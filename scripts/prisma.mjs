import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { apiRoot, loadProjectEnv, repoRoot } from './load-env.mjs';

loadProjectEnv();

const prismaCli = join(repoRoot, 'node_modules', 'prisma', 'build', 'index.js');

const result = spawnSync(process.execPath, [prismaCli, ...process.argv.slice(2)], {
  cwd: apiRoot,
  env: process.env,
  stdio: 'inherit'
});

if (result.error) {
  console.error(result.error);
}

process.exit(result.status ?? 1);
