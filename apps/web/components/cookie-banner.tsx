"use client";

import Link from "next/link";
import { Cookie } from "lucide-react";
import { useEffect, useState } from "react";
import {
  cookieConsentChangedEvent,
  cookieConsentStorageKey,
  isCookieConsent,
} from "../lib/cookie-consent";
import type { CookieConsent } from "../lib/cookie-consent";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(
      !isCookieConsent(window.localStorage.getItem(cookieConsentStorageKey)),
    );
  }, []);

  function saveConsent(consent: CookieConsent) {
    window.localStorage.setItem(cookieConsentStorageKey, consent);
    window.dispatchEvent(new Event(cookieConsentChangedEvent));
    setVisible(false);
  }

  if (!visible) {
    return null;
  }

  return (
    <aside className="cookie-banner">
      <Cookie aria-hidden="true" size={21} />
      <p>
        Usamos cookies tecnicas para carrito, sesion y seguridad. Con tu permiso
        tambien usamos medicion para mejorar la carta. Consulta la{" "}
        <Link href="/privacidad">privacidad</Link>.
      </p>
      <div className="cookie-actions">
        <button
          type="button"
          className="button secondary"
          onClick={() => saveConsent("technical")}
        >
          Solo tecnicas
        </button>
        <button
          type="button"
          className="button primary"
          onClick={() => saveConsent("analytics")}
        >
          Aceptar medicion
        </button>
      </div>
    </aside>
  );
}
