import type { ReactNode } from "react";
import {
  BadgePercent,
  ListPlus,
  Package,
  Palette,
  Tags,
} from "lucide-react";

export type MenuAdminSection =
  | "products"
  | "categories"
  | "brand"
  | "promotions"
  | "extras";

export interface MenuAdminStats {
  products: number;
  availableProducts: number;
  categories: number;
  optionGroups: number;
  activeDiscounts: number;
}

interface MenuAdminShellProps {
  activeSection: MenuAdminSection;
  brandInitials: string;
  children: ReactNode;
  onSectionChange: (section: MenuAdminSection) => void;
  stats: MenuAdminStats;
}

const menuSections: Array<{
  id: MenuAdminSection;
  label: string;
  metric: (stats: MenuAdminStats, brandInitials: string) => number | string;
  icon: typeof Package;
}> = [
  {
    id: "products",
    label: "Productos",
    metric: (stats) => stats.products,
    icon: Package,
  },
  {
    id: "categories",
    label: "Categorias",
    metric: (stats) => stats.categories,
    icon: Tags,
  },
  {
    id: "brand",
    label: "Portada",
    metric: (_stats, brandInitials) => brandInitials,
    icon: Palette,
  },
  {
    id: "promotions",
    label: "Promos",
    metric: (stats) => stats.activeDiscounts,
    icon: BadgePercent,
  },
  {
    id: "extras",
    label: "Extras",
    metric: (stats) => stats.optionGroups,
    icon: ListPlus,
  },
];

export function MenuAdminShell({
  activeSection,
  brandInitials,
  children,
  onSectionChange,
  stats,
}: MenuAdminShellProps) {
  return (
    <section className="menu-admin-workspace">
      <div className="menu-admin-ops-panel">
        <nav className="menu-admin-tabs" aria-label="Secciones del menu">
          {menuSections.map((section) => {
            const Icon = section.icon;
            const active = activeSection === section.id;

            return (
              <button
                key={section.id}
                type="button"
                className={active ? "active" : ""}
                aria-current={active ? "page" : undefined}
                onClick={() => onSectionChange(section.id)}
              >
                <Icon aria-hidden="true" size={19} />
                <span>{section.label}</span>
                <small>{section.metric(stats, brandInitials)}</small>
              </button>
            );
          })}
        </nav>

        <section className="menu-admin-stats" aria-label="Resumen del menu">
          <article>
            <span>Productos</span>
            <strong>{stats.products}</strong>
          </article>
          <article>
            <span>Disponibles</span>
            <strong>{stats.availableProducts}</strong>
          </article>
          <article>
            <span>Categorias</span>
            <strong>{stats.categories}</strong>
          </article>
          <article>
            <span>Grupos extra</span>
            <strong>{stats.optionGroups}</strong>
          </article>
          <article>
            <span>Promos descuento</span>
            <strong>{stats.activeDiscounts}</strong>
          </article>
        </section>
      </div>

      {children}
    </section>
  );
}
