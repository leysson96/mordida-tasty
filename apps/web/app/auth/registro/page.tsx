"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { UserPlus } from "lucide-react";
import { api } from "../../../lib/api";

interface RegisterResponse {
  verificationToken?: string;
}

export default function RegisterPage() {
  const [message, setMessage] = useState<string>();
  const [verificationUrl, setVerificationUrl] = useState<string>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = event.currentTarget;
    setLoading(true);
    setError(undefined);
    setVerificationUrl(undefined);
    const form = new FormData(target);

    try {
      const response = await api<RegisterResponse>("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          name: String(form.get("name")),
          email: String(form.get("email")),
          phone: String(form.get("phone")),
          password: String(form.get("password")),
          acceptLegal: form.get("acceptLegal") === "on",
        }),
      });
      setMessage("Cuenta creada. Revisa tu email para verificarla.");
      if (response.verificationToken) {
        setVerificationUrl(
          `/auth/verificar?token=${encodeURIComponent(response.verificationToken)}`,
        );
      }
      target.reset();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo crear la cuenta.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page-shell auth-page">
      <form className="auth-panel" onSubmit={submit}>
        <p className="eyebrow">Cliente</p>
        <h1>Crear cuenta</h1>
        <label>
          Nombre
          <input name="name" required minLength={2} autoComplete="name" />
        </label>
        <label>
          Email
          <input name="email" type="email" required autoComplete="email" />
        </label>
        <label>
          Telefono
          <input
            name="phone"
            required
            autoComplete="tel"
            placeholder="+34..."
          />
        </label>
        <label>
          Contrasena
          <input
            name="password"
            type="password"
            required
            minLength={10}
            autoComplete="new-password"
          />
        </label>
        <label className="checkbox-label legal-consent">
          <input type="checkbox" name="acceptLegal" required />
          <span>
            Acepto la <Link href="/privacidad">politica de privacidad</Link> y
            las <Link href="/condiciones">condiciones</Link>.
          </span>
        </label>
        {message && <p className="form-success">{message}</p>}
        {verificationUrl && (
          <Link className="dev-link" href={verificationUrl}>
            Verificar cuenta en entorno local
          </Link>
        )}
        {error && <p className="form-error">{error}</p>}
        <button
          className="button primary full"
          disabled={loading}
          type="submit"
        >
          <UserPlus aria-hidden="true" size={18} />
          {loading ? "Creando" : "Crear"}
        </button>
        <Link href="/auth/login">Ya tengo cuenta</Link>
      </form>
    </main>
  );
}
