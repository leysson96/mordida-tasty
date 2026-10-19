const googleConsentDefaultsScript = `
  if (!window.location.pathname.startsWith('/admin')) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function gtag(){window.dataLayer.push(arguments);};
    window.gtag('consent', 'default', {
      analytics_storage: 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      wait_for_update: 500
    });
    window.gtag('set', 'ads_data_redaction', true);
    window.mordidaGoogleConsentInitialized = true;
  }
`;

export function GoogleConsentDefaults() {
  return (
    <script
      id="google-consent-defaults"
      dangerouslySetInnerHTML={{ __html: googleConsentDefaultsScript }}
    />
  );
}
