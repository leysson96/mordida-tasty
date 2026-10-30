import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { copyFile, mkdir, readFile, writeFile, unlink, rmdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const root = process.cwd();
const web = resolve(root, 'apps/web');
const require = createRequire(resolve(web, 'package.json'));
const output = resolve(root, 'audit-artifacts/memory-2026-10-29', String(Date.now()));
await mkdir(output, { recursive: true });
const samplesFile = resolve(output, 'samples.jsonl');
const logFile = resolve(output, 'server.log');
const port = 3327;
const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['--require', resolve(root, 'scripts/audit-memory-probe.cjs'),
  require.resolve('next/dist/bin/next'), 'start', '-H', '127.0.0.1', '-p', String(port)], {
  cwd: web, env: { ...process.env, NODE_ENV: 'production', MORDIDA_MEMORY_AUDIT_FILE: samplesFile },
  windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
});
let logs = '';
server.stdout.on('data', chunk => { logs += chunk; });
server.stderr.on('data', chunk => { logs += chunk; });
const exit = new Promise(done => server.once('exit', done));
const phases = [];
const imageConcurrency = Number(process.env.AUDIT_IMAGE_CONCURRENCY || 4);
const imageNames = ['mordida-smash', 'pollo-crujiente', 'nachos', 'patatas-bravas', 'limonada'];
const fixtureName = `memory-audit-${Date.now()}`;
const fixtureDir = resolve(web, 'public', fixtureName);
await mkdir(fixtureDir);
for (const name of imageNames) {
  await copyFile(resolve(web, 'public/images/menu', `${name}.png`), resolve(fixtureDir, `${name}.png`));
}
async function request(path) {
  const started = performance.now();
  const response = await fetch(base + path, { signal: AbortSignal.timeout(20000) });
  await response.arrayBuffer();
  return { status: response.status, ms: Math.round(performance.now() - started) };
}
async function phase(name, paths, count, concurrency) {
  const started = Date.now();
  let index = 0;
  const results = [];
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (index < count) {
      const i = index++;
      try { results.push(await request(paths[i % paths.length])); }
      catch (error) { results.push({ error: error.message }); }
    }
  }));
  const ended = Date.now();
  phases.push({ name, started, ended, count, concurrency, results });
  console.log(name, JSON.stringify({ count, errors: results.filter(r => r.error || r.status !== 200).length }));
}
try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    if (server.exitCode !== null) throw new Error('Server exited: ' + logs);
    try { if ((await request('/')).status === 200) { ready = true; break; } } catch {}
    await delay(500);
  }
  if (!ready) throw new Error('Server not ready');
  await delay(5000);
  await phase('pages', ['/', '/admin', '/admin/menu', '/admin/reportes', '/admin/clientes', '/cuenta', '/carrito', '/checkout'], 160, 4);
  const paths = imageNames.flatMap(name => [640, 1080, 1920, 3840].map(width =>
    '/_next/image?' + new URLSearchParams({ url: `/${fixtureName}/${name}.png`, w: String(width), q: '75' })));
  await phase('images-cold', paths, paths.length, imageConcurrency);
  for (let i = 1; i <= 3; i++) {
    await phase(`images-warm-${i}`, paths, 100, imageConcurrency);
    await delay(5000);
  }
  const idleStart = Date.now();
  await delay(20000);
  phases.push({ name: 'idle', started: idleStart, ended: Date.now(), results: [] });
} finally {
  server.kill();
  await exit;
  await writeFile(logFile, logs);
  for (const name of imageNames) await unlink(resolve(fixtureDir, `${name}.png`));
  await rmdir(fixtureDir);
}
const samples = (await readFile(samplesFile, 'utf8')).trim().split('\n').map(JSON.parse);
const mb = n => Math.round(n / 1048576 * 10) / 10;
const report = {
  environment: { platform: process.platform, node: process.version, next: require('next/package.json').version,
    buildId: (await readFile(resolve(web, '.next/BUILD_ID'), 'utf8')).trim(),
    note: 'Local Windows production build. No production traffic load or authenticated database workflow. RSS is process-only, not Render container memory.' },
  peakRssMB: mb(Math.max(...samples.map(s => s.rss))),
  phases: phases.map(p => {
    const rows = samples.filter(s => s.time >= p.started && s.time <= p.ended);
    return { name: p.name, count: p.count, concurrency: p.concurrency, durationMs: p.ended - p.started,
      errors: p.results.filter(r => r.error || r.status !== 200),
      p95Ms: p.results.length ? p.results.map(r => r.ms || 0).sort((a,b) => a-b)[Math.ceil(p.results.length * .95)-1] : null,
      peakRssMB: rows.length ? mb(Math.max(...rows.map(s => s.rss))) : null,
      end: rows.length ? Object.fromEntries(['rss','heapUsed','external','arrayBuffers'].map(k => [k + 'MB', mb(rows.at(-1)[k])])) : null };
  }),
};
await writeFile(resolve(output, 'summary.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ output, ...report }, null, 2));
