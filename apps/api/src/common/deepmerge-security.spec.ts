import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

describe('Deepmerge consumers security regression', () => {
  it('preserves the merge contract and rejects prototype poisoning in every consumer', () => {
    const output = execFileSync(process.execPath, [
      resolve(__dirname, '../../../../scripts/verify-deepmerge-security.cjs'),
    ], { encoding: 'utf8', timeout: 10000, windowsHide: true });
    expect(output).toContain('"security":"PASS"');
    expect(output).toContain('"contract":"PASS"');
  });
});
