'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ClipboardList, Menu, ShoppingBag, UserRound } from 'lucide-react';
import { api } from '../lib/api';
import { brandConfig } from '../lib/brand';
import type { PublicSettings, SiteContent } from '../lib/types';
import { BrandMark } from './brand-mark';
import { useCart } from './cart-provider';

export function SiteHeader() {
  const { totalItems } = useCart();
  const [siteContent, setSiteContent] = useState<SiteContent>(brandConfig);

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

  return (
    <header className="site-header">
      <Link href="/" className="brand" aria-label={siteContent.name}>
        <BrandMark content={siteContent} />
      </Link>
      <nav className="main-nav" aria-label="Principal">
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
      </nav>
      <Link href="/carrito" className="cart-link" aria-label={`Carrito con ${totalItems} productos`}>
        <ShoppingBag aria-hidden="true" size={20} />
        <span>{totalItems}</span>
      </Link>
    </header>
  );
}
