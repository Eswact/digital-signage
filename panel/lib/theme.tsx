'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { DEFAULT_PALETTE, PALETTES, PaletteId } from '@/lib/brand';

export type ThemePref = 'light' | 'dark' | 'system';
const STORAGE_KEY = 'signage_theme';
const PALETTE_KEY = 'signage_palette';
const PALETTE_IDS = PALETTES.map((p) => p.id);

/** Inline script (runs before first paint) so the page never flashes the wrong theme or color theme. */
export const THEME_INIT_SCRIPT = `(function(){try{var e=document.documentElement;var p=localStorage.getItem('${STORAGE_KEY}')||'system';var d=p==='dark'||(p==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);e.classList.toggle('dark',d);var c=localStorage.getItem('${PALETTE_KEY}');if(${JSON.stringify(PALETTE_IDS.filter((id) => id !== DEFAULT_PALETTE))}.indexOf(c)>=0)e.setAttribute('data-palette',c)}catch(x){}})()`;

const ThemeContext = createContext<{
  pref: ThemePref;
  setPref: (p: ThemePref) => void;
  palette: PaletteId;
  setPalette: (p: PaletteId) => void;
}>({
  pref: 'system',
  setPref: () => undefined,
  palette: DEFAULT_PALETTE,
  setPalette: () => undefined,
});

const isPalette = (v: string | null): v is PaletteId => PALETTE_IDS.includes(v as PaletteId);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>('system');
  const [palette, setPaletteState] = useState<PaletteId>(DEFAULT_PALETTE);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'light' || stored === 'dark' || stored === 'system') setPrefState(stored);
      const storedPalette = localStorage.getItem(PALETTE_KEY);
      if (isPalette(storedPalette)) setPaletteState(storedPalette);
    } catch {
      // ignore
    }
  }, []);

  // Follow the OS while the preference is "system".
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const apply = () =>
      document.documentElement.classList.toggle('dark', pref === 'dark' || (pref === 'system' && mq.matches));
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [pref]);

  // The default theme lives on :root, the others under [data-palette] (app/palettes.css).
  useEffect(() => {
    const el = document.documentElement;
    if (palette === DEFAULT_PALETTE) el.removeAttribute('data-palette');
    else el.setAttribute('data-palette', palette);
  }, [palette]);

  const setPref = useCallback((p: ThemePref) => {
    setPrefState(p);
    try {
      localStorage.setItem(STORAGE_KEY, p);
    } catch {
      // ignore
    }
  }, []);

  const setPalette = useCallback((p: PaletteId) => {
    setPaletteState(p);
    try {
      localStorage.setItem(PALETTE_KEY, p);
    } catch {
      // ignore
    }
  }, []);

  return <ThemeContext.Provider value={{ pref, setPref, palette, setPalette }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
