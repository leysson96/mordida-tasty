"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import { api, formatMoney } from "../lib/api";
import { brandConfig } from "../lib/brand";
import { CartItemOption, Product } from "../lib/types";
import { useCart } from "./cart-provider";
import { ProductImage } from "./product-image";

export function ProductDetailClient({ slug }: { slug: string }) {
  const [product, setProduct] = useState<Product>();
  const [error, setError] = useState<string>();
  const [selectionError, setSelectionError] = useState<string>();
  const [selectedChoices, setSelectedChoices] = useState<
    Record<string, string[]>
  >({});
  const { addItem } = useCart();

  useEffect(() => {
    api<Product>(`/products/${slug}`)
      .then(setProduct)
      .catch((requestError: Error) => setError(requestError.message));
  }, [slug]);

  const optionGroups = useMemo(
    () =>
      (product?.optionGroups ?? [])
        .filter((group) => group.active)
        .map((group) => ({
          ...group,
          choices: group.choices.filter((choice) => choice.active),
        })),
    [product],
  );

  const selectedCartOptions = useMemo<CartItemOption[]>(() => {
    if (!product) {
      return [];
    }

    return optionGroups.flatMap((group) => {
      const selectedIds = selectedChoices[group.id] ?? [];
      return group.choices
        .filter((choice) => selectedIds.includes(choice.id))
        .map((choice) => ({
          groupId: group.id,
          groupName: group.name,
          choiceId: choice.id,
          choiceName: choice.name,
          priceCents: choice.priceCents,
        }));
    });
  }, [optionGroups, product, selectedChoices]);

  const unitPriceCents =
    (product?.priceCents ?? 0) +
    selectedCartOptions.reduce((sum, option) => sum + option.priceCents, 0);

  if (error) {
    return <main className="page-shell empty-state error">{error}</main>;
  }

  if (!product) {
    return <main className="page-shell empty-state">Cargando producto</main>;
  }

  function changeChoice(groupId: string, choiceId: string, checked: boolean) {
    const group = optionGroups.find((item) => item.id === groupId);
    if (!group) {
      return;
    }

    setSelectionError(undefined);
    setSelectedChoices((current) => {
      const currentChoices = current[groupId] ?? [];

      if (group.maxChoices === 1) {
        return { ...current, [groupId]: [choiceId] };
      }

      if (!checked) {
        return {
          ...current,
          [groupId]: currentChoices.filter((item) => item !== choiceId),
        };
      }

      if (currentChoices.includes(choiceId)) {
        return current;
      }

      if (currentChoices.length >= group.maxChoices) {
        setSelectionError(
          `Selecciona como maximo ${group.maxChoices} opcion(es) de ${group.name}.`,
        );
        return current;
      }

      return { ...current, [groupId]: [...currentChoices, choiceId] };
    });
  }

  function clearChoice(groupId: string) {
    setSelectionError(undefined);
    setSelectedChoices((current) => ({ ...current, [groupId]: [] }));
  }

  function addConfiguredItem() {
    if (!product) {
      return;
    }

    for (const group of optionGroups) {
      const selectedCount = selectedChoices[group.id]?.length ?? 0;
      const minimumChoices = group.required
        ? Math.max(1, group.minChoices)
        : group.minChoices;

      if (selectedCount < minimumChoices) {
        setSelectionError(
          `Selecciona al menos ${minimumChoices} opcion(es) de ${group.name}.`,
        );
        return;
      }
    }

    addItem(product, selectedCartOptions);
    setSelectionError(undefined);
  }

  return (
    <main className="page-shell product-detail">
      <Link href="/" className="back-link">
        <ArrowLeft aria-hidden="true" size={18} />
        Menu
      </Link>
      <section className="detail-layout">
        <div className="detail-image">
          <ProductImage product={product} priority />
          {!product.available && <span className="sold-out">Agotado</span>}
        </div>
        <div className="detail-copy">
          <p className="eyebrow">{brandConfig.name}</p>
          <h1>{product.name}</h1>
          <p>{product.description}</p>
          {optionGroups.length > 0 && (
            <div className="product-option-panel">
              {optionGroups.map((group) => (
                <section className="option-group" key={group.id}>
                  <div className="option-group-head">
                    <h2>{group.name}</h2>
                    <span>{group.required ? "Obligatorio" : "Opcional"}</span>
                  </div>
                  <div className="option-choice-list">
                    {group.maxChoices === 1 &&
                      !group.required &&
                      group.minChoices === 0 && (
                        <label className="choice-row">
                          <input
                            type="radio"
                            name={`option-${group.id}`}
                            checked={
                              (selectedChoices[group.id]?.length ?? 0) === 0
                            }
                            onChange={() => clearChoice(group.id)}
                          />
                          <span>Sin extra</span>
                          <strong>Incluido</strong>
                        </label>
                      )}
                    {group.choices.map((choice) => {
                      const checked = Boolean(
                        selectedChoices[group.id]?.includes(choice.id),
                      );
                      const type =
                        group.maxChoices === 1 ? "radio" : "checkbox";

                      return (
                        <label className="choice-row" key={choice.id}>
                          <input
                            type={type}
                            name={`option-${group.id}`}
                            checked={checked}
                            onChange={(event) =>
                              changeChoice(
                                group.id,
                                choice.id,
                                event.target.checked,
                              )
                            }
                          />
                          <span>{choice.name}</span>
                          <strong>
                            {choice.priceCents > 0
                              ? `+${formatMoney(choice.priceCents)}`
                              : "Incluido"}
                          </strong>
                        </label>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
          {selectionError && <p className="form-error">{selectionError}</p>}
          <div className="detail-actions">
            <strong>{formatMoney(unitPriceCents)}</strong>
            <button
              type="button"
              className="button primary"
              disabled={!product.available}
              onClick={addConfiguredItem}
            >
              <Plus aria-hidden="true" size={18} />
              Anadir
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
