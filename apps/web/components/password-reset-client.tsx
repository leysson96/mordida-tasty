'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { KeyRound } from 'lucide-react';
import { api } from '../lib/api';

export function PasswordResetClient({ token }: { token: string }) {
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get('password'));
    const confirmPassword = String(form.get('confirmPassword'));
    setLoading(true);
    setError(undefined);

    if (password !== confirmPassword) {
      setError('Las contrasenas no coinciden.');
      setLoading(false);
      return;
    }

    try {
      await api('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password })
      });
      setMessage('Contrasena actualizada. Ya puedes iniciar sesion.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo cambiar.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page-shell auth-page">
      <form className="auth-panel" onSubmit={submit}>
        <p className="eyebrow">Cuenta</p>
        <h1>Nueva contrasena</h1>
        {!token && <p className="form-error">El enlace no es valido.</p>}
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
        <label>
          Confirmar contrasena
          <input
            name="confirmPassword"
            type="password"
            required
            minLength={10}
            autoComplete="new-password"
          />
        </label>
        {message && <p className="form-success">{message}</p>}
        {error && <p className="form-error">{error}</p>}
        <button className="button primary full" disabled={loading || !token} type="submit">
          <KeyRound aria-hidden="true" size={18} />
          {loading ? 'Guardando' : 'Guardar'}
        </button>
        <Link href="/auth/login">Iniciar sesion</Link>
      </form>
    </main>
  );
}
