"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import Image from "next/image";
import { BadgePercent, ChevronDown, Plus, Save, Trash2 } from "lucide-react";
import { formatMoney } from "../../lib/api";
import type {
  AdminDiscount,
  AdminProduct,
  Category,
  DiscountWeekday,
  PromotionCampaign,
  PromotionDiscountType,
} from "../../lib/types";
import { ProductImage } from "../product-image";
import {
  discountScopeLabel,
  discountValueForForm,
  formatDiscountValue,
  validityLabel,
} from "./menu-admin-utils";
import type { EditableDiscountScope } from "./types";
import { weekdayOptions } from "./types";

interface PromotionsSectionProps {
  activeCategories: Category[];
  categories: Category[];
  discounts: AdminDiscount[];
  newDiscountScope: EditableDiscountScope;
  newDiscountType: PromotionDiscountType;
  products: AdminProduct[];
  promotionCampaign: PromotionCampaign;
  selectedPromotionProduct?: AdminProduct;
  onCreateDiscountRule: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onDeactivateDiscountRule: (discount: AdminDiscount) => Promise<void>;
  onNewDiscountScopeChange: (scope: EditableDiscountScope) => void;
  onNewDiscountTypeChange: (type: PromotionDiscountType) => void;
  onPromotionDraftChange: <K extends keyof PromotionCampaign>(
    key: K,
    value: PromotionCampaign[K],
  ) => void;
  onSavePromotionCampaign: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onUpdateDiscountRule: (
    discount: AdminDiscount,
    event: FormEvent<HTMLFormElement>,
    scope: EditableDiscountScope,
    type: PromotionDiscountType,
  ) => Promise<void>;
}

