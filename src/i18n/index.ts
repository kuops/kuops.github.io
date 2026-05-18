import type { UIStrings } from "./types";
import en from "./lang/en";

const langModules = import.meta.glob<{ default: UIStrings }>("./lang/*.ts", {
  eager: true,
});

const translations: Record<string, UIStrings> = {};

for (const [path, module] of Object.entries(langModules)) {
  const locale = path.match(/\.\/lang\/(.+)\.ts$/)?.[1] ?? "";
  translations[locale] = module.default;
}

export function useTranslations(locale: string): UIStrings {
  return translations[locale] ?? translations["en"] ?? en;
}

export { tplStr } from "./format";
export type { UIStrings } from "./types";
