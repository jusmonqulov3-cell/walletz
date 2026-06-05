"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

// Wraps the app with next-themes: class-based, system default, persisted.
export default function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