export function PromotionsSection({
  activeCategories,
  categories,
  discounts,
  newDiscountScope,
  newDiscountType,
  products,
  promotionCampaign,
  selectedPromotionProduct,
  onCreateDiscountRule,
  onDeactivateDiscountRule,
  onNewDiscountScopeChange,
  onNewDiscountTypeChange,
  onPromotionDraftChange,
  onSavePromotionCampaign,
  onUpdateDiscountRule,
}: PromotionsSectionProps) {
  return (
    <section className="menu-admin-section promotion-admin-section">
      <details className="admin-create-panel discount-create-panel" open>
        <summary>
          <span>
            <Plus aria-hidden="true" size={18} />
            Nueva regla de descuento
          </span>
          <ChevronDown aria-hidden="true" size={18} />
        </summary>
        <form className="discount-rule-form" onSubmit={onCreateDiscountRule}>
          <div className="form-grid">
            <label>
              Nombre
              <input name="name" maxLength={120} required />
            </label>
            <label>
              Tipo
              <select
                name="type"
                value={newDiscountType}
                onChange={(event) =>
                  onNewDiscountTypeChange(
                    event.currentTarget.value as PromotionDiscountType,
                  )
                }
              >
                <option value="PERCENTAGE">Porcentaje</option>
                <option value="FIXED_AMOUNT">Monto fijo</option>
              </select>
            </label>
            <label>
              Valor {newDiscountType === "PERCENTAGE" ? "(%)" : "(EUR)"}
              <input
                name="value"
                type="number"
                step="0.01"
                min="0.01"
                max={newDiscountType === "PERCENTAGE" ? "100" : undefined}
                required
              />
            </label>
            <label>
              Alcance
              <select
                name="scope"
                value={newDiscountScope}
                onChange={(event) =>
                  onNewDiscountScopeChange(
                    event.currentTarget.value as EditableDiscountScope,
                  )
                }
              >
                <option value="PRODUCTS">Productos</option>
                <option value="CATEGORY">Categoria</option>
              </select>
            </label>
            <label>
              Inicio
              <input name="startsOn" type="date" required />
            </label>
            <label>
              Fin
              <input name="endsOn" type="date" required />
            </label>
            <label>
              Prioridad
              <input
                name="priority"
                type="number"
                min="0"
                max="10000"
                defaultValue="0"
              />
            </label>
            <label className="checkbox-label">
              <input type="checkbox" name="active" />
              Activar al guardar
            </label>
            <label className="full-field">
              Descripcion interna
              <textarea
                name="description"
                rows={2}
                maxLength={260}
                placeholder="Opcional"
              />
            </label>
            <WeekdayPicker />
            <DiscountTargetFields
              scope={newDiscountScope}
              products={products}
              categories={activeCategories}
            />
          </div>
          <button className="button primary" type="submit">
            <Plus aria-hidden="true" size={18} />
            Crear descuento
          </button>
        </form>
      </details>

      <section className="form-panel discount-admin-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Reglas reales</p>
            <h2>Descuentos</h2>
          </div>
          <BadgePercent aria-hidden="true" size={26} />
        </div>

        {discounts.length === 0 ? (
          <div className="empty-state">No hay descuentos configurados.</div>
        ) : (
          <div className="discount-admin-list">
            {discounts.map((discount) => (
              <DiscountRuleEditor
                key={discount.id}
                discount={discount}
                products={products}
                categories={categories}
                onSubmit={onUpdateDiscountRule}
                onDeactivate={onDeactivateDiscountRule}
              />
            ))}
          </div>
        )}
      </section>

      <form
        className="form-panel promotion-admin-form"
        onSubmit={onSavePromotionCampaign}
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">Campana visual</p>
            <h2>Banner de portada</h2>
          </div>
          <BadgePercent aria-hidden="true" size={26} />
        </div>
        <div className="promotion-admin-grid">
          <div
            className="promotion-admin-preview"
            aria-label="Vista previa de la promocion visual"
          >
            <span>{promotionCampaign.badge || "Promo inactiva"}</span>
            <div className="promotion-admin-image">
              {promotionCampaign.imageUrl ? (
                <Image
                  src={promotionCampaign.imageUrl}
                  alt={promotionCampaign.title || "Promocion"}
                  width={720}
                  height={520}
                />
              ) : selectedPromotionProduct ? (
                <ProductImage product={selectedPromotionProduct} />
              ) : (
                <div className="image-fallback" aria-label="Promocion">
                  MT
                </div>
              )}
            </div>
            <h3>{promotionCampaign.title || "Sin promocion activa"}</h3>
            <p>
              {promotionCampaign.description ||
                "Configura una promocion real y activala cuando este lista."}
            </p>
          </div>
          <div className="form-grid">
            <label className="checkbox-label full-field">
              <input
                type="checkbox"
                name="enabled"
                checked={promotionCampaign.enabled}
                onChange={(event) =>
                  onPromotionDraftChange(
                    "enabled",
                    event.currentTarget.checked,
                  )
                }
              />
              Mostrar promocion en la carta
            </label>
            <label>
              Regla vinculada
              <select
                name="discountId"
                value={promotionCampaign.discountId}
                onChange={(event) =>
                  onPromotionDraftChange("discountId", event.currentTarget.value)
                }
              >
                <option value="">Sin regla vinculada</option>
                {discounts.map((discount) => (
                  <option key={discount.id} value={discount.id}>
                    {discount.name}
                    {discount.active ? "" : " (inactiva)"}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Producto
              <select
                name="productSlug"
                value={promotionCampaign.productSlug}
                onChange={(event) =>
                  onPromotionDraftChange("productSlug", event.currentTarget.value)
                }
              >
                <option value="">Seleccionar producto</option>
                {products.map((product) => (
                  <option key={product.id} value={product.slug}>
                    {product.name}
                    {!product.available ? " (agotado)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Etiqueta
              <input
                name="badge"
                value={promotionCampaign.badge}
                onChange={(event) =>
                  onPromotionDraftChange("badge", event.currentTarget.value)
                }
                placeholder="Promo de hoy"
                maxLength={40}
              />
            </label>
            <label className="full-field">
              Titulo
              <input
                name="title"
                value={promotionCampaign.title}
                onChange={(event) =>
                  onPromotionDraftChange("title", event.currentTarget.value)
                }
                placeholder="Nombre real de la promo"
                maxLength={90}
              />
            </label>
            <label className="full-field">
              Texto corto
              <textarea
                name="description"
                rows={3}
                value={promotionCampaign.description}
                onChange={(event) =>
                  onPromotionDraftChange(
                    "description",
                    event.currentTarget.value,
                  )
                }
                placeholder="Explica la promo sin precios inventados."
                maxLength={260}
              />
            </label>
            <label>
              Inicio
              <input
                name="startsOn"
                type="date"
                value={promotionCampaign.startsOn}
                onChange={(event) =>
                  onPromotionDraftChange("startsOn", event.currentTarget.value)
                }
              />
            </label>
            <label>
              Fin
              <input
                name="endsOn"
                type="date"
                value={promotionCampaign.endsOn}
                onChange={(event) =>
                  onPromotionDraftChange("endsOn", event.currentTarget.value)
                }
              />
            </label>
            <label>
              Texto del boton
              <input
                name="ctaLabel"
                value={promotionCampaign.ctaLabel}
                onChange={(event) =>
                  onPromotionDraftChange("ctaLabel", event.currentTarget.value)
                }
                placeholder="Pedir ahora"
                maxLength={40}
              />
            </label>
            <label className="full-field">
              Imagen promocional
              <input
                name="promotionImageFile"
                type="file"
                accept="image/png,image/jpeg,image/webp"
              />
              <input
                type="hidden"
                name="currentPromotionImage"
                value={promotionCampaign.imageUrl}
                readOnly
              />
            </label>
          </div>
        </div>
        <button className="button primary" type="submit">
          <Save aria-hidden="true" size={18} />
          Guardar promocion
        </button>
      </form>
    </section>
  );
}

interface DiscountRuleEditorProps {
  discount: AdminDiscount;
  products: AdminProduct[];
  categories: Category[];
  onSubmit: (
    discount: AdminDiscount,
    event: FormEvent<HTMLFormElement>,
    scope: EditableDiscountScope,
    type: PromotionDiscountType,
  ) => Promise<void>;
  onDeactivate: (discount: AdminDiscount) => Promise<void>;
}

function DiscountRuleEditor({
  discount,
  products,
  categories,
  onSubmit,
  onDeactivate,
}: DiscountRuleEditorProps) {
  const [scope, setScope] = useState<EditableDiscountScope>(
    discount.scope === "CATEGORY" ? "CATEGORY" : "PRODUCTS",
  );
  const [type, setType] = useState<PromotionDiscountType>(discount.type);

  useEffect(() => {
    setScope(discount.scope === "CATEGORY" ? "CATEGORY" : "PRODUCTS");
    setType(discount.type);
  }, [discount.id, discount.scope, discount.type]);

  function submitDiscountRule(event: FormEvent<HTMLFormElement>) {
    if (discount.active) {
      const form = new FormData(event.currentTarget);
      const willStayActive = form.get("active") === "on";

      if (!willStayActive) {
        const confirmed = window.confirm(
          `Desactivar "${discount.name}"? Los pedidos historicos conservaran el descuento ya aplicado.`,
        );
        if (!confirmed) {
          event.preventDefault();
          return;
        }
      }
    }

    void onSubmit(discount, event, scope, type);
  }

  return (
    <article className={`discount-rule-card ${discount.active ? "" : "off"}`}>
      <div className="discount-rule-head">
        <div>
          <span className={`status-pill ${discount.active ? "" : "danger"}`}>
            {discount.active ? "Activa" : "Inactiva"}
          </span>
          <h3>{discount.name}</h3>
          <p>
            {formatDiscountValue(discount)} - {discountScopeLabel(discount)} -{" "}
            {validityLabel(discount.weekdays)}
          </p>
        </div>
        <strong>Prioridad {discount.priority}</strong>
      </div>

      <form className="discount-rule-form" onSubmit={submitDiscountRule}>
        <div className="form-grid">
          <label>
            Nombre
            <input
              name="name"
              defaultValue={discount.name}
              maxLength={120}
              required
            />
          </label>
          <label>
            Tipo
            <select
              name="type"
              value={type}
              onChange={(event) =>
                setType(event.currentTarget.value as PromotionDiscountType)
              }
            >
              <option value="PERCENTAGE">Porcentaje</option>
              <option value="FIXED_AMOUNT">Monto fijo</option>
            </select>
          </label>
          <label>
            Valor {type === "PERCENTAGE" ? "(%)" : "(EUR)"}
            <input
              name="value"
              type="number"
              step="0.01"
              min="0.01"
              max={type === "PERCENTAGE" ? "100" : undefined}
              defaultValue={discountValueForForm(discount)}
              required
            />
          </label>
          <label>
            Alcance
            <select
              name="scope"
              value={scope}
              onChange={(event) =>
                setScope(event.currentTarget.value as EditableDiscountScope)
              }
            >
              <option value="PRODUCTS">Productos</option>
              <option value="CATEGORY">Categoria</option>
            </select>
          </label>
          <label>
            Inicio
            <input
              name="startsOn"
              type="date"
              defaultValue={discount.startsOn}
              required
            />
          </label>
          <label>
            Fin
            <input
              name="endsOn"
              type="date"
              defaultValue={discount.endsOn}
              required
            />
          </label>
          <label>
            Prioridad
            <input
              name="priority"
              type="number"
              min="0"
              max="10000"
              defaultValue={discount.priority}
            />
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              name="active"
              defaultChecked={discount.active}
            />
            Activa
          </label>
          <label className="full-field">
            Descripcion interna
            <textarea
              name="description"
              rows={2}
              maxLength={260}
              defaultValue={discount.description ?? ""}
              placeholder="Opcional"
            />
          </label>
          <WeekdayPicker defaultWeekdays={discount.weekdays} />
          <DiscountTargetFields
            scope={scope}
            products={products}
            categories={categories}
            defaultProductIds={discount.productIds}
            defaultCategoryId={discount.categoryId ?? undefined}
          />
        </div>
        <div className="row-actions">
          <button className="button primary" type="submit">
            <Save aria-hidden="true" size={18} />
            Guardar regla
          </button>
          <button
            className="button secondary"
            type="button"
            onClick={() => onDeactivate(discount)}
            disabled={!discount.active}
          >
            <Trash2 aria-hidden="true" size={18} />
            Desactivar
          </button>
        </div>
      </form>
    </article>
  );
}

function WeekdayPicker({
  defaultWeekdays = [],
}: {
  defaultWeekdays?: DiscountWeekday[];
}) {
  return (
    <fieldset className="discount-weekday-panel full-field">
      <legend>Dias validos</legend>
      <div>
        {weekdayOptions.map((weekday) => (
          <label key={weekday.value}>
            <input
              type="checkbox"
              name="weekdays"
              value={weekday.value}
              defaultChecked={defaultWeekdays.includes(weekday.value)}
            />
            <span>{weekday.label}</span>
          </label>
        ))}
      </div>
      <p>Sin marcar dias: valido todos los dias dentro del rango.</p>
    </fieldset>
  );
}

function DiscountTargetFields({
  scope,
  products,
  categories,
  defaultProductIds = [],
  defaultCategoryId,
}: {
  scope: EditableDiscountScope;
  products: AdminProduct[];
  categories: Category[];
  defaultProductIds?: string[];
  defaultCategoryId?: string;
}) {
  if (scope === "CATEGORY") {
    return (
      <label className="full-field">
        Categoria objetivo
        <select
          name="categoryId"
          defaultValue={defaultCategoryId ?? categories[0]?.id ?? ""}
          required
          disabled={categories.length === 0}
        >
          {categories.length === 0 ? (
            <option value="">Sin categorias disponibles</option>
          ) : (
            categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
                {!category.active ? " (oculta)" : ""}
              </option>
            ))
          )}
        </select>
      </label>
    );
  }

  return (
    <fieldset className="discount-target-panel full-field">
      <legend>Productos objetivo</legend>
      {products.length === 0 ? (
        <p className="muted">Sin productos para vincular.</p>
      ) : (
        <div className="discount-product-picker">
          {products.map((product) => (
            <label key={product.id}>
              <input
                type="checkbox"
                name="productIds"
                value={product.id}
                defaultChecked={defaultProductIds.includes(product.id)}
              />
              <span>
                {product.name}
                {!product.active
                  ? " (oculto)"
                  : !product.available
                    ? " (agotado)"
                    : ""}
              </span>
              <small>{formatMoney(product.priceCents)}</small>
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}
