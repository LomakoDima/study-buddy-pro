interface TelegramWebApp {
  initData: string;
  ready?: () => void;
  expand?: () => void;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
    TelegramWebviewProxy?: unknown;
  }
}

let sdkPromise: Promise<void> | null = null;

function hasTelegramLaunchParameter(): boolean {
  if (typeof window === "undefined") return false;
  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return search.has("tgWebAppVersion") || hash.has("tgWebAppVersion");
}

export function isTelegramMiniApp(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(
    window.Telegram?.WebApp?.initData ||
    window.TelegramWebviewProxy ||
    hasTelegramLaunchParameter(),
  );
}

function loadTelegramSdk(): Promise<void> {
  if (window.Telegram?.WebApp) return Promise.resolve();
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://telegram.org/js/telegram-web-app.js"]',
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Could not load the Telegram Mini App SDK")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-web-app.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load the Telegram Mini App SDK"));
    document.head.appendChild(script);
  }).catch((error) => {
    sdkPromise = null;
    throw error;
  });

  return sdkPromise;
}

export async function initializeTelegramMiniApp(): Promise<void> {
  if (!isTelegramMiniApp()) return;
  await loadTelegramSdk();
  window.Telegram?.WebApp?.ready?.();
  window.Telegram?.WebApp?.expand?.();
}

export function telegramInitData(): string {
  if (typeof window === "undefined") return "";
  return window.Telegram?.WebApp?.initData || "";
}
