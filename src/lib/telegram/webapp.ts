// Client-side helpers around window.Telegram.WebApp (injected by the SDK script
// loaded in the root layout). Safe to import anywhere — every accessor guards
// for the script being absent (i.e. running in a normal browser).

export type TelegramWebApp = {
  initData: string;
  initDataUnsafe?: {
    user?: { id: number; username?: string; first_name?: string };
  };
  colorScheme?: "light" | "dark";
  ready: () => void;
  expand: () => void;
  setHeaderColor?: (color: string) => void;
  disableVerticalSwipes?: () => void;
  onEvent?: (event: string, handler: () => void) => void;
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

export function getWebApp(): TelegramWebApp | null {
  if (typeof window === "undefined") return null;
  return window.Telegram?.WebApp ?? null;
}

// True only when launched as a Mini App (signed initData is present).
export function inTelegram(): boolean {
  const wa = getWebApp();
  return !!wa && typeof wa.initData === "string" && wa.initData.length > 0;
}
