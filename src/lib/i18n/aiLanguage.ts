import "server-only";
import { getLocale } from "./server";
import type { Locale } from "./dictionaries";

// A strong language directive for the AI prose endpoints (chat, coach, goal
// advice), derived from the user's selected locale. Prepended to the system
// prompt so replies follow the language the user picked in the app.
const DIRECTIVES: Record<Locale, string> = {
  uz: "IMPORTANT: Respond ONLY in Uzbek (O'zbek tili). Format every amount with a space thousands separator and the suffix \" so'm\" (e.g. 1 200 000 so'm).",
  ru: "IMPORTANT: Respond ONLY in Russian (Русский язык). Format every amount with a space thousands separator and the suffix \" сум\" (e.g. 1 200 000 сум).",
  en: "IMPORTANT: Respond ONLY in English. Format every amount with a space thousands separator and the suffix \" so'm\" (e.g. 1 200 000 so'm).",
};

export async function aiLanguageInstruction(): Promise<string> {
  return DIRECTIVES[await getLocale()];
}
