'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { MailCheck } from 'lucide-react';
import { api } from '../../../lib/api';

type VerificationState = 'loading' | 'success' | 'error';

export default function VerifyEmailPage() {
  const [state, setState] = useState<VerificationState>('loading');
  const [message, setMessage] = useState('Verificando cuenta.');

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token');

    if (!token) {
      setState('error');
      setMessage('El enlace de verificacion no incluye token.');
      return;
    }

    api('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token })
    })
      .then(() => {
        setState('success');
        setMessage('Cuenta verificada. Ya puedes iniciar sesion.');
      })
      .catch((requestError: Error) => {
        setState('error');
        setMessage(requestError.message);
      });
  }, []);

  return (
    <main className="page-shell auth-page">
      <section className="auth-panel">
        <MailCheck aria-hidden="true" size={30} />
        <p className="eyebrow">Cliente</p>
        <h1>Verificar email</h1>
        <p className={state === 'error' ? 'form-error' : 'form-success'}>{message}</p>
        {state !== 'loading' && (
          <Link href="/auth/login" className="button primary full">
            Entrar
          </Link>
        )}
      </section>
    </main>
  );
}
