"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  BadgePercent,
  ChevronDown,
  ChevronRight,
  ImagePlus,
  Package,
  Palette,
  Plus,
  RotateCcw,
  Save,
  Search,
  Tags,
  ToggleLeft,
  ToggleRight,
  Trash2,
} from "lucide-react";
import { api, formatMoney } from "../lib/api";
import {
  readableErrorMessage,
  redirectOnAdminAuthError,
} from "../lib/admin-errors";
import { brandConfig } from "../lib/brand";
import {
  AdminDiscount,
  AdminProduct,
  Category,
  DiscountScope,
  DiscountWeekday,
  ProductOptionChoice,
  ProductOptionGroup,
  PromotionCampaign,
  PromotionDiscountType,
  SiteContent,
  UploadedImage,
} from "../lib/types";
import { ProductImage } from "./product-image";

interface AdminSettingsResponse {
  siteContent: SiteContent;
  promotionCampaign: PromotionCampaign;
}

type MenuAdminSection = "products" | "categories" | "brand" | "promotions";

const defaultPromotionCampaign: PromotionCampaign = {
  enabled: false,
  badge: "",
  title: "",
  description: "",
  productSlug: "",
  discountId: "",
  imageUrl: "",
  startsOn: "",
  endsOn: "",
  ctaLabel: "Pedir ahora",
};

type EditableDiscountScope = Extract<DiscountScope, "PRODUCTS" | "CATEGORY">;

interface AdminDiscountPayload {
  name: string;
  description: string;
  active: boolean;
  type: PromotionDiscountType;
  value: number;
  scope: EditableDiscountScope;
  startsOn: string;
  endsOn: string;
  weekdays: DiscountWeekday[];
  priority: number;
  productIds?: string[];
  categoryId?: string;
}

const weekdayOptions: Array<{ value: DiscountWeekday; label: string }> = [
  { value: "MON", label: "Lun" },
  { value: "TUE", label: "Mar" },
  { value: "WED", label: "Mie" },
  { value: "THU", label: "Jue" },
  { value: "FRI", label: "Vie" },
  { value: "SAT", label: "Sab" },
  { value: "SUN", label: "Dom" },
];

