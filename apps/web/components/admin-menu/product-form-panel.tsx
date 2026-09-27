"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, ImagePlus, Save } from "lucide-react";
import { useForm } from "react-hook-form";
import type { AdminProduct, Category } from "../../lib/types";
import { productFormSchema, type ProductFormValues } from "./product-schema";

interface ProductFormPanelProps {
  categories: Category[];
  mode: "create" | "edit";
  onSubmit: (formElement: HTMLFormElement) => Promise<void>;
  product?: AdminProduct;
}

export function ProductFormPanel({
  categories,
  mode,
  onSubmit,
  product,
}: ProductFormPanelProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [previewUrl, setPreviewUrl] = useState(product?.imageUrl ?? "");
  const defaultValues = useMemo<Partial<ProductFormValues>>(
    () => ({
      name: product?.name ?? "",
      categoryId: product?.categoryId ?? categories[0]?.id ?? "",
      ...(product ? { price: product.priceCents / 100 } : {}),
      sortOrder: product?.sortOrder ?? 0,
      description: product?.description ?? "",
      active: product?.active ?? true,
      imageFile: undefined,
      currentImageUrl: product?.imageUrl ?? "",
    }),
    [categories, product],
  );
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
    watch,
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues,
  });
  const selectedImage = watch("imageFile");
  const currentName = watch("name");

  useEffect(() => {
    reset(defaultValues);
    setPreviewUrl(defaultValues.currentImageUrl ?? "");
  }, [defaultValues, reset]);

  useEffect(() => {
    if (!isFileList(selectedImage) || selectedImage.length === 0) {
      setPreviewUrl(defaultValues.currentImageUrl ?? "");
      return;
    }

    const imageUrl = URL.createObjectURL(selectedImage[0]);
    setPreviewUrl(imageUrl);

    return () => URL.revokeObjectURL(imageUrl);
  }, [defaultValues.currentImageUrl, selectedImage]);

  const submit = handleSubmit(async (values) => {
    if (!formRef.current) {
      return;
    }

    if (product?.active && !values.active) {
      const confirmed = window.confirm(
        `Ocultar "${product.name}" lo quitara de la carta publica y puede bloquear pedidos desde carritos antiguos.`,
      );
      if (!confirmed) {
        return;
      }
    }

    await onSubmit(formRef.current);
  });

  return (
    <form
      className="form-panel product-create-form"
      noValidate
      autoComplete="off"
      ref={formRef}
      onSubmit={(event) => void submit(event)}
    >
      <div className="admin-section-grid">
        <div className="admin-product-media">
          {previewUrl ? (
            <Image
              src={previewUrl}
              alt={currentName || product?.name || "Producto"}
              width={900}
              height={900}
              sizes="(max-width: 820px) 100vw, 28vw"
              unoptimized={previewUrl.startsWith("blob:")}
            />
          ) : (
            <div className="image-fallback" aria-label="Sin imagen">
              <ImagePlus aria-hidden="true" size={32} />
            </div>
          )}
        </div>

        <div className="form-grid compact">
          {product && (
            <div className="full-field admin-product-badges">
              <span className={`status-pill ${product.available ? "" : "danger"}`}>
                {product.available ? "Disponible" : "Agotado"}
              </span>
              <span className={`status-pill ${product.active ? "" : "danger"}`}>
                {product.active ? "Visible en carta" : "Oculto"}
              </span>
            </div>
          )}

          <label>
            Nombre
            <input
              {...register("name")}
              aria-invalid={Boolean(errors.name)}
              autoComplete="off"
              placeholder="Nombre del producto"
            />
            {errors.name?.message && (
              <small className="form-error">{errors.name.message}</small>
            )}
          </label>

          <label>
            Categoria
            <select
              {...register("categoryId")}
              aria-invalid={Boolean(errors.categoryId)}
              disabled={categories.length === 0}
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                  {!category.active ? " (oculta)" : ""}
                </option>
              ))}
            </select>
            {errors.categoryId?.message && (
              <small className="form-error">{errors.categoryId.message}</small>
            )}
          </label>

          <label>
            Precio
            <input
              {...register("price", { valueAsNumber: true })}
              aria-invalid={Boolean(errors.price)}
              placeholder="0.00"
              type="number"
              step="0.01"
              min="0.01"
            />
            {errors.price?.message && (
              <small className="form-error">{errors.price.message}</small>
            )}
          </label>

          <label>
            Orden
            <input
              {...register("sortOrder", { valueAsNumber: true })}
              aria-invalid={Boolean(errors.sortOrder)}
              autoComplete="off"
              type="number"
              min="0"
            />
            {errors.sortOrder?.message && (
              <small className="form-error">{errors.sortOrder.message}</small>
            )}
          </label>

          <label className="full-field">
            Imagen
            <input
              {...register("imageFile")}
              name="imageFile"
              type="file"
              accept="image/png,image/jpeg,image/webp"
            />
            <input
              {...register("currentImageUrl")}
              name="currentImageUrl"
              type="hidden"
              readOnly
            />
          </label>

          <label className="full-field">
            Descripcion
            <textarea
              {...register("description")}
              aria-invalid={Boolean(errors.description)}
              rows={3}
              placeholder="Ingredientes y descripcion para el cliente."
            />
            {errors.description?.message && (
              <small className="form-error">{errors.description.message}</small>
            )}
          </label>

          {mode === "edit" && (
            <label className="checkbox-label">
              <input type="checkbox" {...register("active")} />
              Visible en carta
            </label>
          )}
        </div>
      </div>

      <div className="row-actions">
        <button
          className="button primary"
          type="submit"
          disabled={isSubmitting || categories.length === 0}
        >
          {mode === "edit" ? (
            <Save aria-hidden="true" size={18} />
          ) : (
            <ImagePlus aria-hidden="true" size={18} />
          )}
          {mode === "edit" ? "Guardar producto" : "Crear producto"}
        </button>
        {mode === "edit" && (
          <span className="form-note">
            <AlertTriangle aria-hidden="true" size={16} />
            Para agotar o reactivar rapido usa la accion de la fila.
          </span>
        )}
      </div>
    </form>
  );
}

function isFileList(value: unknown): value is FileList {
  return typeof FileList !== "undefined" && value instanceof FileList;
}
