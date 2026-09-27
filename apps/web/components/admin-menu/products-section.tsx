"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { ChevronDown, Plus, RotateCcw, Search } from "lucide-react";
import type { AdminDiscount, AdminProduct, Category } from "../../lib/types";
import { normalizeSearch } from "./menu-admin-utils";
import { ProductFormPanel } from "./product-form-panel";
import { ProductTable } from "./product-table";

type ProductAvailabilityFilter = "ALL" | "AVAILABLE" | "SOLD_OUT" | "HIDDEN";

interface ProductsSectionProps {
  activeCategories: Category[];
  categories: Category[];
  categoriesForProduct: (product?: AdminProduct) => Category[];
  discounts: AdminDiscount[];
  expandedProductId?: string;
  onCreateProduct: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onExpandedProductChange: (productId?: string) => void;
  onToggleProduct: (product: AdminProduct) => Promise<void>;
  onUpdateProduct: (
    product: AdminProduct,
    event: FormEvent<HTMLFormElement>,
  ) => Promise<void>;
  products: AdminProduct[];
}

export function ProductsSection({
  activeCategories,
  categories,
  categoriesForProduct,
  discounts,
  expandedProductId,
  onCreateProduct,
  onExpandedProductChange,
  onToggleProduct,
  onUpdateProduct,
  products,
}: ProductsSectionProps) {
  const [productSearch, setProductSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [availabilityFilter, setAvailabilityFilter] =
    useState<ProductAvailabilityFilter>("ALL");

  const filteredProducts = useMemo(() => {
    const search = normalizeSearch(productSearch);

    return products.filter((product) => {
      const matchesCategory =
        categoryFilter === "ALL" || product.categoryId === categoryFilter;
      const matchesAvailability = productMatchesAvailability(
        product,
        availabilityFilter,
      );
      const matchesSearch =
        !search ||
        normalizeSearch(
          `${product.name} ${product.description} ${product.category?.name ?? ""}`,
        ).includes(search);

      return matchesCategory && matchesAvailability && matchesSearch;
    });
  }, [availabilityFilter, categoryFilter, productSearch, products]);

  function resetFilters() {
    setProductSearch("");
    setCategoryFilter("ALL");
    setAvailabilityFilter("ALL");
  }

  async function confirmAndToggleProduct(product: AdminProduct) {
    if (product.available) {
      const confirmed = window.confirm(
        `Marcar "${product.name}" como agotado? El cliente dejara de poder pedirlo hasta que lo reactives.`,
      );
      if (!confirmed) {
        return;
      }
    }

    await onToggleProduct(product);
  }

  return (
    <section className="menu-admin-section">
      <div className="menu-admin-section-head product-section-head">
        <div>
          <p className="eyebrow">Carta</p>
          <h2>Productos</h2>
        </div>
      </div>

      <details className="admin-create-panel product-create-panel">
        <summary>
          <span>
            <Plus aria-hidden="true" size={18} />
            Nuevo producto
          </span>
          <ChevronDown aria-hidden="true" size={18} />
        </summary>
        <ProductFormPanel
          categories={activeCategories}
          mode="create"
          onSubmit={(formElement) =>
            onCreateProduct(formEventFromElement(formElement))
          }
        />
      </details>

      <section className="menu-product-controls">
        <label className="search-field">
          Buscar producto
          <div>
            <Search aria-hidden="true" size={18} />
            <input
              value={productSearch}
              onChange={(event) => setProductSearch(event.target.value)}
              placeholder="Nombre, categoria o descripcion"
            />
          </div>
        </label>
        <label>
          Categoria
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
          >
            <option value="ALL">Todas</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
                {!category.active ? " (oculta)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          Estado
          <select
            value={availabilityFilter}
            onChange={(event) =>
              setAvailabilityFilter(
                event.target.value as ProductAvailabilityFilter,
              )
            }
          >
            <option value="ALL">Todos</option>
            <option value="AVAILABLE">Disponibles</option>
            <option value="SOLD_OUT">Agotados</option>
            <option value="HIDDEN">Ocultos</option>
          </select>
        </label>
        <button type="button" className="button secondary" onClick={resetFilters}>
          <RotateCcw aria-hidden="true" size={18} />
          Limpiar
        </button>
      </section>

      <ProductTable
        discounts={discounts}
        expandedProductId={expandedProductId}
        onExpandedProductChange={onExpandedProductChange}
        onToggleProduct={confirmAndToggleProduct}
        products={filteredProducts}
        renderExpandedProduct={(product) => (
          <ProductEditor
            categoriesForProduct={categoriesForProduct}
            onUpdateProduct={onUpdateProduct}
            product={product}
          />
        )}
      />
    </section>
  );
}

interface ProductEditorProps {
  categoriesForProduct: (product?: AdminProduct) => Category[];
  onUpdateProduct: (
    product: AdminProduct,
    event: FormEvent<HTMLFormElement>,
  ) => Promise<void>;
  product: AdminProduct;
}

function ProductEditor({
  categoriesForProduct,
  onUpdateProduct,
  product,
}: ProductEditorProps) {
  return (
    <div className="admin-product-editor">
      <ProductFormPanel
        categories={categoriesForProduct(product)}
        mode="edit"
        onSubmit={(formElement) =>
          onUpdateProduct(product, formEventFromElement(formElement))
        }
        product={product}
      />

      <p className="form-note">
        Los extras de este producto se gestionan desde la seccion Extras para
        evitar cambios accidentales mientras editas datos de carta.
      </p>
    </div>
  );
}

function productMatchesAvailability(
  product: AdminProduct,
  filter: ProductAvailabilityFilter,
): boolean {
  if (filter === "ALL") {
    return true;
  }

  if (filter === "AVAILABLE") {
    return Boolean(product.active && product.available && product.category?.active);
  }

  if (filter === "SOLD_OUT") {
    return Boolean(product.active && !product.available);
  }

  return Boolean(!product.active || !product.category?.active);
}

function formEventFromElement(
  formElement: HTMLFormElement,
): FormEvent<HTMLFormElement> {
  return {
    currentTarget: formElement,
    preventDefault: () => undefined,
    target: formElement,
  } as unknown as FormEvent<HTMLFormElement>;
}
