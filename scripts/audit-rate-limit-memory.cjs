const { createRequire } = require('node:module');
const { resolve } = require('node:path');
const apiRequire = createRequire(resolve(__dirname, '../apps/api/package.json'));
const { ThrottlerStorageService } = apiRequire('@nestjs/throttler');

class AuditStorage extends ThrottlerStorageService {
  // Accelerate the official sweep in this isolated reproduction only.
  sweepIntervalMs = 25;
}

// Isolated dependency reproduction; no HTTP calls, database access or real visitor data.
async function main() {
  const storage = new AuditStorage();
  try {
    for (let round = 0; round < 2; round++) {
      for (let i = 0; i < 1000; i++) {
        await storage.increment(`audit-${round}-${i}`, 20, 120, 20, 'default');
      }
      await new Promise(resolve => setTimeout(resolve, 100));
      console.log(JSON.stringify({
        round: round + 1,
        keysAfterExpiration: storage.storage.size,
        version: apiRequire('@nestjs/throttler/package.json').version,
      }));
      if (storage.storage.size !== 0) throw new Error('Expired identities remain retained');
    }
  } finally {
    storage.onApplicationShutdown();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
