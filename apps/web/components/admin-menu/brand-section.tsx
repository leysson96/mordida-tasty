"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import { ImagePlus, Save } from "lucide-react";
import type { AdminProduct, BrandLogoMode, SiteContent } from "../../lib/types";

interface BrandSectionProps {
  products: AdminProduct[];
  siteContent: SiteContent;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}

export function BrandSection({
  products,
  siteContent,
  onSubmit,
}: BrandSectionProps) {
  const [logoMode, setLogoMode] = useState<BrandLogoMode>(
    siteContent.logoMode,
  );
  const logoModeUsesImage = logoMode === "ICON" || logoMode === "LOGO";

  return (
    <form className="form-panel site-content-form" onSubmit={onSubmit}>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Inicio</p>
          <h2>Portada y marca</h2>
        </div>
        <ImagePlus aria-hidden="true" size={26} />
      </div>

      <div className="site-content-grid">
        <div className="brand-preview">
          <Image
            src={siteContent.heroImage}
            alt={siteContent.featuredProductName}
            width={640}
            height={420}
            priority
          />
        </div>

        <div className="form-grid">
          <label>
            Nombre de la pagina
            <input name="name" defaultValue={siteContent.name} required />
          </label>
          <div className="brand-logo-settings full-field">
            <div className="form-subsection">
              <span>Logo de marca</span>
            </div>
            <div className="brand-logo-grid">
              <label>
                Tipo de logo
                <select
                  name="logoMode"
                  value={logoMode}
                  onChange={(event) =>
                    setLogoMode(event.target.value as BrandLogoMode)
                  }
                >
                  <option value="INITIALS">Iniciales</option>
                  <option value="ICON">Icono PNG</option>
                  <option value="LOGO">Logo PNG</option>
                </select>
              </label>
              {logoMode === "INITIALS" ? (
                <label>
                  Iniciales
                  <input
                    name="initials"
                    defaultValue={siteContent.initials}
                    maxLength={8}
                    required
                  />
                </label>
              ) : (
                <input
                  type="hidden"
                  name="initials"
                  value={siteContent.initials}
                  readOnly
                />
              )}
              {logoModeUsesImage && (
                <>
                  <label>
                    Archivo PNG
                    <input name="logoImageFile" type="file" accept="image/png" />
                  </label>
                  <label>
                    Texto alternativo
                    <input
                      name="logoAlt"
                      defaultValue={siteContent.logoAlt}
                      maxLength={80}
                      placeholder={siteContent.name}
                    />
                  </label>
                </>
              )}
            </div>
            {logoModeUsesImage && siteContent.logoImageUrl && (
              <p className="brand-logo-current">
                Imagen actual guardada para la marca.
              </p>
            )}
            <input
              type="hidden"
              name="currentLogoImage"
              value={siteContent.logoImageUrl}
              readOnly
            />
          </div>
          <label className="full-field">
            Frase superior
            <input name="tagline" defaultValue={siteContent.tagline} required />
          </label>
          <label className="full-field">
            Titulo portada
            <input
              name="heroTitle"
              defaultValue={siteContent.heroTitle}
              required
            />
          </label>
          <label className="full-field">
            Texto portada
            <textarea
              name="heroText"
              rows={3}
              defaultValue={siteContent.heroText}
              required
            />
          </label>
          <label>
            Producto destacado
            <select
              name="featuredProductSlug"
              defaultValue={siteContent.featuredProductSlug}
            >
              {!products.some(
                (product) => product.slug === siteContent.featuredProductSlug,
              ) && (
                <option value={siteContent.featuredProductSlug}>
                  {siteContent.featuredProductName}
                </option>
              )}
              {products.map((product) => (
                <option key={product.id} value={product.slug}>
                  {product.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Fuente principal
            <input
              name="fontFamily"
              defaultValue={siteContent.fontFamily}
              required
            />
          </label>
          <label className="full-field">
            Texto sobre la carta
            <input
              name="menuIntroText"
              defaultValue={siteContent.menuIntroText}
              required
            />
          </label>
          <label>
            WhatsApp pedidos
            <input
              name="whatsappPhone"
              defaultValue={siteContent.whatsappPhone}
              placeholder="+34600111222"
            />
          </label>
          <label>
            Instagram
            <input
              name="instagramUrl"
              defaultValue={siteContent.instagramUrl}
              placeholder="@mordidatasty"
            />
          </label>
          <div className="form-subsection full-field">
            <span>Ubicacion</span>
          </div>
          <label>
            Titulo ubicacion
            <input
              name="locationTitle"
              defaultValue={siteContent.locationTitle}
              placeholder="Ven a por tu mordida"
            />
          </label>
          <label>
            Codigo postal local
            <input
              name="businessPostalCode"
              defaultValue={siteContent.businessPostalCode}
              placeholder="15000"
            />
          </label>
          <label className="full-field">
            Texto ubicacion
            <textarea
              name="locationText"
              rows={3}
              defaultValue={siteContent.locationText}
              placeholder="Recoge tu pedido caliente o abre la ruta en el movil."
            />
          </label>
          <label className="full-field">
            Direccion local
            <input
              name="businessAddress"
              defaultValue={siteContent.businessAddress}
              placeholder="Calle, numero, local"
            />
          </label>
          <label>
            Ciudad
            <input
              name="businessCity"
              defaultValue={siteContent.businessCity}
              placeholder="A Coruna"
            />
          </label>
          <label>
            Enlace exacto Google Maps
            <input
              name="googleMapsUrl"
              defaultValue={siteContent.googleMapsUrl}
              placeholder="https://maps.google.com/..."
            />
          </label>
          <div className="form-subsection full-field">
            <span>Nosotros</span>
          </div>
          <label className="full-field">
            Titulo nosotros
            <input
              name="aboutTitle"
              defaultValue={siteContent.aboutTitle}
              placeholder="Nosotros"
            />
          </label>
          <label className="full-field">
            Texto nosotros
            <textarea
              name="aboutText"
              rows={5}
              defaultValue={siteContent.aboutText}
              placeholder="Cuenta en pocas lineas que hace especial a Mordida Tasty."
            />
          </label>
          <label className="full-field">
            Foto portada
            <input
              name="heroImageFile"
              type="file"
              accept="image/png,image/jpeg,image/webp"
            />
            <input
              type="hidden"
              name="currentHeroImage"
              value={siteContent.heroImage}
              readOnly
            />
          </label>
        </div>
      </div>

      <button className="button primary" type="submit">
        <Save aria-hidden="true" size={18} />
        Guardar portada
      </button>
    </form>
  );
}
