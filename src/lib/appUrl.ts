import "server-only";

// Absolute, HTTPS base URL of the deployed app. Mini App entry points
// (menu button, in-message web_app buttons) require an absolute URL.
// Prefers an explicit env, then Vercel's production domain.
export function appUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL;
  if (explicit) return explicit.replace(/\/+$/, "");

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;

  return "http://localhost:3000";
}
