'use client';

import { Brand } from '@/components/Shell';
import { PromoPanel } from '@/components/auth/PromoPanel';
import { LANGUAGES, msg, useI18n } from '@/lib/i18n';
import { useTheme, ThemePref } from '@/lib/theme';
import { useT } from '@/lib/i18n';

/** Sign-in family of pages: form column (35 %) + a promo column (65 %, hidden on phones). */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = useT();
  const { lang, setLang } = useI18n();
  const { pref, setPref } = useTheme();
  const next: Record<ThemePref, ThemePref> = { system: 'light', light: 'dark', dark: 'system' };

  return (
    <div className="flex min-h-dvh">
      <div className="flex w-full flex-col bg-paper lg:w-[35%] lg:min-w-[26rem] lg:max-w-[34rem] lg:flex-none">
        <div className="flex flex-1 flex-col justify-center px-6 py-10 sm:px-12 lg:px-14">
          <Brand className="mb-12" />
          {children}
        </div>
        <div className="flex items-center justify-between border-t border-line px-6 py-4 text-xs text-ink-3 sm:px-12 lg:px-14">
          <button type="button" className="hover:text-ink" onClick={() => setPref(next[pref])}>
            {t('Theme')}: {t(pref === 'system' ? msg('System') : pref === 'light' ? msg('Light') : msg('Dark'))}
          </button>
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as typeof lang)}
            aria-label={t('Language')}
            className="bg-transparent text-xs text-ink-2 hover:text-ink"
          >
            {LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <PromoPanel />
    </div>
  );
}
