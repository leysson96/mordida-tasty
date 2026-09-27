"use client";

import { Fragment, type ReactNode, useMemo } from "react";
import {
  ChevronDown,
  ChevronRight,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import {
  createColumnHelper,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { formatMoney } from "../../lib/api";
import type { AdminDiscount, AdminProduct } from "../../lib/types";
import { ProductImage } from "../product-image";

interface ProductTableProps {
  discounts: AdminDiscount[];
  expandedProductId?: string;
  onExpandedProductChange: (productId?: string) => void;
  onToggleProduct: (product: AdminProduct) => void;
  products: AdminProduct[];
  renderExpandedProduct: (product: AdminProduct) => ReactNode;
}

interface ProductTableRow {
  product: AdminProduct;
  statusLabel: string;
  statusTone: "ok" | "danger";
  promoLabels: string[];
  optionGroupCount: number;
}

const features = tableFeatures({});
const columnHelper = createColumnHelper<typeof features, ProductTableRow>();

export function ProductTable({
  discounts,
  expandedProductId,
  onExpandedProductChange,
  onToggleProduct,
  products,
  renderExpandedProduct,
}: ProductTableProps) {
  const rows = useMemo<ProductTableRow[]>(
    () =>
      products.map((product) => ({
        product,
        statusLabel: productStatusLabel(product),
        statusTone: productIsSellable(product) ? "ok" : "danger",
        promoLabels: productPromoLabels(product, discounts),
        optionGroupCount: product.optionGroups?.length ?? 0,
      })),
    [discounts, products],
  );

  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.display({
          id: "product",
          header: "Producto",
          cell: ({ row }) => {
            const { product } = row.original;

            return (
              <div className="admin-product-cell">
                <div className="admin-product-table-media">
                  <ProductImage product={product} />
                </div>
                <div>
                  <h3>{product.name}</h3>
                  <span>{product.category?.name ?? "Sin categoria"}</span>
                  <p>{product.description}</p>
                </div>
              </div>
            );
          },
        }),
        columnHelper.accessor((row) => row.product.priceCents, {
          id: "price",
          header: "Precio",
          cell: ({ getValue }) => (
            <strong className="admin-product-price">
              {formatMoney(getValue())}
            </strong>
          ),
        }),
        columnHelper.accessor("statusLabel", {
          header: "Estado",
          cell: ({ row, getValue }) => (
            <span
              className={`status-pill ${
                row.original.statusTone === "danger" ? "danger" : ""
              }`}
            >
              {getValue()}
            </span>
          ),
        }),
        columnHelper.display({
          id: "promos",
          header: "Promos",
          cell: ({ row }) =>
            row.original.promoLabels.length > 0 ? (
              <div className="product-table-pills">
                {row.original.promoLabels.map((label) => (
                  <span className="admin-soft-pill" key={label}>
                    {label}
                  </span>
                ))}
              </div>
            ) : (
              <span className="muted">Sin promo</span>
            ),
        }),
        columnHelper.accessor("optionGroupCount", {
          header: "Extras",
          cell: ({ getValue }) => (
            <span className="admin-soft-pill">{getValue()} grupos</span>
          ),
        }),
        columnHelper.display({
          id: "actions",
          header: "Acciones",
          cell: ({ row }) => {
            const { product } = row.original;
            const expanded = expandedProductId === product.id;

            return (
              <div className="product-table-actions">
                <button
                  type="button"
                  className="icon-button availability-button"
                  onClick={() => onToggleProduct(product)}
                  title={
                    product.available ? "Marcar agotado" : "Marcar disponible"
                  }
                >
                  {product.available ? (
                    <ToggleRight aria-hidden="true" size={23} />
                  ) : (
                    <ToggleLeft aria-hidden="true" size={23} />
                  )}
                </button>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() =>
                    onExpandedProductChange(expanded ? undefined : product.id)
                  }
                >
                  {expanded ? (
                    <ChevronDown aria-hidden="true" size={18} />
                  ) : (
                    <ChevronRight aria-hidden="true" size={18} />
                  )}
                  {expanded ? "Cerrar" : "Editar"}
                </button>
              </div>
            );
          },
        }),
      ]),
    [expandedProductId, onExpandedProductChange, onToggleProduct],
  );

  const table = useTable({
    features,
    columns,
    data: rows,
    getRowId: (row) => row.product.id,
  });

  if (products.length === 0) {
    return <div className="empty-state">Sin productos para mostrar.</div>;
  }

  return (
    <div className="product-table-panel">
      <table className="admin-product-table">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id}>
                  {header.isPlaceholder ? null : (
                    <table.FlexRender header={header} />
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => {
            const product = row.original.product;
            const expanded = expandedProductId === product.id;

            return (
              <Fragment key={row.id}>
                <tr className={expanded ? "expanded" : ""}>
                  {row.getAllCells().map((cell) => (
                    <td key={cell.id}>
                      <table.FlexRender cell={cell} />
                    </td>
                  ))}
                </tr>
                {expanded && (
                  <tr className="product-table-expanded-row">
                    <td colSpan={row.getAllCells().length}>
                      {renderExpandedProduct(product)}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function productIsSellable(product: AdminProduct): boolean {
  return Boolean(product.active && product.available && product.category?.active);
}

function productStatusLabel(product: AdminProduct): string {
  if (!product.active) {
    return "Oculto";
  }

  if (!product.category?.active) {
    return "Categoria oculta";
  }

  if (!product.available) {
    return "Agotado";
  }

  return "Disponible";
}

function productPromoLabels(
  product: AdminProduct,
  discounts: AdminDiscount[],
): string[] {
  return discounts
    .filter((discount) => {
      if (!discount.active) {
        return false;
      }

      if (discount.scope === "PRODUCTS") {
        return discount.productIds.includes(product.id);
      }

      if (discount.scope === "CATEGORY") {
        return discount.categoryId === product.categoryId;
      }

      return false;
    })
    .map((discount) => discount.name);
}
