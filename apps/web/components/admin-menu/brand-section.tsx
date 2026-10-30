"use client";

import {
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import Image from "../site-image";
import { ImagePlus, Save } from "lucide-react";
import type { AdminProduct, SiteContent } from "../../lib/types";

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
              <BrandLogoField
                currentUrl={siteContent.brandSquareLogoUrl}
                fieldName="brandSquareLogoFile"
                removeFieldName="removeBrandSquareLogo"
                title="Logo cuadrado"
                hint="PNG cuadrado. Recomendado 1200 x 1200 px; minimo 512 x 512 px. Maximo 5 MB."
                previewClassName="brand-logo-preview-square"
              />
              <BrandLogoField
                currentUrl={siteContent.brandHeaderLogoUrl}
                fieldName="brandHeaderLogoFile"
                removeFieldName="removeBrandHeaderLogo"
                title="Logo horizontal"
                hint="PNG entre 3:1 y 4:1. Recomendado 1200 x 400 o 1600 x 400 px. Maximo 5 MB."
                previewClassName="brand-logo-preview-header"
              />
            </div>
            <label>
              Texto alternativo
              <input
                name="logoAlt"
                defaultValue={siteContent.logoAlt}
                maxLength={80}
                placeholder={siteContent.name}
              />
            </label>
            <input
              type="hidden"
              name="initials"
              value={siteContent.initials}
              readOnly
            />
            <input
              type="hidden"
              name="currentBrandSquareLogo"
              value={siteContent.brandSquareLogoUrl}
              readOnly
            />
            <input
              type="hidden"
              name="currentBrandHeaderLogo"
              value={siteContent.brandHeaderLogoUrl}
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

interface BrandLogoFieldProps {
  currentUrl: string;
  fieldName: string;
  hint: string;
  previewClassName: string;
  removeFieldName: string;
  title: string;
}

function BrandLogoField({
  currentUrl,
  fieldName,
  hint,
  previewClassName,
  removeFieldName,
  title,
}: BrandLogoFieldProps) {
  const [previewUrl, setPreviewUrl] = useState("");
  const [removeCurrent, setRemoveCurrent] = useState(false);
  const visiblePreview = removeCurrent ? "" : previewUrl || currentUrl;

  useEffect(() => {
    return () => {
      if (previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setPreviewUrl(file ? URL.createObjectURL(file) : "");
    if (file) {
      setRemoveCurrent(false);
    }
  }

  return (
    <div className="brand-logo-field">
      <div>
        <strong>{title}</strong>
        <p>{hint}</p>
      </div>
      <div className={`brand-logo-preview ${previewClassName}`}>
        {visiblePreview ? (
          <Image
            src={visiblePreview}
            alt={`Vista previa: ${title}`}
            fill
            sizes={previewClassName.includes("square") ? "160px" : "320px"}
            unoptimized
          />
        ) : (
          <span>Sin imagen</span>
        )}
      </div>
      <label>
        Seleccionar PNG
        <input
          name={fieldName}
          type="file"
          accept="image/png"
          onChange={selectFile}
        />
      </label>
      {(currentUrl || previewUrl) && (
        <label className="brand-logo-remove">
          <input
            name={removeFieldName}
            type="checkbox"
            checked={removeCurrent}
            onChange={(event) => setRemoveCurrent(event.target.checked)}
          />
          Retirar esta imagen al guardar
        </label>
      )}
    </div>
  );
}
