'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  ChefHat,
  ClipboardList,
  LogOut,
  Menu,
  ShoppingBag,
  Truck,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { api } from '../lib/api';
import { logoutAdmin } from './admin-auth';
import { brandConfig } from '../lib/brand';
import type { PublicSettings, SiteContent } from '../lib/types';
import { BrandMark } from './brand-mark';
import { useCart } from './cart-provider';

const adminLinks = [
  { href: '/admin', label: 'Pedidos', Icon: ClipboardList },
  { href: '/admin/menu', label: 'Menu', Icon: Menu },
  { href: '/admin/reportes', label: 'Reportes', Icon: BarChart3 },
  { href: '/admin/reparto', label: 'Reparto', Icon: Truck },
  { href: '/admin/staff', label: 'Staff', Icon: UsersRound },
  { href: '/admin/cocina', label: 'Cocina', Icon: ChefHat },
] as const;

export function SiteHeader() {
  const { totalItems } = useCart();
  const pathname = usePathname();
  const [siteContent, setSiteContent] = useState<SiteContent>(brandConfig);
  const isAdminRoute = pathname?.startsWith('/admin') ?? false;

  useEffect(() => {
    let mounted = true;

    api<PublicSettings>('/settings/public')
      .then((settings) => {
        if (mounted) {
          setSiteContent({ ...brandConfig, ...settings.siteContent });
        }
      })
      .catch(() => undefined);

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty('--runtime-font-sans', siteContent.fontFamily);
  }, [siteContent.fontFamily]);

  async function logout() {
    try {
      await logoutAdmin();
    } finally {
      window.location.href = '/admin/login';
    }
  }

  return (
    <header className={`site-header ${isAdminRoute ? 'admin-mode' : ''}`}>
      <Link href="/" className="brand" aria-label={siteContent.name}>
        <BrandMark content={siteContent} />
      </Link>
      <nav className="main-nav" aria-label={isAdminRoute ? 'Admin' : 'Principal'}>
        {isAdminRoute ? (
          <>
            {adminLinks.map(({ href, label, Icon }) => {
              const active = isAdminLinkActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={active ? 'active' : undefined}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon aria-hidden="true" size={18} />
                  {label}
                </Link>
              );
            })}
          </>
        ) : (
          <>
            <Link href="/">
              <Menu aria-hidden="true" size={18} />
              Menu
            </Link>
            <Link href="/carrito">
              <ClipboardList aria-hidden="true" size={18} />
              Pedido
            </Link>
            <Link href="/cuenta">
              <UserRound aria-hidden="true" size={18} />
              Cuenta
            </Link>
          </>
        )}
      </nav>
      {isAdminRoute ? (
        <button
          type="button"
          className="admin-header-link"
          onClick={logout}
          aria-label="Salir del panel"
        >
          <LogOut aria-hidden="true" size={20} />
          <span>Salir</span>
        </button>
      ) : (
        <Link href="/carrito" className="cart-link" aria-label={`Carrito con ${totalItems} productos`}>
          <ShoppingBag aria-hidden="true" size={20} />
          <span>{totalItems}</span>
        </Link>
      )}
    </header>
  );
}

function isAdminLinkActive(pathname: string | null, href: string) {
  const currentPath = pathname ?? '';
  return href === '/admin'
    ? currentPath === href
    : currentPath === href || currentPath.startsWith(`${href}/`);
}
