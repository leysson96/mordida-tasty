'use client';

import Link from 'next/link';
import { Cookie } from 'lucide-react';
import { useEffect, useState } from 'react';

const storageKey = 'mordida_cookie_consent';

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(window.localStorage.getItem(storageKey) !== 'accepted');
  }, []);

  function accept() {
    window.localStorage.setItem(storageKey, 'accepted');
    setVisible(false);
  }

  if (!visible) {
    return null;
  }

  return (
    <aside className="cookie-banner">
      <Cookie aria-hidden="true" size={21} />
      <p>
        Usamos cookies tecnicas para carrito, sesion y seguridad. Consulta la{' '}
        <Link href="/privacidad">privacidad</Link>.
      </p>
      <button type="button" className="button primary" onClick={accept}>
        Aceptar
      </button>
    </aside>
  );
}
