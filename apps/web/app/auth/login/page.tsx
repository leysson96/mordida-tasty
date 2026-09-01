'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { LogIn } from 'lucide-react';
import { PasswordField } from '../../../components/password-field';
import { api } from '../../../lib/api';
import { User } from '../../../lib/types';

interface LoginResponse {
  user: User;
}

export default function LoginPage() {
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(undefined);
    const form = new FormData(event.currentTarget);

    try {
      await api<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: String(form.get('email')),
          password: String(form.get('password'))
        })
      });
      window.location.href = '/cuenta';
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo iniciar sesion.');
      setLoading(false);
    }
  }

  return (
    <main className="page-shell auth-page">
      <form className="auth-panel" onSubmit={submit}>
        <p className="eyebrow">Cliente</p>
        <h1>Iniciar sesion</h1>
        <label>
          Email
          <input name="email" type="email" required autoComplete="email" />
        </label>
        <PasswordField label="Contrasena" name="password" required autoComplete="current-password" />
        {error && <p className="form-error">{error}</p>}
        <button className="button primary full" disabled={loading} type="submit">
          <LogIn aria-hidden="true" size={18} />
          {loading ? 'Entrando' : 'Entrar'}
        </button>
        <Link href="/auth/recuperar">He olvidado mi contrasena</Link>
        <Link href="/auth/registro">Crear cuenta</Link>
      </form>
    </main>
  );
}
