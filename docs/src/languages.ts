import { KNOWN_LANGUAGE_CODES, KNOWN_LANGUAGES } from "./consts";

export { KNOWN_LANGUAGE_CODES, KNOWN_LANGUAGES };

export const langPathRegex = /\/([a-z]{2}-?[A-Z]{0,2})\//;

export function getLanguageFromURL(pathname: string) {
  const langCodeMatch = pathname.match(langPathRegex);
  const langCode = langCodeMatch?.[1] ?? "en";
  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- validated by regex, defaults to "en"
  return langCode as (typeof KNOWN_LANGUAGE_CODES)[number];
}
