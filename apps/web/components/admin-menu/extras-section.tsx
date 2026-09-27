"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { formatMoney } from "../../lib/api";
import type {
  AdminProduct,
  ProductOptionChoice,
  ProductOptionGroup,
} from "../../lib/types";

interface ExtrasSectionProps {
  products: AdminProduct[];
  onCreateOptionChoice: (
    group: ProductOptionGroup,
    event: FormEvent<HTMLFormElement>,
  ) => Promise<void>;
  onCreateOptionGroup: (
    product: AdminProduct,
    event: FormEvent<HTMLFormElement>,
  ) => Promise<void>;
  onToggleOptionChoice: (choice: ProductOptionChoice) => Promise<void>;
  onToggleOptionGroup: (group: ProductOptionGroup) => Promise<void>;
  onUpdateOptionChoice: (
    choice: ProductOptionChoice,
    event: FormEvent<HTMLFormElement>,
  ) => Promise<void>;
  onUpdateOptionGroup: (
    group: ProductOptionGroup,
    event: FormEvent<HTMLFormElement>,
  ) => Promise<void>;
}

export function ExtrasSection({
  products,
  onCreateOptionChoice,
  onCreateOptionGroup,
  onToggleOptionChoice,
  onToggleOptionGroup,
  onUpdateOptionChoice,
  onUpdateOptionGroup,
}: ExtrasSectionProps) {
  const sortedProducts = useMemo(
    () =>
      [...products].sort(
        (first, second) =>
          first.sortOrder - second.sortOrder ||
          first.name.localeCompare(second.name),
      ),
    [products],
  );
  const [selectedProductId, setSelectedProductId] = useState<string>();

  useEffect(() => {
    if (sortedProducts.length === 0) {
      setSelectedProductId(undefined);
      return;
    }

    if (
      !selectedProductId ||
      !sortedProducts.some((product) => product.id === selectedProductId)
    ) {
      setSelectedProductId(sortedProducts[0].id);
    }
  }, [selectedProductId, sortedProducts]);

  const selectedProduct = sortedProducts.find(
    (product) => product.id === selectedProductId,
  );

  if (sortedProducts.length === 0) {
    return (
      <section className="menu-admin-section">
        <div className="empty-state">Crea un producto antes de gestionar extras.</div>
      </section>
    );
  }

  return (
    <section className="menu-admin-section extras-manager-layout">
      <aside className="form-panel extras-product-panel">
        <div className="section-heading compact">
          <div>
            <p className="eyebrow">Carta</p>
            <h2>Productos</h2>
          </div>
        </div>
        <div className="extras-product-list">
          {sortedProducts.map((product) => {
            const activeGroups =
              product.optionGroups?.filter((group) => group.active).length ?? 0;
            const totalGroups = product.optionGroups?.length ?? 0;

            return (
              <button
                key={product.id}
                type="button"
                className={`extras-product-button ${
                  selectedProduct?.id === product.id ? "active" : ""
                }`}
                aria-pressed={selectedProduct?.id === product.id}
                onClick={() => setSelectedProductId(product.id)}
              >
                <span>
                  <strong>{product.name}</strong>
                  <small>{product.category?.name ?? "Sin categoria"}</small>
                </span>
                <em>
                  {activeGroups}/{totalGroups}
                </em>
              </button>
            );
          })}
        </div>
      </aside>

      {selectedProduct && (
        <section className="form-panel product-options-admin extras-work-panel">
          <div className="option-admin-title">
            <div>
              <p className="eyebrow">Extras</p>
              <h3>{selectedProduct.name}</h3>
            </div>
            <span>
              {selectedProduct.optionGroups?.length ?? 0} grupos configurados
            </span>
          </div>

          <form
            className="option-group-create"
            onSubmit={(event) => onCreateOptionGroup(selectedProduct, event)}
          >
            <label>
              Grupo
              <input name="name" placeholder="Extras, punto de carne..." required />
            </label>
            <label>
              Min
              <input name="minChoices" type="number" min="0" defaultValue="0" />
            </label>
            <label>
              Max
              <input name="maxChoices" type="number" min="1" defaultValue="1" />
            </label>
            <label>
              Orden
              <input name="sortOrder" type="number" min="0" defaultValue="0" />
            </label>
            <label className="checkbox-label">
              <input type="checkbox" name="required" />
              Obligatorio
            </label>
            <button className="button secondary" type="submit">
              <Plus aria-hidden="true" size={17} />
              Crear grupo
            </button>
          </form>

          {(selectedProduct.optionGroups?.length ?? 0) === 0 ? (
            <p className="muted">Sin opciones configuradas para este producto.</p>
          ) : (
            selectedProduct.optionGroups?.map((group) => (
              <section
                key={group.id}
                className={`option-admin-group ${group.active ? "" : "inactive"}`}
              >
                <form
                  className="option-group-edit"
                  onSubmit={(event) => onUpdateOptionGroup(group, event)}
                >
                  <label>
                    Nombre
                    <input name="name" defaultValue={group.name} required />
                  </label>
                  <label>
                    Min
                    <input
                      name="minChoices"
                      type="number"
                      min="0"
                      defaultValue={group.minChoices}
                    />
                  </label>
                  <label>
                    Max
                    <input
                      name="maxChoices"
                      type="number"
                      min="1"
                      defaultValue={group.maxChoices}
                    />
                  </label>
                  <label>
                    Orden
                    <input
                      name="sortOrder"
                      type="number"
                      min="0"
                      defaultValue={group.sortOrder}
                    />
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      name="required"
                      defaultChecked={group.required}
                    />
                    Obligatorio
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      name="active"
                      defaultChecked={group.active}
                    />
                    Activo
                  </label>
                  <div className="row-actions inline-actions">
                    <button
                      className="icon-button primary"
                      type="submit"
                      title="Guardar grupo"
                    >
                      <Save aria-hidden="true" size={17} />
                    </button>
                    <button
                      type="button"
                      className="icon-button secondary"
                      onClick={() => onToggleOptionGroup(group)}
                      title={group.active ? "Desactivar grupo" : "Reactivar grupo"}
                    >
                      {group.active ? (
                        <Trash2 aria-hidden="true" size={17} />
                      ) : (
                        <RotateCcw aria-hidden="true" size={17} />
                      )}
                    </button>
                  </div>
                </form>

                <form
                  className="option-choice-create"
                  onSubmit={(event) => onCreateOptionChoice(group, event)}
                >
                  <label>
                    Opcion
                    <input name="name" placeholder="Extra cheddar" required />
                  </label>
                  <label>
                    Precio
                    <input
                      name="price"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue="0"
                    />
                  </label>
                  <label>
                    Orden
                    <input
                      name="sortOrder"
                      type="number"
                      min="0"
                      defaultValue="0"
                    />
                  </label>
                  <button className="button secondary" type="submit">
                    <Plus aria-hidden="true" size={17} />
                    Anadir
                  </button>
                </form>

                <div className="option-choice-list-admin">
                  {group.choices.length === 0 ? (
                    <p className="muted">Sin opciones dentro del grupo.</p>
                  ) : (
                    group.choices.map((choice) => (
                      <form
                        key={choice.id}
                        className={`option-choice-row ${
                          choice.active ? "" : "inactive"
                        }`}
                        onSubmit={(event) => onUpdateOptionChoice(choice, event)}
                      >
                        <label>
                          Nombre
                          <input
                            name="name"
                            defaultValue={choice.name}
                            required
                          />
                        </label>
                        <label>
                          Precio
                          <input
                            name="price"
                            type="number"
                            step="0.01"
                            min="0"
                            defaultValue={choice.priceCents / 100}
                          />
                        </label>
                        <label>
                          Orden
                          <input
                            name="sortOrder"
                            type="number"
                            min="0"
                            defaultValue={choice.sortOrder}
                          />
                        </label>
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            name="active"
                            defaultChecked={choice.active}
                          />
                          Activa
                        </label>
                        <strong className="option-price-preview">
                          {formatMoney(choice.priceCents)}
                        </strong>
                        <div className="row-actions inline-actions">
                          <button
                            className="icon-button primary"
                            type="submit"
                            title="Guardar opcion"
                          >
                            <Save aria-hidden="true" size={17} />
                          </button>
                          <button
                            type="button"
                            className="icon-button secondary"
                            onClick={() => onToggleOptionChoice(choice)}
                            title={
                              choice.active
                                ? "Desactivar opcion"
                                : "Reactivar opcion"
                            }
                          >
                            {choice.active ? (
                              <Trash2 aria-hidden="true" size={17} />
                            ) : (
                              <RotateCcw aria-hidden="true" size={17} />
                            )}
                          </button>
                        </div>
                      </form>
                    ))
                  )}
                </div>
              </section>
            ))
          )}
        </section>
      )}
    </section>
  );
}
