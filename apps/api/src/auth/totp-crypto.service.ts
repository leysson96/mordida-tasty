import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";
import { AppEnv } from "../config/env";

const PREFIX = "v1";
const IV_BYTES = 12;
const TAG_BYTES = 16;

@Injectable()
export class TotpCryptoService {
  constructor(private readonly configService: ConfigService<AppEnv, true>) {}

  encrypt(secret: string) {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv("aes-256-gcm", this.key(), iv);
    const ciphertext = Buffer.concat([
      cipher.update(secret, "utf8"),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return [PREFIX, iv, ciphertext, tag]
      .map((part) =>
        typeof part === "string" ? part : part.toString("base64url"),
      )
      .join(".");
  }

  decrypt(value: string) {
    if (!value.startsWith(`${PREFIX}.`)) {
      return { secret: value, legacy: true };
    }

    const parts = value.split(".");
    if (parts.length !== 4) {
      throw new Error("Invalid encrypted TOTP secret format.");
    }

    const iv = Buffer.from(parts[1], "base64url");
    const ciphertext = Buffer.from(parts[2], "base64url");
    const tag = Buffer.from(parts[3], "base64url");
    if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
      throw new Error("Invalid encrypted TOTP secret format.");
    }

    const decipher = createDecipheriv("aes-256-gcm", this.key(), iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return { secret: plaintext.toString("utf8"), legacy: false };
  }

  private key() {
    const encoded = this.configService.get("TOTP_ENCRYPTION_KEY", {
      infer: true,
    });
    if (!encoded) {
      throw new Error("TOTP_ENCRYPTION_KEY is required for two-factor auth.");
    }

    const key = Buffer.from(encoded, "base64");
    if (key.length !== 32 || key.toString("base64") !== encoded) {
      throw new Error(
        "TOTP_ENCRYPTION_KEY must be exactly 32 bytes encoded as base64.",
      );
    }
    return key;
  }
}
