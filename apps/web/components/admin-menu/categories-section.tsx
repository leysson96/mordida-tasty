"use client";

import type { FormEvent } from "react";
import { ChevronDown, Plus, RotateCcw, Save, Tags, Trash2 } from "lucide-react";
import type { Category } from "../../lib/types";

interface CategoriesSectionProps {
  categories: Category[];
  onCreateCategory: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onToggleCategory: (category: Category) => Promise<void>;
  onUpdateCategory: (
    category: Category,
    event: FormEvent<HTMLFormElement>,
  ) => Promise<void>;
}

export function CategoriesSection({
  categories,
  onCreateCategory,
  onToggleCategory,
  onUpdateCategory,
}: CategoriesSectionProps) {
  return (
    <section className="menu-admin-section category-manager-layout">
      <details className="admin-create-panel" open>
        <summary>
          <span>
            <Plus aria-hidden="true" size={18} />
            Nueva categoria
          </span>
          <ChevronDown aria-hidden="true" size={18} />
        </summary>
        <form className="category-create-form" onSubmit={onCreateCategory}>
          <div className="form-grid compact-two">
            <label>
              Nombre
              <input name="name" required />
            </label>
            <label>
              Orden
              <input name="sortOrder" type="number" min="0" defaultValue="0" />
            </label>
          </div>
          <button className="button primary" type="submit">
            <Plus aria-hidden="true" size={18} />
            Crear categoria
          </button>
        </form>
      </details>

      <section className="form-panel category-admin-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Carta</p>
            <h2>Categorias</h2>
          </div>
          <Tags aria-hidden="true" size={24} />
        </div>

        {categories.length === 0 ? (
          <div className="empty-state compact">Sin categorias configuradas.</div>
        ) : (
          <div className="category-admin-list">
            {categories.map((category) => (
              <form
                key={category.id}
                className={`category-row ${category.active ? "" : "inactive"}`}
                onSubmit={(event) => onUpdateCategory(category, event)}
              >
                <label>
                  Nombre
                  <input name="name" defaultValue={category.name} required />
                </label>
                <label>
                  Orden
                  <input
                    name="sortOrder"
                    type="number"
                    min="0"
                    defaultValue={category.sortOrder}
                  />
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="active"
                    defaultChecked={category.active}
                  />
                  Visible
                </label>
                <span className="category-count">
                  {category._count?.products ?? 0} productos
                </span>
                <div className="row-actions inline-actions">
                  <button
                    className="icon-button primary"
                    type="submit"
                    title="Guardar categoria"
                  >
                    <Save aria-hidden="true" size={18} />
                  </button>
                  <button
                    type="button"
                    className="icon-button secondary"
                    onClick={() => onToggleCategory(category)}
                    title={
                      category.active
                        ? "Ocultar categoria"
                        : "Reactivar categoria"
                    }
                  >
                    {category.active ? (
                      <Trash2 aria-hidden="true" size={18} />
                    ) : (
                      <RotateCcw aria-hidden="true" size={18} />
                    )}
                  </button>
                </div>
              </form>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
