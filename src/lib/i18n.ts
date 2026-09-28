import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "@/locales/en.json";
import fr from "@/locales/fr.json";

export const SUPPORTED_LANGUAGES = ["fr", "en"] as const;
const STORAGE_KEY = "monecole:lang";

function initialLanguage(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && (SUPPORTED_LANGUAGES as readonly string[]).includes(stored)) return stored;
  } catch {
    // Storage unavailable; fall back to the browser language.
  }
  return navigator.language?.toLowerCase().startsWith("en") ? "en" : "fr";
}

i18n.use(initReactI18next).init({
  resources: { fr: { translation: fr }, en: { translation: en } },
  lng: initialLanguage(),
  fallbackLng: "fr",
  interpolation: { escapeValue: false },
});

i18n.on("languageChanged", (lng) => {
  document.documentElement.lang = lng;
  try {
    localStorage.setItem(STORAGE_KEY, lng);
  } catch {
    // Ignore: the language still applies for this visit.
  }
});
document.documentElement.lang = i18n.language;

export default i18n;
