"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  cookieConsentChangedEvent,
  cookieConsentStorageKey,
  hasAnalyticsConsent,
} from "../lib/cookie-consent";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const measurementIdPattern = /^G-[A-Z0-9]+$/i;

export function GoogleAnalytics() {
  const pathname = usePathname();
  const [analyticsAllowed, setAnalyticsAllowed] = useState(false);
  const [scriptReady, setScriptReady] = useState(false);
  const measurementId = useMemo(() => {
    const value = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "";
    return measurementIdPattern.test(value) ? value : "";
  }, []);
  const isAdminRoute = pathname?.startsWith("/admin") ?? false;

  useEffect(() => {
    function refreshConsent() {
      setAnalyticsAllowed(
        hasAnalyticsConsent(
          window.localStorage.getItem(cookieConsentStorageKey),
        ),
      );
    }

    refreshConsent();
    window.addEventListener(cookieConsentChangedEvent, refreshConsent);
    window.addEventListener("storage", refreshConsent);

    return () => {
      window.removeEventListener(cookieConsentChangedEvent, refreshConsent);
      window.removeEventListener("storage", refreshConsent);
    };
  }, []);

  useEffect(() => {
    if (!analyticsAllowed || !measurementId || isAdminRoute || !scriptReady) {
      return;
    }

    window.gtag?.("event", "page_view", {
      page_path: pathname ?? "/",
      page_title: document.title,
    });
  }, [analyticsAllowed, isAdminRoute, measurementId, pathname, scriptReady]);

  if (!analyticsAllowed || !measurementId || isAdminRoute) {
    return null;
  }

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      <Script
        id="google-analytics"
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
      >
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){window.dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${measurementId}', {
            anonymize_ip: true,
            send_page_view: false
          });
        `}
      </Script>
    </>
  );
}
