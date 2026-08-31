"use client";

import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";
import { KeyRound, ShieldCheck } from "lucide-react";
import { toDataURL } from "qrcode";
import { api } from "../../../lib/api";
import {
  readableErrorMessage,
  redirectOnAdminAuthError,
} from "../../../lib/admin-errors";

interface TwoFactorSetupResponse {
  secret: string;
  otpauthUrl: string;
}

export default function AdminTwoFactorPage() {
  const [setup, setSetup] = useState<TwoFactorSetupResponse>();
  const [qrUrl, setQrUrl] = useState<string>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const response = await api<TwoFactorSetupResponse>(
          "/admin/auth/2fa/setup",
          {
            method: "POST",
            body: JSON.stringify({}),
          },
        );
        const qr = await toDataURL(response.otpauthUrl, {
          margin: 1,
          width: 220,
        });

        if (active) {
          setSetup(response);
          setQrUrl(qr);
          setError(undefined);
        }
      } catch (requestError) {
        if (!active) {
          return;
        }
        if (redirectOnAdminAuthError(requestError)) {
          return;
        }
        setError(
          readableErrorMessage(requestError, "No se pudo preparar 2FA."),
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setConfirming(true);
    setError(undefined);

    try {
      await api("/admin/auth/2fa/confirm", {
        method: "POST",
        body: JSON.stringify({ code: String(form.get("code")) }),
      });
      window.location.href = "/admin";
    } catch (requestError) {
      setError(readableErrorMessage(requestError, "No se pudo activar 2FA."));
      setConfirming(false);
    }
  }

  return (
    <main className="page-shell auth-page">
      <form className="auth-panel two-factor-setup-panel" onSubmit={confirm}>
        <ShieldCheck aria-hidden="true" size={30} />
        <p className="eyebrow">Seguridad</p>
        <h1>Activa 2FA</h1>
        {loading && <p className="muted">Preparando codigo.</p>}
        {qrUrl && (
          <Image
            src={qrUrl}
            alt="QR de autenticacion 2FA"
            width={220}
            height={220}
            className="two-factor-qr"
            unoptimized
          />
        )}
        {setup && <code>{setup.secret}</code>}
        <label>
          Codigo de la app
          <input
            name="code"
            inputMode="numeric"
            minLength={6}
            maxLength={6}
            required
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button
          className="button primary full"
          type="submit"
          disabled={loading || confirming}
        >
          <KeyRound aria-hidden="true" size={18} />
          {confirming ? "Activando" : "Activar 2FA"}
        </button>
      </form>
    </main>
  );
}
