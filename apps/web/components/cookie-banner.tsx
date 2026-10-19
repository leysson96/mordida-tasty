"use client";

import * as Dialog from "@radix-ui/react-dialog";
import * as Switch from "@radix-ui/react-switch";
import { Cookie, Settings2, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  cookieConsentChangedEvent,
  cookieConsentStorageKey,
  createCookieConsentPreference,
  parseCookieConsent,
  serializeCookieConsent,
  type CookieConsentPreference,
} from "../lib/cookie-consent";

const openCookiePreferencesEvent = "mordida_cookie_preferences_open";
const necessaryCookiesOnly = createCookieConsentPreference(false, false, false);

export function CookieBanner() {
  const pathname = usePathname();
  const [initialized, setInitialized] = useState(false);
  const [visible, setVisible] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [preference, setPreference] = useState<CookieConsentPreference>(
    necessaryCookiesOnly,
  );
  const isAdminRoute = pathname?.startsWith("/admin") ?? false;

  useEffect(() => {
    const storedPreference = parseCookieConsent(
      window.localStorage.getItem(cookieConsentStorageKey),
    );
    setPreference(storedPreference ?? necessaryCookiesOnly);
    setVisible(storedPreference === null);
    setInitialized(true);
  }, []);

  useEffect(() => {
    function openPreferences() {
      const storedPreference = parseCookieConsent(
        window.localStorage.getItem(cookieConsentStorageKey),
      );
      setPreference(storedPreference ?? necessaryCookiesOnly);
      setPreferencesOpen(true);
    }

    window.addEventListener(openCookiePreferencesEvent, openPreferences);
    return () => {
      window.removeEventListener(openCookiePreferencesEvent, openPreferences);
    };
  }, []);

  function saveConsent(nextPreference: CookieConsentPreference) {
    window.localStorage.setItem(
      cookieConsentStorageKey,
      serializeCookieConsent(nextPreference),
    );
    window.dispatchEvent(new Event(cookieConsentChangedEvent));
    setPreference(nextPreference);
    setVisible(false);
    setPreferencesOpen(false);
  }

  function openPreferences() {
    const storedPreference = parseCookieConsent(
      window.localStorage.getItem(cookieConsentStorageKey),
    );
    setPreference(storedPreference ?? necessaryCookiesOnly);
    setPreferencesOpen(true);
  }

  if (isAdminRoute || !initialized) {
    return null;
  }

  return (
    <>
      {visible ? (
        <aside className="cookie-banner" aria-label="Preferencias de cookies">
          <Cookie aria-hidden="true" size={21} />
          <p>
            Usamos cookies necesarias para carrito, sesión y seguridad. Con tu
            permiso también usamos analítica y medición publicitaria. Consulta
            nuestra <Link href="/privacidad">política de privacidad</Link>.
          </p>
          <div className="cookie-actions">
            <button
              type="button"
              className="button secondary"
              onClick={() => saveConsent(necessaryCookiesOnly)}
            >
              Solo necesarias
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={openPreferences}
            >
              <Settings2 aria-hidden="true" size={16} />
              Configurar
            </button>
            <button
              type="button"
              className="button primary"
              onClick={() =>
                saveConsent(createCookieConsentPreference(true, true, true))
              }
            >
              Aceptar cookies
            </button>
          </div>
        </aside>
      ) : (
        <button
          type="button"
          className="cookie-settings-trigger"
          onClick={openPreferences}
          aria-label="Configurar cookies"
          title="Configurar cookies"
        >
          <Cookie aria-hidden="true" size={20} />
        </button>
      )}

      <Dialog.Root open={preferencesOpen} onOpenChange={setPreferencesOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="cookie-dialog-overlay" />
          <Dialog.Content className="cookie-dialog-content">
            <div className="cookie-dialog-heading">
              <div>
                <Dialog.Title>Preferencias de cookies</Dialog.Title>
                <Dialog.Description>
                  Decide qué medición permites. Las cookies necesarias siempre
                  permanecen activas para que la tienda funcione.
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="icon-button cookie-dialog-close"
                  aria-label="Cerrar preferencias"
                >
                  <X aria-hidden="true" size={20} />
                </button>
              </Dialog.Close>
            </div>

            <div className="cookie-preference-list">
              <CookiePreferenceRow
                title="Analítica"
                description="Nos permite conocer visitas y uso general de la carta."
                checked={preference.analytics}
                onCheckedChange={(analytics) =>
                  setPreference((current) => ({ ...current, analytics }))
                }
              />
              <CookiePreferenceRow
                title="Medición publicitaria"
                description="Mide el resultado general de campañas y anuncios."
                checked={preference.advertising}
                onCheckedChange={(advertising) =>
                  setPreference((current) => ({
                    ...current,
                    advertising,
                    personalization: advertising
                      ? current.personalization
                      : false,
                  }))
                }
              />
              <CookiePreferenceRow
                title="Personalización"
                description="Permite personalizar publicidad; requiere medición publicitaria."
                checked={preference.personalization}
                disabled={!preference.advertising}
                onCheckedChange={(personalization) =>
                  setPreference((current) => ({
                    ...current,
                    personalization,
                  }))
                }
              />
            </div>

            <div className="cookie-dialog-actions">
              <button
                type="button"
                className="button secondary"
                onClick={() => saveConsent(necessaryCookiesOnly)}
              >
                Solo necesarias
              </button>
              <button
                type="button"
                className="button primary"
                onClick={() => saveConsent(preference)}
              >
                Guardar preferencias
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

function CookiePreferenceRow({
  title,
  description,
  checked,
  disabled = false,
  onCheckedChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="cookie-preference-row">
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
      <Switch.Root
        className="cookie-switch"
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        aria-label={title}
      >
        <Switch.Thumb className="cookie-switch-thumb" />
      </Switch.Root>
    </div>
  );
}
