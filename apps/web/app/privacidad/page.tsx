"use client";

import { Settings2 } from "lucide-react";
import Link from "next/link";
import { brandConfig } from "../../lib/brand";

const openCookiePreferencesEvent = "mordida_cookie_preferences_open";

export default function PrivacyPage() {
  return (
    <main className="page-shell legal-page">
      <p className="eyebrow">Legal</p>
      <h1>Politica de privacidad</h1>
      <p>
        {brandConfig.name} recoge los datos necesarios para gestionar pedidos,
        pagos, entregas, soporte y obligaciones legales. Los pagos se procesan
        en Stripe y no almacenamos datos de tarjetas.
      </p>
      <p>
        Si das tu permiso, usamos Google Analytics y Google Ads para entender
        visitas, uso de la carta y el resultado general de nuestras campañas.
        No medimos el panel de administración y puedes navegar usando solo las
        cookies necesarias.
      </p>
      <p>
        El titular debe completar aqui razon social, NIF/CIF, domicilio fiscal,
        email de contacto y textos revisados conforme a RGPD/LSSI antes del
        lanzamiento.
      </p>
      <div className="legal-actions">
        <button
          type="button"
          className="button secondary"
          onClick={() =>
            window.dispatchEvent(new Event(openCookiePreferencesEvent))
          }
        >
          <Settings2 aria-hidden="true" size={18} />
          Configurar cookies
        </button>
        <Link className="button primary" href="/rgpd/borrar-datos">
          Solicitar borrado
        </Link>
      </div>
    </main>
  );
}
