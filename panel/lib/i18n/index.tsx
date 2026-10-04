'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { tr } from './tr';

/**
 * Lightweight i18n. English is the source language: the English sentence IS the
 * key (`t('Add device')`), other languages map it to their text. A missing
 * translation falls back to the English key, so a string is never blank.
 * `npm run i18n:check` lists keys that the Turkish dictionary does not cover yet.
 */
export type Lang = 'en' | 'tr';
export const LANGUAGES: { id: Lang; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'tr', label: 'Türkçe' },
];

type Vars = Record<string, string | number>;
export type TFunction = (key: string, vars?: Vars) => string;

const DICTIONARIES: Record<Lang, Record<string, string>> = { en: {}, tr };
const STORAGE_KEY = 'signage_lang';

/** Marks a string for extraction without translating it yet (module-level constants). */
export const msg = (s: string) => s;

export function translate(lang: Lang, key: string, vars?: Vars): string {
  let text = DICTIONARIES[lang][key] ?? key;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.split(`{${name}}`).join(String(value));
    }
  }
  return text;
}

interface I18nValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: TFunction;
  /** BCP-47 tag for Intl formatting. */
  locale: string;
}

const I18nContext = createContext<I18nValue>({
  lang: 'en',
  setLang: () => undefined,
  t: (key, vars) => translate('en', key, vars),
  locale: 'en',
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');

  // Stored choice, else the browser language. (Runs after hydration, so SSR markup stays English.)
  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch {
      // storage unavailable → detect only
    }
    const detected: Lang = navigator.language?.toLowerCase().startsWith('tr') ? 'tr' : 'en';
    setLangState(stored === 'en' || stored === 'tr' ? stored : detected);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo<I18nValue>(
    () => ({
      lang,
      setLang,
      t: (key, vars) => translate(lang, key, vars),
      locale: lang === 'tr' ? 'tr-TR' : 'en-GB',
    }),
    [lang, setLang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
export const useT = () => useContext(I18nContext).t;
