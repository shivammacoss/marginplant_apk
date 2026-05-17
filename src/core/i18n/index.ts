import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { getLocales } from "expo-localization";
import en from "./locales/en";
import hi from "./locales/hi";

const lang = getLocales()[0]?.languageCode ?? "en";

// Hermes (RN's JS engine) doesn't ship the full Intl.PluralRules table, so
// i18next's v4 plural resolver warns on init. v3 uses a hard-coded plural
// map for each language that works without Intl — same behaviour for our
// en/hi locales, zero warning, zero polyfill weight.
void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, hi: { translation: hi } },
  lng: lang.startsWith("hi") ? "hi" : "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  compatibilityJSON: "v3",
});

export { i18n };
