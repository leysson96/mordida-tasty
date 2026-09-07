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
const tagManagerIdPattern = /^GTM-[A-Z0-9]+$/i;

export function GoogleAnalytics() {
  const pathname = usePathname();
  const [analyticsAllowed, setAnalyticsAllowed] = useState(false);
  const [scriptReady, setScriptReady] = useState(false);
  const tagManagerId = useMemo(() => {
    const value = (process.env.NEXT_PUBLIC_GTM_ID ?? "").trim();
    return tagManagerIdPattern.test(value) ? value.toUpperCase() : "";
  }, []);
  const measurementId = useMemo(() => {
    const value = (process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "").trim();
    return !tagManagerId && measurementIdPattern.test(value)
      ? value.toUpperCase()
      : "";
  }, [tagManagerId]);
  const isAdminRoute = pathname?.startsWith("/admin") ?? false;
  const trackingId = tagManagerId || measurementId;

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
    if (!analyticsAllowed || !trackingId || isAdminRoute || !scriptReady) {
      return;
    }

    const pageView = {
      page_path: pathname ?? "/",
      page_title: document.title,
    };

    if (tagManagerId) {
      window.dataLayer?.push({ event: "page_view", ...pageView });
      return;
    }

    window.gtag?.("event", "page_view", pageView);
  }, [
    analyticsAllowed,
    isAdminRoute,
    pathname,
    scriptReady,
    tagManagerId,
    trackingId,
  ]);

  if (!analyticsAllowed || !trackingId || isAdminRoute) {
    return null;
  }

  if (tagManagerId) {
    return (
      <>
        <Script
          id="google-tag-manager"
          strategy="afterInteractive"
          onReady={() => setScriptReady(true)}
        >
          {`
            (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
            'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer','${tagManagerId}');
          `}
        </Script>
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${tagManagerId}`}
            height={0}
            width={0}
            style={{ display: "none", visibility: "hidden" }}
            title="Google Tag Manager"
          />
        </noscript>
      </>
    );
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
