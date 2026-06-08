"use client";

import { useEffect } from "react";
import { getWebApp, inTelegram } from "@/lib/telegram/webapp";

// When running inside Telegram, tells the WebApp we're ready, expands to full
// height, and matches the in-app chrome to our surface. No-op in a browser.
export default function TelegramInit() {
  useEffect(() => {
    if (!inTelegram()) return;
    const wa = getWebApp();
    if (!wa) return;

    try {
      wa.ready();
      wa.expand();
      wa.setHeaderColor?.("secondary_bg_color");
      wa.disableVerticalSwipes?.();
    } catch {
      // Older Telegram clients may lack some methods — ignore.
    }
  }, []);

  return null;
}
