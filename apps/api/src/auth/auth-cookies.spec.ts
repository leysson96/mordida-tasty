import { ADMIN_SESSION_MAX_AGE_MS, sessionCookieOptions } from './auth-cookies';

describe('auth cookies', () => {
  it('keeps session tokens inaccessible to browser JavaScript', () => {
    expect(sessionCookieOptions(true)).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/'
    });
  });

  it('uses a shorter max age for staff sessions', () => {
    expect(ADMIN_SESSION_MAX_AGE_MS).toBe(12 * 60 * 60 * 1000);
  });

  it('supports production cookie domain and cross-site settings', () => {
    expect(
      sessionCookieOptions({
        production: true,
        domain: '.mordidatasty.es',
        sameSite: 'none'
      })
    ).toMatchObject({
      secure: true,
      domain: '.mordidatasty.es',
      sameSite: 'none'
    });
  });
});
