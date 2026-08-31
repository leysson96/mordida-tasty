import { brandConfig } from '../../lib/brand';

export default function LegalNoticePage() {
  return (
    <main className="page-shell legal-page">
      <p className="eyebrow">Legal</p>
      <h1>Aviso legal</h1>
      <p>
        Este sitio pertenece a {brandConfig.name}. Antes de produccion se deben completar razon
        social, NIF/CIF, direccion fiscal, email de contacto y datos registrales si aplican.
      </p>
    </main>
  );
}
