import Link from "next/link";
import { brandConfig } from "../../lib/brand";

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
        Si aceptas la medicion, usamos Google Analytics para entender visitas y
        uso de la carta. No se carga en el panel de administracion y puedes
        navegar usando solo cookies tecnicas.
      </p>
      <p>
        El titular debe completar aqui razon social, NIF/CIF, domicilio fiscal,
        email de contacto y textos revisados conforme a RGPD/LSSI antes del
        lanzamiento.
      </p>
      <Link className="button primary" href="/rgpd/borrar-datos">
        Solicitar borrado
      </Link>
    </main>
  );
}
