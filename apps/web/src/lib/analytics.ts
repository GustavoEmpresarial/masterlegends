declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

let initialized = false;
let measurementId: string | null = null;

function ensureDataLayer(): void {
  window.dataLayer = window.dataLayer ?? [];
  window.gtag =
    window.gtag ??
    function gtag(...args: unknown[]) {
      window.dataLayer!.push(args);
    };
}

export function initGA(id: string): void {
  if (initialized || !id) return;
  measurementId = id;
  ensureDataLayer();

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  document.head.appendChild(script);

  window.gtag!('js', new Date());
  window.gtag!('config', id, {
    anonymize_ip: true,
    send_page_view: false,
  });

  initialized = true;
}

export function trackPageView(path: string): void {
  if (!initialized || !measurementId || !window.gtag) return;
  window.gtag('config', measurementId, {
    page_path: path,
    anonymize_ip: true,
  });
}

export function isGAInitialized(): boolean {
  return initialized;
}
