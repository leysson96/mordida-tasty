const fs = require('node:fs');

// Loaded only by the local audit child process, never by the production start command.
if (process.env.MORDIDA_MEMORY_AUDIT_FILE) {
  const sample = () => fs.appendFileSync(process.env.MORDIDA_MEMORY_AUDIT_FILE,
    JSON.stringify({ time: Date.now(), pid: process.pid, cpu: process.cpuUsage(), ...process.memoryUsage() }) + '\n');
  sample();
  setInterval(sample, 100).unref();
}
