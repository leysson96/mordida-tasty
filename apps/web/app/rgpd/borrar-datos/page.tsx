'use client';

import { FormEvent, useState } from 'react';
import { ShieldX } from 'lucide-react';
import { api } from '../../../lib/api';

export default function DataDeletionPage() {
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(undefined);
    setError(undefined);
    const form = new FormData(event.currentTarget);

    try {
      await api('/privacy/data-deletion-requests', {
        method: 'POST',
        body: JSON.stringify({
          email: String(form.get('email')),
          message: String(form.get('message') ?? '')
        })
      });
      setMessage('Solicitud registrada.');
      event.currentTarget.reset();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo registrar.');
    }
  }

  return (
    <main className="page-shell auth-page">
      <form className="auth-panel" onSubmit={submit}>
        <ShieldX aria-hidden="true" size={30} />
        <p className="eyebrow">RGPD</p>
        <h1>Borrado de datos</h1>
        <label>
          Email
          <input name="email" type="email" required />
        </label>
        <label>
          Mensaje
          <textarea name="message" rows={4} />
        </label>
        {message && <p className="form-success">{message}</p>}
        {error && <p className="form-error">{error}</p>}
        <button className="button primary full" type="submit">
          Enviar
        </button>
      </form>
    </main>
  );
}
