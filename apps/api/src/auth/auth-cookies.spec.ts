import {
  ACCESS_TOKEN_MAX_AGE_MS,
  ADMIN_REFRESH_COOKIE,
  ADMIN_REFRESH_MAX_AGE_MS,
  ADMIN_SESSION_COOKIE,
  ADMIN_ENROLLMENT_COOKIE,
  CLIENT_REFRESH_COOKIE,
  CLIENT_REFRESH_MAX_AGE_MS,
  CLIENT_SESSION_COOKIE,
  clearAdminSessionCookies,
  clearCustomerSessionCookies,
  sessionCookieOptions,
  setAdminSessionCookies,
  setCustomerSessionCookies,
} from "./auth-cookies";

describe("authentication cookies", () => {
  const config = { production: true, domain: ".mordidatasty.es" };
  const response = { cookie: jest.fn(), clearCookie: jest.fn() };

  beforeEach(() => jest.clearAllMocks());

  it("uses HttpOnly Secure cookies in production", () => {
    expect(sessionCookieOptions(config)).toEqual(
      expect.objectContaining({
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        domain: ".mordidatasty.es",
      }),
    );
  });

  it("sets separate customer access and refresh cookies", () => {
    setCustomerSessionCookies(
      response as never,
      { accessToken: "access", refreshToken: "refresh" },
      config,
    );
    expect(response.cookie).toHaveBeenNthCalledWith(
      1,
      CLIENT_SESSION_COOKIE,
      "access",
      expect.objectContaining({ maxAge: ACCESS_TOKEN_MAX_AGE_MS }),
    );
    expect(response.cookie).toHaveBeenNthCalledWith(
      2,
      CLIENT_REFRESH_COOKIE,
      "refresh",
      expect.objectContaining({ maxAge: CLIENT_REFRESH_MAX_AGE_MS }),
    );
  });

  it("sets separate staff access and refresh cookies", () => {
    setAdminSessionCookies(
      response as never,
      { accessToken: "access", refreshToken: "refresh" },
      config,
    );
    expect(response.cookie).toHaveBeenNthCalledWith(
      1,
      ADMIN_SESSION_COOKIE,
      "access",
      expect.objectContaining({ maxAge: ACCESS_TOKEN_MAX_AGE_MS }),
    );
    expect(response.cookie).toHaveBeenNthCalledWith(
      2,
      ADMIN_REFRESH_COOKIE,
      "refresh",
      expect.objectContaining({ maxAge: ADMIN_REFRESH_MAX_AGE_MS }),
    );
  });

  it("clears both cookies for each session scope", () => {
    clearCustomerSessionCookies(response as never, config);
    clearAdminSessionCookies(response as never, config);
    expect(response.clearCookie.mock.calls.map(([name]) => name)).toEqual([
      CLIENT_SESSION_COOKIE,
      CLIENT_REFRESH_COOKIE,
      ADMIN_SESSION_COOKIE,
      ADMIN_REFRESH_COOKIE,
      ADMIN_ENROLLMENT_COOKIE,
    ]);
  });
});
