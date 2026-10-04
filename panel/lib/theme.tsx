'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type ThemePref = 'light' | 'dark' | 'system';
const STORAGE_KEY = 'signage_theme';

/** Inline script (runs before first paint) so the page never flashes the wrong theme. */
export const THEME_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem('${STORAGE_KEY}')||'system';var d=p==='dark'||(p==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d)}catch(e){}})()`;

const ThemeContext = createContext<{ pref: ThemePref; setPref: (p: ThemePref) => void }>({
  pref: 'system',
  setPref: () => undefined,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>('system');

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'light' || stored === 'dark' || stored === 'system') setPrefState(stored);
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

  const setPref = useCallback((p: ThemePref) => {
    setPrefState(p);
    try {
      localStorage.setItem(STORAGE_KEY, p);
    } catch {
      // ignore
    }
  }, []);

  return <ThemeContext.Provider value={{ pref, setPref }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
