"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import {
  readableErrorMessage,
  redirectOnAdminAuthError,
} from "../lib/admin-errors";
import { brandConfig } from "../lib/brand";
import {
  AdminDiscount,
  AdminProduct,
  Category,
  ProductOptionChoice,
  ProductOptionGroup,
  PromotionCampaign,
  PromotionDiscountType,
  SiteContent,
  UploadedImage,
} from "../lib/types";
import {
  discountPayloadFromForm,
} from "./admin-menu/menu-admin-utils";
import { BrandSection } from "./admin-menu/brand-section";
import { CategoriesSection } from "./admin-menu/categories-section";
import { ExtrasSection } from "./admin-menu/extras-section";
import {
  MenuAdminSection,
  MenuAdminShell,
} from "./admin-menu/menu-admin-shell";
import { ProductsSection } from "./admin-menu/products-section";
import {
  AdminSettingsResponse,
  defaultPromotionCampaign,
  EditableDiscountScope,
} from "./admin-menu/types";
import { PromotionsSection } from "./admin-menu/promotions-section";

export function AdminMenuClient() {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [discounts, setDiscounts] = useState<AdminDiscount[]>([]);
  const [siteContent, setSiteContent] = useState<SiteContent>(brandConfig);
  const [promotionCampaign, setPromotionCampaign] =
    useState<PromotionCampaign>(defaultPromotionCampaign);
  const [activeSection, setActiveSection] =
    useState<MenuAdminSection>("products");
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
      const enabled = form.get("enabled") === "on";

      if (promotionCampaign.enabled && !enabled) {
        const confirmed = window.confirm(
          "Desactivar la promocion de portada? Dejara de mostrarse en la carta publica.",
        );
        if (!confirmed) {
          return;
        }
      }

      const updated = await api<PromotionCampaign>(
        "/admin/settings/promotion",
        {
          method: "PATCH",
          body: JSON.stringify({
            enabled,
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

      <MenuAdminShell
        activeSection={activeSection}
        brandInitials={siteContent.initials}
        onSectionChange={setActiveSection}
        stats={menuStats}
      >
        {activeSection === "promotions" && (
          <PromotionsSection
            activeCategories={activeCategories}
            categories={categories}
            discounts={discounts}
            newDiscountScope={newDiscountScope}
            newDiscountType={newDiscountType}
            products={products}
            promotionCampaign={promotionCampaign}
            selectedPromotionProduct={selectedPromotionProduct}
            onCreateDiscountRule={createDiscountRule}
            onDeactivateDiscountRule={deactivateDiscountRule}
            onNewDiscountScopeChange={setNewDiscountScope}
            onNewDiscountTypeChange={setNewDiscountType}
            onPromotionDraftChange={updatePromotionDraft}
            onSavePromotionCampaign={savePromotionCampaign}
            onUpdateDiscountRule={updateDiscountRule}
          />
        )}

        {activeSection === "brand" && (
          <BrandSection
            key={`${siteContent.name}-${siteContent.heroTitle}-${siteContent.heroImage}-${siteContent.instagramUrl}-${siteContent.whatsappPhone}-${siteContent.locationTitle}-${siteContent.businessAddress}-${siteContent.businessCity}-${siteContent.businessPostalCode}-${siteContent.googleMapsUrl}-${siteContent.aboutTitle}-${siteContent.aboutText}`}
            products={products}
            siteContent={siteContent}
            onSubmit={saveSiteContent}
          />
        )}

        {activeSection === "categories" && (
          <CategoriesSection
            categories={categories}
            onCreateCategory={createCategory}
            onToggleCategory={toggleCategory}
            onUpdateCategory={updateCategory}
          />
        )}

        {activeSection === "products" && (
          <ProductsSection
            activeCategories={activeCategories}
            categories={categories}
            categoriesForProduct={categoriesForProduct}
            discounts={discounts}
            expandedProductId={expandedProductId}
            onCreateProduct={createProduct}
            onExpandedProductChange={setExpandedProductId}
            onToggleProduct={toggleProduct}
            onUpdateProduct={updateProduct}
            products={products}
          />
        )}
        {activeSection === "extras" && (
          <ExtrasSection
            products={products}
            onCreateOptionChoice={createOptionChoice}
            onCreateOptionGroup={createOptionGroup}
            onToggleOptionChoice={toggleOptionChoice}
            onToggleOptionGroup={toggleOptionGroup}
            onUpdateOptionChoice={updateOptionChoice}
            onUpdateOptionGroup={updateOptionGroup}
          />
        )}
      </MenuAdminShell>
    </main>
  );
}