export function AdminMenuClient() {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [discounts, setDiscounts] = useState<AdminDiscount[]>([]);
  const [siteContent, setSiteContent] = useState<SiteContent>(brandConfig);
  const [promotionCampaign, setPromotionCampaign] =
    useState<PromotionCampaign>(defaultPromotionCampaign);
  const [activeSection, setActiveSection] =
    useState<MenuAdminSection>("products");
  const [productSearch, setProductSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [newDiscountScope, setNewDiscountScope] =
    useState<EditableDiscountScope>("PRODUCTS");
  const [newDiscountType, setNewDiscountType] =
    useState<PromotionDiscountType>("PERCENTAGE");
  const [expandedProductId, setExpandedProductId] = useState<string>();
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();

  const activeCategories = useMemo(
    () => categories.filter((category) => category.active),
    [categories],
  );
  const menuStats = useMemo(
    () => ({
      products: products.length,
      availableProducts: products.filter(
        (product) => product.active && product.available,
      ).length,
      categories: activeCategories.length,
      optionGroups: products.reduce(
        (sum, product) =>
          sum +
          (product.optionGroups?.filter((group) => group.active).length ?? 0),
        0,
      ),
      activeDiscounts: discounts.filter((discount) => discount.active).length,
    }),
    [activeCategories.length, discounts, products],
  );
  const filteredProducts = useMemo(() => {
    const search = normalizeSearch(productSearch);
    return products.filter((product) => {
      const matchesCategory =
        categoryFilter === "ALL" || product.categoryId === categoryFilter;
      const matchesSearch =
        !search ||
        normalizeSearch(
          `${product.name} ${product.description} ${product.category?.name ?? ""}`,
        ).includes(search);

      return matchesCategory && matchesSearch;
    });
  }, [categoryFilter, productSearch, products]);
  const productGroups = useMemo(() => {
    const groups = new Map<
      string,
      { id: string; name: string; active: boolean; products: AdminProduct[] }
    >();

    for (const category of categories) {
      groups.set(category.id, {
        id: category.id,
        name: category.name,
        active: category.active,
        products: [],
      });
    }

    for (const product of filteredProducts) {
      const group = groups.get(product.categoryId) ?? {
        id: product.categoryId,
        name: product.category?.name ?? "Sin categoria",
        active: product.category?.active ?? false,
        products: [],
      };
      group.products.push(product);
      groups.set(product.categoryId, group);
    }

    return [...groups.values()].filter((group) => group.products.length > 0);
  }, [categories, filteredProducts]);
  const selectedPromotionProduct = useMemo(
    () =>
      products.find((product) => product.slug === promotionCampaign.productSlug),
    [products, promotionCampaign.productSlug],
  );

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const [productData, categoryData, settingsData, discountData] =
        await Promise.all([
          api<AdminProduct[]>("/admin/products"),
          api<Category[]>("/admin/categories"),
          api<AdminSettingsResponse>("/admin/settings"),
          api<AdminDiscount[]>("/admin/discounts"),
        ]);
      setProducts(productData);
      setCategories(categoryData);
      setDiscounts(discountData);
      setSiteContent({ ...brandConfig, ...settingsData.siteContent });
      setPromotionCampaign({
        ...defaultPromotionCampaign,
        ...settingsData.promotionCampaign,
      });
      setError(undefined);
    } catch (requestError) {
      handleAdminError(requestError, "No se pudo cargar.");
    }
  }

  async function saveSiteContent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const featuredProductSlug = String(
      form.get("featuredProductSlug") || siteContent.featuredProductSlug,
    );
    const featuredProduct = products.find(
      (product) => product.slug === featuredProductSlug,
    );

    try {
      const uploadedHero = await uploadFormImage(form, "heroImageFile");
      const updated = await api<SiteContent>("/admin/settings/site-content", {
        method: "PATCH",
        body: JSON.stringify({
          name: String(form.get("name")),
          initials: String(form.get("initials")),
          tagline: String(form.get("tagline")),
          heroTitle: String(form.get("heroTitle")),
          heroText: String(form.get("heroText")),
          heroImage:
            uploadedHero ??
            String(form.get("currentHeroImage") || siteContent.heroImage),
          featuredProductSlug,
          featuredProductName:
            featuredProduct?.name ?? siteContent.featuredProductName,
          menuIntroText: String(form.get("menuIntroText")),
          fontFamily: String(form.get("fontFamily")),
          instagramUrl: String(form.get("instagramUrl")),
          whatsappPhone: String(form.get("whatsappPhone")),
          locationTitle: String(form.get("locationTitle")),
          locationText: String(form.get("locationText")),
          businessAddress: String(form.get("businessAddress")),
          businessCity: String(form.get("businessCity")),
          businessPostalCode: String(form.get("businessPostalCode")),
          googleMapsUrl: String(form.get("googleMapsUrl")),
          aboutTitle: String(form.get("aboutTitle")),
          aboutText: String(form.get("aboutText")),
        }),
      });
      setSiteContent(updated);
      setMessage("Portada guardada.");
      setError(undefined);
    } catch (requestError) {
      handleAdminError(requestError, "No se pudo guardar la portada.");
    }
  }

  async function savePromotionCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    try {
      const uploadedPromotionImage = await uploadFormImage(
        form,
        "promotionImageFile",
      );
      const updated = await api<PromotionCampaign>(
        "/admin/settings/promotion",
        {
          method: "PATCH",
          body: JSON.stringify({
            enabled: form.get("enabled") === "on",
            badge: String(form.get("badge")),
            title: String(form.get("title")),
            description: String(form.get("description")),
            productSlug: String(form.get("productSlug")),
            discountId: String(form.get("discountId")),
            imageUrl:
              uploadedPromotionImage ??
              String(
                form.get("currentPromotionImage") ||
                  promotionCampaign.imageUrl,
              ),
            startsOn: String(form.get("startsOn")),
            endsOn: String(form.get("endsOn")),
            ctaLabel: String(form.get("ctaLabel")),
          }),
        },
      );
      setPromotionCampaign(updated);
      setMessage(
        updated.enabled
          ? "Promocion activada."
          : "Promocion guardada como inactiva.",
      );
      setError(undefined);
    } catch (requestError) {
      handleAdminError(requestError, "No se pudo guardar la promocion.");
    }
  }

  async function createDiscountRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);

    try {
      await api<AdminDiscount>("/admin/discounts", {
        method: "POST",
        body: JSON.stringify(
          discountPayloadFromForm(form, newDiscountScope, newDiscountType),
        ),
      });
      formElement.reset();
      setNewDiscountScope("PRODUCTS");
      setNewDiscountType("PERCENTAGE");
      setMessage("Regla de descuento creada.");
      setError(undefined);
      await load();
    } catch (requestError) {
      handleAdminError(requestError, "No se pudo crear el descuento.");
    }
  }

  async function updateDiscountRule(
    discount: AdminDiscount,
    event: FormEvent<HTMLFormElement>,
    scope: EditableDiscountScope,
    type: PromotionDiscountType,
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    try {
      await api<AdminDiscount>(`/admin/discounts/${discount.id}`, {
        method: "PATCH",
        body: JSON.stringify(discountPayloadFromForm(form, scope, type)),
      });
      setMessage("Regla de descuento guardada.");
      setError(undefined);
      await load();
    } catch (requestError) {
      handleAdminError(requestError, "No se pudo guardar el descuento.");
    }
  }

  async function deactivateDiscountRule(discount: AdminDiscount) {
    const confirmed = window.confirm(
      `Desactivar "${discount.name}"? Los pedidos historicos conservaran el descuento ya aplicado.`,
    );
    if (!confirmed) {
      return;
    }

    try {
      await api<AdminDiscount>(`/admin/discounts/${discount.id}`, {
        method: "DELETE",
      });
      setMessage("Regla de descuento desactivada.");
      setError(undefined);
      await load();
    } catch (requestError) {
      handleAdminError(requestError, "No se pudo desactivar el descuento.");
    }
  }

  async function createCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);

    try {
      await api("/admin/categories", {
        method: "POST",
        body: JSON.stringify({
          name: String(form.get("name")),
          sortOrder: Number(form.get("sortOrder") || 0),
        }),
      });
      formElement.reset();
      setMessage("Categoria creada.");
      await load();
    } catch (requestError) {
      handleAdminError(requestError, "No se pudo crear la categoria.");
    }
  }

  async function updateCategory(
    category: Category,
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    try {
      await api(`/admin/categories/${category.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: String(form.get("name")),
          sortOrder: Number(form.get("sortOrder") || 0),
          active: form.get("active") === "on",
        }),
      });
      setMessage("Categoria guardada.");
      await load();
    } catch (requestError) {
      handleAdminError(requestError, "No se pudo guardar la categoria.");
    }
  }

  async function toggleCategory(category: Category) {
    try {
      if (category.active) {
        const confirmed = window.confirm(
          `Ocultar "${category.name}" tambien ocultara sus productos en la carta publica y bloqueara pedidos desde carritos antiguos.`,
        );
        if (!confirmed) {
          return;
        }

        await api(`/admin/categories/${category.id}`, { method: "DELETE" });
        setMessage("Categoria ocultada.");
      } else {
        await api(`/admin/categories/${category.id}`, {
          method: "PATCH",
          body: JSON.stringify({ active: true }),
        });
        setMessage("Categoria reactivada.");
      }

      await load();
    } catch (requestError) {
      handleAdminError(requestError, "No se pudo cambiar la categoria.");
    }
  }

  async function createProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);

    try {
      const imageUrl = await uploadFormImage(form, "imageFile");
      await api("/admin/products", {
        method: "POST",
        body: JSON.stringify({
          name: String(form.get("name")),
          description: String(form.get("description")),
          categoryId: String(form.get("categoryId")),
          priceCents: Math.round(Number(form.get("price")) * 100),
          imageUrl,
          sortOrder: Number(form.get("sortOrder") || 0),
        }),
      });
      formElement.reset();
      setMessage("Producto creado.");
      await load();
    } catch (requestError) {
      handleAdminError(requestError, "No se pudo crear.");
    }
  }

  async function toggleProduct(product: AdminProduct) {
    try {
      const updated = await api<AdminProduct>(
        `/admin/products/${product.id}/availability`,
        {
          method: "PATCH",
          body: JSON.stringify({ available: !product.available }),
        },
      );
      setProducts((current) =>
        current.map((item) => (item.id === product.id ? updated : item)),
      );
      setMessage(
        updated.available ? "Producto disponible." : "Producto agotado.",
      );
    } catch (requestError) {
      handleAdminError(requestError, "No se pudo cambiar.");
    }
  }

  async function updateProduct(
    product: AdminProduct,
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    try {
      const imageUrl =
        (await uploadFormImage(form, "imageFile")) ??
        String(form.get("currentImageUrl") || product.imageUrl || "");
      const updated = await api<AdminProduct>(`/admin/products/${product.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: String(form.get("name")),
          description: String(form.get("description")),
          categoryId: String(form.get("categoryId")),
          priceCents: Math.round(Number(form.get("price")) * 100),
          imageUrl,
          active: form.get("active") === "on",
          sortOrder: Number(form.get("sortOrder") || 0),
        }),
      });
      setProducts((current) =>
        current.map((item) => (item.id === product.id ? updated : item)),
      );
      setMessage("Producto guardado.");
    } catch (requestError) {
      handleAdminError(requestError, "No se pudo guardar.");
    }
  }

  async function createOptionGroup(
    product: AdminProduct,
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);

    try {
      await api(`/admin/products/${product.id}/option-groups`, {
        method: "POST",
        body: JSON.stringify({
          name: String(form.get("name")),
          required: form.get("required") === "on",
          minChoices: Number(form.get("minChoices") || 0),
          maxChoices: Number(form.get("maxChoices") || 1),
          sortOrder: Number(form.get("sortOrder") || 0),
        }),
      });
      formElement.reset();
      setMessage("Grupo de opciones creado.");
      await load();
    } catch (requestError) {
      handleAdminError(requestError, "No se pudo crear el grupo.");
    }
  }

  async function updateOptionGroup(
    group: ProductOptionGroup,
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    try {
      await api(`/admin/product-option-groups/${group.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: String(form.get("name")),
          required: form.get("required") === "on",
          minChoices: Number(form.get("minChoices") || 0),
          maxChoices: Number(form.get("maxChoices") || 1),
          active: form.get("active") === "on",
          sortOrder: Number(form.get("sortOrder") || 0),
        }),
      });
      setMessage("Grupo de opciones guardado.");
      await load();
    } catch (requestError) {
      handleAdminError(requestError, "No se pudo guardar el grupo.");
    }
  }

  async function toggleOptionGroup(group: ProductOptionGroup) {
    try {
      if (group.active) {
        const confirmed = window.confirm(
          `Desactivar "${group.name}"? Dejaria de aparecer en nuevos pedidos.`,
        );
        if (!confirmed) {
          return;
        }

        await api(`/admin/product-option-groups/${group.id}`, {
          method: "DELETE",
        });
        setMessage("Grupo desactivado.");
      } else {
        await api(`/admin/product-option-groups/${group.id}`, {
          method: "PATCH",
          body: JSON.stringify({ active: true }),
        });
        setMessage("Grupo reactivado.");
      }

      await load();
    } catch (requestError) {
      handleAdminError(requestError, "No se pudo cambiar el grupo.");
    }
  }

  async function createOptionChoice(
    group: ProductOptionGroup,
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);

    try {
      await api(`/admin/product-option-groups/${group.id}/choices`, {
        method: "POST",
        body: JSON.stringify({
          name: String(form.get("name")),
          priceCents: Math.round(Number(form.get("price") || 0) * 100),
          sortOrder: Number(form.get("sortOrder") || 0),
        }),
      });
      formElement.reset();
      setMessage("Opcion creada.");
      await load();
    } catch (requestError) {
      handleAdminError(requestError, "No se pudo crear la opcion.");
    }
  }

  async function updateOptionChoice(
    choice: ProductOptionChoice,
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    try {
      await api(`/admin/product-option-choices/${choice.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: String(form.get("name")),
          priceCents: Math.round(Number(form.get("price") || 0) * 100),
          active: form.get("active") === "on",
          sortOrder: Number(form.get("sortOrder") || 0),
        }),
      });
      setMessage("Opcion guardada.");
      await load();
    } catch (requestError) {
      handleAdminError(requestError, "No se pudo guardar la opcion.");
    }
  }

  async function toggleOptionChoice(choice: ProductOptionChoice) {
    try {
      if (choice.active) {
        const confirmed = window.confirm(
          `Desactivar "${choice.name}"? Dejaria de aparecer en nuevos pedidos.`,
        );
        if (!confirmed) {
          return;
        }

        await api(`/admin/product-option-choices/${choice.id}`, {
          method: "DELETE",
        });
        setMessage("Opcion desactivada.");
      } else {
        await api(`/admin/product-option-choices/${choice.id}`, {
          method: "PATCH",
          body: JSON.stringify({ active: true }),
        });
        setMessage("Opcion reactivada.");
      }

      await load();
    } catch (requestError) {
      handleAdminError(requestError, "No se pudo cambiar la opcion.");
    }
  }

  async function uploadFormImage(form: FormData, fieldName: string) {
    const value = form.get(fieldName);
    if (!(value instanceof File) || value.size === 0) {
      return undefined;
    }

    const uploadForm = new FormData();
    uploadForm.append("file", value);
    const uploaded = await api<UploadedImage>("/admin/uploads/images", {
      method: "POST",
      body: uploadForm,
    });
    return uploaded.url;
  }

  function categoriesForProduct(product?: AdminProduct) {
    return categories.filter(
      (category) => category.active || category.id === product?.categoryId,
    );
  }

  function updatePromotionDraft<K extends keyof PromotionCampaign>(
    key: K,
    value: PromotionCampaign[K],
  ) {
    setPromotionCampaign((current) => ({ ...current, [key]: value }));
  }

  function handleAdminError(requestError: unknown, fallback: string) {
    if (redirectOnAdminAuthError(requestError)) {
      return;
    }

    setMessage(undefined);
    setError(readableErrorMessage(requestError, fallback));
  }

  return (
    <main className="page-shell admin-page">
      <section className="admin-toolbar">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Menu</h1>
        </div>
      </section>

      {error && <div className="empty-state error">{error}</div>}
      {message && <p className="form-success">{message}</p>}

      <section className="menu-admin-workspace">
        <nav className="menu-admin-tabs" aria-label="Secciones del menu">
          <button
            type="button"
            className={activeSection === "products" ? "active" : ""}
            onClick={() => setActiveSection("products")}
          >
            <Package aria-hidden="true" size={19} />
            <span>Productos</span>
            <small>{menuStats.products}</small>
          </button>
          <button
            type="button"
            className={activeSection === "categories" ? "active" : ""}
            onClick={() => setActiveSection("categories")}
          >
            <Tags aria-hidden="true" size={19} />
            <span>Categorias</span>
            <small>{menuStats.categories}</small>
          </button>
          <button
            type="button"
            className={activeSection === "brand" ? "active" : ""}
            onClick={() => setActiveSection("brand")}
          >
            <Palette aria-hidden="true" size={19} />
            <span>Portada</span>
            <small>{siteContent.initials}</small>
          </button>
          <button
            type="button"
            className={activeSection === "promotions" ? "active" : ""}
            onClick={() => setActiveSection("promotions")}
          >
            <BadgePercent aria-hidden="true" size={19} />
            <span>Promos</span>
            <small>{menuStats.activeDiscounts}</small>
          </button>
        </nav>

        <section className="menu-admin-stats" aria-label="Resumen del menu">
          <article>
            <span>Productos</span>
            <strong>{menuStats.products}</strong>
          </article>
          <article>
            <span>Disponibles</span>
            <strong>{menuStats.availableProducts}</strong>
          </article>
          <article>
            <span>Categorias</span>
            <strong>{menuStats.categories}</strong>
          </article>
          <article>
            <span>Grupos extra</span>
            <strong>{menuStats.optionGroups}</strong>
          </article>
          <article>
            <span>Promos descuento</span>
            <strong>{menuStats.activeDiscounts}</strong>
          </article>
        </section>

        {activeSection === "promotions" && (
          <section className="menu-admin-section promotion-admin-section">
            <details className="admin-create-panel discount-create-panel" open>
              <summary>
                <span>
                  <Plus aria-hidden="true" size={18} />
                  Nueva regla de descuento
                </span>
                <ChevronDown aria-hidden="true" size={18} />
              </summary>
              <form className="discount-rule-form" onSubmit={createDiscountRule}>
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
                        setNewDiscountType(
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
                      step={newDiscountType === "PERCENTAGE" ? "0.01" : "0.01"}
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
                        setNewDiscountScope(
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
                <div className="empty-state">
                  No hay descuentos configurados.
                </div>
              ) : (
                <div className="discount-admin-list">
                  {discounts.map((discount) => (
                    <DiscountRuleEditor
                      key={discount.id}
                      discount={discount}
                      products={products}
                      categories={categories}
                      onSubmit={updateDiscountRule}
                      onDeactivate={deactivateDiscountRule}
                    />
                  ))}
                </div>
              )}
            </section>

            <form
              className="form-panel promotion-admin-form"
              onSubmit={savePromotionCampaign}
            >
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Campana visual</p>
                  <h2>Banner de portada</h2>
                </div>
                <BadgePercent aria-hidden="true" size={26} />
              </div>
              <div className="promotion-admin-grid">
                <div className="promotion-admin-preview">
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
                        updatePromotionDraft(
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
                        updatePromotionDraft(
                          "discountId",
                          event.currentTarget.value,
                        )
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
                        updatePromotionDraft(
                          "productSlug",
                          event.currentTarget.value,
                        )
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
                        updatePromotionDraft("badge", event.currentTarget.value)
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
                        updatePromotionDraft("title", event.currentTarget.value)
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
                        updatePromotionDraft(
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
                        updatePromotionDraft(
                          "startsOn",
                          event.currentTarget.value,
                        )
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
                        updatePromotionDraft("endsOn", event.currentTarget.value)
                      }
                    />
                  </label>
                  <label>
                    Texto del boton
                    <input
                      name="ctaLabel"
                      value={promotionCampaign.ctaLabel}
                      onChange={(event) =>
                        updatePromotionDraft(
                          "ctaLabel",
                          event.currentTarget.value,
                        )
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
        )}

        {activeSection === "brand" && (
          <form
            key={`${siteContent.name}-${siteContent.heroTitle}-${siteContent.heroImage}-${siteContent.instagramUrl}-${siteContent.whatsappPhone}-${siteContent.locationTitle}-${siteContent.businessAddress}-${siteContent.businessCity}-${siteContent.businessPostalCode}-${siteContent.googleMapsUrl}-${siteContent.aboutTitle}-${siteContent.aboutText}`}
            className="form-panel site-content-form"
            onSubmit={saveSiteContent}
          >
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
                <label>
                  Iniciales del logo
                  <input
                    name="initials"
                    defaultValue={siteContent.initials}
                    maxLength={8}
                    required
                  />
                </label>
                <label className="full-field">
                  Frase superior
                  <input
                    name="tagline"
                    defaultValue={siteContent.tagline}
                    required
                  />
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
                      (product) =>
                        product.slug === siteContent.featuredProductSlug,
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
        )}

        {activeSection === "categories" && (
          <section className="menu-admin-section category-manager-layout">
            <details className="admin-create-panel" open>
              <summary>
                <span>
                  <Plus aria-hidden="true" size={18} />
                  Nueva categoria
                </span>
                <ChevronDown aria-hidden="true" size={18} />
              </summary>
              <form className="category-create-form" onSubmit={createCategory}>
                <div className="form-grid compact-two">
                  <label>
                    Nombre
                    <input name="name" required />
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
              <div className="category-admin-list">
                {categories.map((category) => (
                  <form
                    key={category.id}
                    className={`category-row ${
                      category.active ? "" : "inactive"
                    }`}
                    onSubmit={(event) => updateCategory(category, event)}
                  >
                    <label>
                      Nombre
                      <input
                        name="name"
                        defaultValue={category.name}
                        required
                      />
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
                        onClick={() => toggleCategory(category)}
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
            </section>
          </section>
        )}

        {activeSection === "products" && (
          <section className="menu-admin-section">
            <div className="menu-admin-section-head">
              <div>
                <p className="eyebrow">Carta</p>
                <h2>Productos</h2>
              </div>
              <details className="admin-create-panel compact-create">
                <summary>
                  <span>
                    <Plus aria-hidden="true" size={18} />
                    Nuevo producto
                  </span>
                  <ChevronDown aria-hidden="true" size={18} />
                </summary>
                <form className="product-create-form" onSubmit={createProduct}>
                  <div className="form-grid">
                    <label>
                      Nombre
                      <input name="name" required />
                    </label>
                    <label>
                      Categoria
                      <select
                        name="categoryId"
                        required
                        disabled={activeCategories.length === 0}
                      >
                        {activeCategories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Precio
                      <input
                        name="price"
                        type="number"
                        step="0.01"
                        min="0.01"
                        required
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
                    <label className="full-field">
                      Imagen
                      <input
                        name="imageFile"
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                      />
                    </label>
                    <label className="full-field">
                      Descripcion
                      <textarea name="description" rows={3} required />
                    </label>
                  </div>
                  <button
                    className="button primary"
                    type="submit"
                    disabled={activeCategories.length === 0}
                  >
                    <Plus aria-hidden="true" size={18} />
                    Crear
                  </button>
                </form>
              </details>
            </div>

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
              <button
                type="button"
                className="button secondary"
                onClick={() => {
                  setProductSearch("");
                  setCategoryFilter("ALL");
                }}
              >
                <RotateCcw aria-hidden="true" size={18} />
                Limpiar
              </button>
            </section>

            <section className="admin-product-list">
              {productGroups.length === 0 ? (
                <div className="empty-state">Sin productos para mostrar.</div>
              ) : (
                productGroups.map((group) => (
                  <section className="admin-menu-category-group" key={group.id}>
                    <div className="admin-menu-category-head">
                      <h3>{group.name}</h3>
                      <span>
                        {group.products.length} producto
                        {group.products.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    {group.products.map((product) => {
                      const expanded = expandedProductId === product.id;
                      const optionGroupCount =
                        product.optionGroups?.length ?? 0;
                      const available =
                        product.active && product.available && group.active;

                      return (
                        <article
                          key={product.id}
                          className={`admin-product-row ${
                            available ? "" : "sold"
                          } ${expanded ? "expanded" : ""}`}
                        >
                          <div className="admin-product-summary">
                            <button
                              type="button"
                              className="icon-button availability-button"
                              onClick={() => toggleProduct(product)}
                              title={
                                product.available
                                  ? "Marcar agotado"
                                  : "Marcar disponible"
                              }
                            >
                              {product.available ? (
                                <ToggleRight aria-hidden="true" size={24} />
                              ) : (
                                <ToggleLeft aria-hidden="true" size={24} />
                              )}
                            </button>
                            <div className="admin-product-media">
                              <ProductImage product={product} />
                            </div>
                            <div className="admin-product-main">
                              <div>
                                <h3>{product.name}</h3>
                                <span>
                                  {product.category?.name ?? group.name}
                                </span>
                              </div>
                              <p>{product.description}</p>
                              <div className="admin-product-badges">
                                <span
                                  className={`status-pill ${
                                    available ? "" : "danger"
                                  }`}
                                >
                                  {product.active
                                    ? product.available
                                      ? "Disponible"
                                      : "Agotado"
                                    : "Oculto"}
                                </span>
                                <span className="admin-soft-pill">
                                  {optionGroupCount} grupos extra
                                </span>
                              </div>
                            </div>
                            <div className="admin-product-summary-actions">
                              <strong>{formatMoney(product.priceCents)}</strong>
                              <button
                                type="button"
                                className="button secondary"
                                onClick={() =>
                                  setExpandedProductId(
                                    expanded ? undefined : product.id,
                                  )
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
                          </div>

                          {expanded && (
                            <div className="admin-product-editor">
                              <form
                                className="admin-product-edit-form"
                                onSubmit={(event) =>
                                  updateProduct(product, event)
                                }
                              >
                                <div className="form-grid compact">
                                  <label>
                                    Nombre
                                    <input
                                      name="name"
                                      defaultValue={product.name}
                                      required
                                    />
                                  </label>
                                  <label>
                                    Categoria
                                    <select
                                      name="categoryId"
                                      defaultValue={product.categoryId}
                                    >
                                      {categoriesForProduct(product).map(
                                        (category) => (
                                          <option
                                            key={category.id}
                                            value={category.id}
                                          >
                                            {category.name}
                                            {!category.active
                                              ? " (oculta)"
                                              : ""}
                                          </option>
                                        ),
                                      )}
                                    </select>
                                  </label>
                                  <label>
                                    Precio
                                    <input
                                      name="price"
                                      type="number"
                                      step="0.01"
                                      min="0.01"
                                      defaultValue={product.priceCents / 100}
                                    />
                                  </label>
                                  <label>
                                    Orden
                                    <input
                                      name="sortOrder"
                                      type="number"
                                      min="0"
                                      defaultValue={product.sortOrder}
                                    />
                                  </label>
                                  <label className="full-field">
                                    Imagen
                                    <input
                                      name="imageFile"
                                      type="file"
                                      accept="image/png,image/jpeg,image/webp"
                                    />
                                    <input
                                      type="hidden"
                                      name="currentImageUrl"
                                      value={product.imageUrl ?? ""}
                                      readOnly
                                    />
                                  </label>
                                  <label className="full-field">
                                    Descripcion
                                    <textarea
                                      name="description"
                                      rows={2}
                                      defaultValue={product.description}
                                    />
                                  </label>
                                  <label className="checkbox-label">
                                    <input
                                      type="checkbox"
                                      name="active"
                                      defaultChecked={product.active}
                                    />
                                    Activo
                                  </label>
                                </div>
                                <div className="row-actions">
                                  <button
                                    className="icon-button primary"
                                    type="submit"
                                    title="Guardar"
                                  >
                                    <Save aria-hidden="true" size={18} />
                                  </button>
                                </div>
                              </form>

                              <section className="product-options-admin">
                                <div className="option-admin-title">
                                  <h3>Opciones y extras</h3>
                                  <span>{optionGroupCount} grupos</span>
                                </div>
                                <form
                                  className="option-group-create"
                                  onSubmit={(event) =>
                                    createOptionGroup(product, event)
                                  }
                                >
                                  <label>
                                    Grupo
                                    <input
                                      name="name"
                                      placeholder="Extras, punto de carne..."
                                      required
                                    />
                                  </label>
                                  <label>
                                    Min
                                    <input
                                      name="minChoices"
                                      type="number"
                                      min="0"
                                      defaultValue="0"
                                    />
                                  </label>
                                  <label>
                                    Max
                                    <input
                                      name="maxChoices"
                                      type="number"
                                      min="1"
                                      defaultValue="1"
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
                                  <label className="checkbox-label">
                                    <input type="checkbox" name="required" />
                                    Obligatorio
                                  </label>
                                  <button
                                    className="button secondary"
                                    type="submit"
                                  >
                                    <Plus aria-hidden="true" size={17} />
                                    Crear grupo
                                  </button>
                                </form>

                                {optionGroupCount === 0 ? (
                                  <p className="muted">
                                    Sin opciones configuradas.
                                  </p>
                                ) : (
                                  product.optionGroups?.map((group) => (
                                    <section
                                      key={group.id}
                                      className={`option-admin-group ${
                                        group.active ? "" : "inactive"
                                      }`}
                                    >
                                      <form
                                        className="option-group-edit"
                                        onSubmit={(event) =>
                                          updateOptionGroup(group, event)
                                        }
                                      >
                                        <label>
                                          Nombre
                                          <input
                                            name="name"
                                            defaultValue={group.name}
                                            required
                                          />
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
                                            <Save
                                              aria-hidden="true"
                                              size={17}
                                            />
                                          </button>
                                          <button
                                            type="button"
                                            className="icon-button secondary"
                                            onClick={() =>
                                              toggleOptionGroup(group)
                                            }
                                            title={
                                              group.active
                                                ? "Desactivar grupo"
                                                : "Reactivar grupo"
                                            }
                                          >
                                            {group.active ? (
                                              <Trash2
                                                aria-hidden="true"
                                                size={17}
                                              />
                                            ) : (
                                              <RotateCcw
                                                aria-hidden="true"
                                                size={17}
                                              />
                                            )}
                                          </button>
                                        </div>
                                      </form>

                                      <form
                                        className="option-choice-create"
                                        onSubmit={(event) =>
                                          createOptionChoice(group, event)
                                        }
                                      >
                                        <label>
                                          Opcion
                                          <input
                                            name="name"
                                            placeholder="Extra cheddar"
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
                                        <button
                                          className="button secondary"
                                          type="submit"
                                        >
                                          <Plus aria-hidden="true" size={17} />
                                          Anadir
                                        </button>
                                      </form>

                                      <div className="option-choice-list-admin">
                                        {group.choices.length === 0 ? (
                                          <p className="muted">
                                            Sin opciones dentro del grupo.
                                          </p>
                                        ) : (
                                          group.choices.map((choice) => (
                                            <form
                                              key={choice.id}
                                              className={`option-choice-row ${
                                                choice.active ? "" : "inactive"
                                              }`}
                                              onSubmit={(event) =>
                                                updateOptionChoice(
                                                  choice,
                                                  event,
                                                )
                                              }
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
                                                  defaultValue={
                                                    choice.priceCents / 100
                                                  }
                                                />
                                              </label>
                                              <label>
                                                Orden
                                                <input
                                                  name="sortOrder"
                                                  type="number"
                                                  min="0"
                                                  defaultValue={
                                                    choice.sortOrder
                                                  }
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
                                              <div className="row-actions inline-actions">
                                                <button
                                                  className="icon-button primary"
                                                  type="submit"
                                                  title="Guardar opcion"
                                                >
                                                  <Save
                                                    aria-hidden="true"
                                                    size={17}
                                                  />
                                                </button>
                                                <button
                                                  type="button"
                                                  className="icon-button secondary"
                                                  onClick={() =>
                                                    toggleOptionChoice(choice)
                                                  }
                                                  title={
                                                    choice.active
                                                      ? "Desactivar opcion"
                                                      : "Reactivar opcion"
                                                  }
                                                >
                                                  {choice.active ? (
                                                    <Trash2
                                                      aria-hidden="true"
                                                      size={17}
                                                    />
                                                  ) : (
                                                    <RotateCcw
                                                      aria-hidden="true"
                                                      size={17}
                                                    />
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
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </section>
                ))
              )}
            </section>
          </section>
        )}
      </section>
    </main>
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

      <form
        className="discount-rule-form"
        onSubmit={(event) => onSubmit(discount, event, scope, type)}
      >
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

function discountPayloadFromForm(
  form: FormData,
  scope: EditableDiscountScope,
  type: PromotionDiscountType,
): AdminDiscountPayload {
  const rawValue = Number(form.get("value") || 0);
  const productIds = form
    .getAll("productIds")
    .map((value) => String(value))
    .filter(Boolean);
  const categoryId = String(form.get("categoryId") || "");

  return {
    name: String(form.get("name") || ""),
    description: String(form.get("description") || ""),
    active: form.get("active") === "on",
    type,
    value: Math.round(rawValue * 100),
    scope,
    startsOn: String(form.get("startsOn") || ""),
    endsOn: String(form.get("endsOn") || ""),
    weekdays: form
      .getAll("weekdays")
      .map((value) => String(value) as DiscountWeekday),
    priority: Number(form.get("priority") || 0),
    ...(scope === "PRODUCTS" ? { productIds } : { categoryId }),
  };
}

function discountValueForForm(discount: AdminDiscount) {
  return trimMoneyNumber(discount.value / 100);
}

function formatDiscountValue(discount: AdminDiscount) {
  if (discount.type === "PERCENTAGE") {
    return `${trimMoneyNumber(discount.value / 100)}%`;
  }

  return formatMoney(discount.value);
}

function trimMoneyNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function discountScopeLabel(discount: AdminDiscount) {
  if (discount.scope === "CATEGORY") {
    return discount.category?.name ?? "Categoria";
  }

  if (discount.products.length === 0) {
    return "Sin productos";
  }

  if (discount.products.length === 1) {
    return discount.products[0]?.name ?? "Producto";
  }

  return `${discount.products.length} productos`;
}

function validityLabel(weekdays: DiscountWeekday[]) {
  if (weekdays.length === 0) {
    return "Todos los dias";
  }

  const labels = new Map(
    weekdayOptions.map((weekday) => [weekday.value, weekday.label]),
  );
  return weekdays.map((weekday) => labels.get(weekday) ?? weekday).join(", ");
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
