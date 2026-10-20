import { TotpCryptoService } from "./totp-crypto.service";

describe("TotpCryptoService", () => {
  const encodedKey = Buffer.alloc(32, 7).toString("base64");

  function service(key: string | undefined = encodedKey) {
    return new TotpCryptoService({ get: jest.fn(() => key) } as never);
  }

  it("encrypts and decrypts a secret with AES-256-GCM", () => {
    const crypto = service();
    const encrypted = crypto.encrypt("JBSWY3DPEHPK3PXP");
    expect(encrypted).toMatch(/^v1\./);
    expect(encrypted).not.toContain("JBSWY3DPEHPK3PXP");
    expect(crypto.decrypt(encrypted)).toEqual({
      secret: "JBSWY3DPEHPK3PXP",
      legacy: false,
    });
  });

  it("uses a different IV for every encryption", () => {
    const crypto = service();
    expect(crypto.encrypt("same-secret")).not.toBe(
      crypto.encrypt("same-secret"),
    );
  });

  it("detects modified ciphertext", () => {
    const crypto = service();
    const encrypted = crypto.encrypt("secret");
    const parts = encrypted.split(".");
    parts[2] = `${parts[2].slice(0, -1)}${parts[2].endsWith("A") ? "B" : "A"}`;
    expect(() => crypto.decrypt(parts.join("."))).toThrow();
  });

  it.each(["", "bad-key"])("rejects an invalid key", (key) => {
    expect(() => service(key).encrypt("secret")).toThrow(
      /TOTP_ENCRYPTION_KEY/,
    );
  });

  it("recognizes legacy plaintext without logging or changing it", () => {
    expect(service().decrypt("LEGACYSECRET")).toEqual({
      secret: "LEGACYSECRET",
      legacy: true,
    });
  });
});
