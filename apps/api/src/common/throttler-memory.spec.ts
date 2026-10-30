import { ThrottlerStorageService } from '@nestjs/throttler';

describe('Installed throttler storage regression', () => {
  let storage: ThrottlerStorageService;
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-29T12:00:00Z'));
    storage = new ThrottlerStorageService();
  });
  afterEach(() => {
    storage.onApplicationShutdown();
    jest.useRealTimers();
  });
  const hit = (s: ThrottlerStorageService, key = 'login', ttl = 60000, limit = 5, block = ttl, name = 'default') =>
    s.increment(key, ttl, limit, block, name);

  it('reclaims two waves of expired identities, using a single cleanup timer', async () => {
    for (let round = 0; round < 2; round++) {
      await Promise.all(Array.from({ length: 1000 }, (_, i) => hit(storage, `${round}-${i}`, 1000)));
      expect(storage.storage.size).toBe(1000);
      expect(jest.getTimerCount()).toBe(1);
      await jest.advanceTimersByTimeAsync(60001);
      expect(storage.storage.size).toBe(0);
    }
  });

  it('counts simultaneous requests atomically and retains login protection', async () => {
    const results = await Promise.all(Array.from({ length: 20 }, () => hit(storage)));
    expect(results.filter(r => !r.isBlocked)).toHaveLength(5);
    expect(results[5]).toMatchObject({ isBlocked: true, totalHits: 6, timeToBlockExpire: 60 });
  });

  it('retains a block longer than the hit TTL during cleanup', async () => {
    await hit(storage, 'a', 1000, 1, 120000);
    await hit(storage, 'a', 1000, 1, 120000);
    await jest.advanceTimersByTimeAsync(60001);
    expect(storage.storage.size).toBe(1);
    expect((await hit(storage, 'a', 1000, 1, 120000)).isBlocked).toBe(true);
    await jest.advanceTimersByTimeAsync(120000);
    expect(storage.storage.size).toBe(0);
  });

  it('expires individual hits on a sliding window', async () => {
    await hit(storage, 'a', 10000, 2);
    await jest.advanceTimersByTimeAsync(6000);
    await hit(storage, 'a', 10000, 2);
    await jest.advanceTimersByTimeAsync(4001);
    expect(await hit(storage, 'a', 10000, 2)).toMatchObject({ totalHits: 2, isBlocked: false });
    expect((await hit(storage, 'a', 10000, 2)).isBlocked).toBe(true);
  });

  it('keeps a late hit alive when the initial window has expired', async () => {
    await hit(storage, 'a', 60000);
    await jest.advanceTimersByTimeAsync(59000);
    await hit(storage, 'a', 60000);
    await jest.advanceTimersByTimeAsync(1001);
    expect(storage.storage.has('a')).toBe(true);
    expect((await hit(storage, 'a', 60000)).totalHits).toBe(2);
  });

  it('unblocking one identity does not prevent another identity from expiring', async () => {
    await hit(storage, 'blocked', 10000, 1, 1000);
    await hit(storage, 'blocked', 10000, 1, 1000);
    await hit(storage, 'other', 2000, 1);
    await jest.advanceTimersByTimeAsync(1001);
    expect(await hit(storage, 'blocked', 10000, 1, 1000)).toMatchObject({ isBlocked: false, totalHits: 1 });
    await jest.advanceTimersByTimeAsync(1000);
    expect(await hit(storage, 'other', 2000, 1)).toMatchObject({ isBlocked: false, totalHits: 1 });
  });

  it('keeps different throttler configurations independent', async () => {
    await hit(storage, 'short-key', 1000, 1, 1000, 'short');
    await hit(storage, 'long-key', 120000, 10, 120000, 'long');
    expect((await hit(storage, 'short-key', 1000, 1, 1000, 'short')).isBlocked).toBe(true);
    expect((await hit(storage, 'long-key', 120000, 10, 120000, 'long')).isBlocked).toBe(false);
    await jest.advanceTimersByTimeAsync(60001);
    expect(storage.storage.has('short-key')).toBe(false);
    expect(storage.storage.has('long-key')).toBe(true);
  });

  it('releases its timer and records on application shutdown', async () => {
    await hit(storage);
    storage.onApplicationShutdown();
    expect(jest.getTimerCount()).toBe(0);
    expect(storage.storage.size).toBe(0);
  });
});
