'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { Mail } from 'lucide-react';
import { api } from '../../../lib/api';

interface PasswordResetRequestResponse {
  resetToken?: string;
}

export default function RequestPasswordResetPage() {
  const [message, setMessage] = useState<string>();
  const [resetUrl, setResetUrl] = useState<string>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setLoading(true);
    setError(undefined);
    setResetUrl(undefined);

    try {
      const response = await api<PasswordResetRequestResponse>('/auth/request-password-reset', {
        method: 'POST',
        body: JSON.stringify({ email: String(form.get('email')) })
      });
      setMessage('Si la cuenta existe, recibiras un email para cambiar la contrasena.');
      if (response.resetToken) {
        setResetUrl(`/auth/reset?token=${encodeURIComponent(response.resetToken)}`);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo solicitar.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page-shell auth-page">
      <form className="auth-panel" onSubmit={submit}>
        <p className="eyebrow">Cuenta</p>
        <h1>Recuperar acceso</h1>
        <label>
          Email
          <input name="email" type="email" required autoComplete="email" />
        </label>
        {message && <p className="form-success">{message}</p>}
        {resetUrl && (
          <Link className="dev-link" href={resetUrl}>
            Cambiar contrasena en entorno local
          </Link>
        )}
        {error && <p className="form-error">{error}</p>}
        <button className="button primary full" disabled={loading} type="submit">
          <Mail aria-hidden="true" size={18} />
          {loading ? 'Enviando' : 'Enviar email'}
        </button>
        <Link href="/auth/login">Volver a iniciar sesion</Link>
      </form>
    </main>
  );
}
