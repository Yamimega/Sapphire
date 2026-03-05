import en from "./en.json";
import zh from "./zh.json";
import ja from "./ja.json";

export const translations = { en, zh, ja } as const;

export type Locale = keyof typeof translations;
export type TranslationKey = keyof typeof en;
export const locales: Locale[] = ["en", "zh", "ja"];
export const defaultLocale: Locale = "en";
