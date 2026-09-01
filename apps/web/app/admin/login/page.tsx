'use client';

import { FormEvent, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { PasswordField } from '../../../components/password-field';
import { api } from '../../../lib/api';
import { User } from '../../../lib/types';

interface LoginResponse {
  user: User;
}

export default function AdminLoginPage() {
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(undefined);
    const form = new FormData(event.currentTarget);

    try {
      const response = await api<LoginResponse>('/admin/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: String(form.get('email')),
          password: String(form.get('password')),
          totpCode: String(form.get('totpCode') || '') || undefined
        })
      });
      if (response.user.role === 'KITCHEN') {
        window.location.href = '/admin/cocina';
        return;
      }

      window.location.href = response.user.twoFactorEnabled ? '/admin' : '/admin/2fa';
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo entrar.');
      setLoading(false);
    }
  }

  return (
    <main className="page-shell auth-page">
      <form className="auth-panel" onSubmit={submit}>
        <ShieldCheck aria-hidden="true" size={30} />
        <p className="eyebrow">Admin</p>
        <h1>Acceso seguro</h1>
        <label>
          Email
          <input name="email" type="email" required autoComplete="email" />
        </label>
        <PasswordField label="Contrasena" name="password" required autoComplete="current-password" />
        <label>
          Codigo 2FA
          <input name="totpCode" inputMode="numeric" maxLength={6} placeholder="Opcional" />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button className="button primary full" disabled={loading} type="submit">
          <ShieldCheck aria-hidden="true" size={18} />
          {loading ? 'Validando' : 'Entrar'}
        </button>
      </form>
    </main>
  );
}
