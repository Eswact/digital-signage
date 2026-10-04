'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { IconType } from 'react-icons';
import { logout, switchOrganization } from '@/lib/api';
import { useRole } from '@/lib/session';
import { useLive } from '@/lib/live';
import { LANGUAGES, useI18n, useT, msg } from '@/lib/i18n';
import { ThemePref, useTheme } from '@/lib/theme';
import { cn } from '@/lib/cn';
import { Dialog } from '@/components/ui/Dialog';
import { useToast, errorMessage } from '@/components/ui/Toast';
import {
  IconAdmin,
  IconChevronDown,
  IconDevice,
  IconGroup,
  IconLogout,
  IconMedia,
  IconMoon,
  IconMore,
  IconOrg,
  IconPlan,
  IconSchedule,
  IconScreen,
  IconSettings,
  IconSun,
  IconSystem,
  IconUser,
  IconUsers,
  IconCheck,
} from '@/components/ui/icons';

interface NavItem {
  href: string;
  label: string;
  icon: IconType;
}

const MANAGE: NavItem[] = [
  { href: '/devices', label: msg('Devices'), icon: IconDevice },
  { href: '/screens', label: msg('Screens'), icon: IconScreen },
  { href: '/media', label: msg('Media'), icon: IconMedia },
  { href: '/schedules', label: msg('Schedules'), icon: IconSchedule },
  { href: '/groups', label: msg('Groups'), icon: IconGroup },
];
const ORGANIZATION: NavItem[] = [
  { href: '/team', label: msg('Team'), icon: IconUsers },
  { href: '/plan', label: msg('Plan & usage'), icon: IconPlan },
];
const PLATFORM: NavItem[] = [
  { href: '/admin/users', label: msg('Users'), icon: IconUser },
  { href: '/admin/organizations', label: msg('Organizations'), icon: IconOrg },
  { href: '/admin/settings', label: msg('Settings'), icon: IconSettings },
];
/** Shown in the phone bottom bar; everything else lives under "More". */
const BOTTOM: NavItem[] = MANAGE.slice(0, 4);

export function Brand({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <span className="grid h-6 w-6 grid-cols-2 gap-px">
        <span className="bg-ink" />
        <span className="bg-accent" />
        <span className="bg-accent" />
        <span className="bg-ink" />
      </span>
      <span className="text-[15px] font-semibold tracking-tightest">Signage</span>
    </div>
  );
}

function useActive() {
  const pathname = usePathname();
  return (href: string) => pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const t = useT();
  const active = useActive()(item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative flex h-9 items-center gap-3 rounded px-3 text-sm transition-colors',
        active ? 'bg-sunken font-medium text-ink' : 'text-ink-2 hover:bg-sunken hover:text-ink',
      )}
    >
      {active && <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-accent" />}
      <Icon className={cn('h-[18px] w-[18px]', active ? 'text-accent' : 'text-ink-3')} />
      {t(item.label)}
    </Link>
  );
}

function NavGroup({ title, items, onNavigate }: { title: string; items: NavItem[]; onNavigate?: () => void }) {
  const t = useT();
  return (
    <div>
      <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">{t(title)}</p>
      <div className="space-y-0.5">
        {items.map((item) => (
          <NavLink key={item.href} item={item} onNavigate={onNavigate} />
        ))}
      </div>
    </div>
  );
}

/** Current organization; a menu to switch when the user belongs to several. */
function OrgSwitcher({ onSwitched }: { onSwitched?: () => void }) {
  const t = useT();
  const { session } = useRole();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  if (!session?.organization) return null;
  const orgs = session.organizations;
  const multiple = orgs.length > 1;

  async function choose(id: string) {
    setOpen(false);
    if (id === session!.organization!.id) return;
    try {
      await switchOrganization(id);
      qc.clear();
      router.push('/devices');
      onSwitched?.();
    } catch (err) {
      toast(errorMessage(err, t('Could not switch organization')), 'error');
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={!multiple}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex w-full items-center gap-2 rounded border border-line bg-surface px-3 py-2 text-left',
          multiple && 'hover:border-line-strong',
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-3">{t('Organization')}</span>
          <span className="block truncate text-sm font-medium">{session.organization.name}</span>
        </span>
        {multiple && <IconChevronDown className="h-4 w-4 flex-shrink-0 text-ink-3" />}
      </button>
      {open && (
        <ul className="absolute inset-x-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded border border-line-strong bg-surface py-1 shadow-lg animate-fade-in">
          {orgs.map((o) => (
            <li key={o.organizationId}>
              <button
                type="button"
                onClick={() => choose(o.organizationId)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-sunken"
              >
                <span className="min-w-0 truncate">{o.organizationName}</span>
                {o.organizationId === session.organization!.id && <IconCheck className="h-4 w-4 text-accent" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const THEMES: { id: ThemePref; icon: IconType; label: string }[] = [
  { id: 'light', icon: IconSun, label: msg('Light') },
  { id: 'system', icon: IconSystem, label: msg('System') },
  { id: 'dark', icon: IconMoon, label: msg('Dark') },
];

function Preferences() {
  const t = useT();
  const { pref, setPref } = useTheme();
  const { lang, setLang } = useI18n();
  return (
    <div className="flex items-center gap-2">
      <div className="inline-flex rounded border border-line-strong bg-sunken p-0.5">
        {THEMES.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            type="button"
            aria-label={t(label)}
            title={t(label)}
            aria-pressed={pref === id}
            onClick={() => setPref(id)}
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-[2px]',
              pref === id ? 'bg-surface text-ink shadow-sm' : 'text-ink-3 hover:text-ink',
            )}
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
      </div>
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value as typeof lang)}
        aria-label={t('Language')}
        className="h-8 flex-1 rounded border border-line-strong bg-surface px-2 text-xs text-ink"
      >
        {LANGUAGES.map((l) => (
          <option key={l.id} value={l.id}>
            {l.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function AccountBlock() {
  const t = useT();
  const router = useRouter();
  const qc = useQueryClient();
  const { session } = useRole();
  const live = useLive();
  if (!session) return null;
  return (
    <div className="space-y-3 border-t border-line p-3">
      <Preferences />
      <Link
        href="/account"
        className="flex items-center gap-2.5 rounded px-2 py-1.5 hover:bg-sunken"
      >
        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-ink text-xs font-semibold uppercase text-paper">
          {(session.user.name || session.user.email).slice(0, 2)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium">{session.user.name || session.user.email}</span>
          <span className="flex items-center gap-1.5 text-[11px] text-ink-3">
            <span className={cn('h-1.5 w-1.5 rounded-full', live.connected ? 'bg-success' : 'bg-line-strong')} />
            {live.connected ? t('Live') : t('Offline updates')}
          </span>
        </span>
      </Link>
      <button
        type="button"
        onClick={async () => {
          await logout();
          qc.clear();
          router.replace('/login');
        }}
        className="flex h-9 w-full items-center gap-3 rounded px-3 text-sm text-ink-2 hover:bg-sunken hover:text-ink"
      >
        <IconLogout className="h-[18px] w-[18px] text-ink-3" /> {t('Sign out')}
      </button>
    </div>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const t = useT();
  const pathname = usePathname();
  const active = useActive();
  const { isSuperadmin } = useRole();
  const [more, setMore] = useState(false);
  // Editors need the width; everything else reads better in a narrower column.
  const wide = /^\/screens\/[^/]+$/.test(pathname);

  useEffect(() => setMore(false), [pathname]);

  const moreActive =
    [...ORGANIZATION, ...PLATFORM, { href: '/account' }, { href: '/groups' }].some((i) => active(i.href));

  return (
    <div className="min-h-dvh lg:flex">
      {/* Sidebar (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r border-line bg-paper lg:flex">
        <div className="space-y-4 p-4">
          <Brand />
          <OrgSwitcher />
        </div>
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-2">
          <NavGroup title={msg('Manage')} items={MANAGE} />
          <NavGroup title={msg('Organization')} items={ORGANIZATION} />
          {isSuperadmin && <NavGroup title={msg('Platform')} items={PLATFORM} />}
        </nav>
        <AccountBlock />
      </aside>

      {/* Top bar (phone / tablet) */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-line bg-paper/90 px-4 backdrop-blur lg:hidden">
        <Brand />
        <OrgBadge />
      </header>

      <main className="min-w-0 flex-1 pb-24 lg:ml-60 lg:pb-0">
        <div className={cn('mx-auto w-full px-4 py-6 sm:px-6 lg:px-10 lg:py-10', wide ? 'max-w-[1480px]' : 'max-w-5xl')}>
          {children}
        </div>
      </main>

      {/* Bottom navigation (phone / tablet) */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-line bg-paper/95 backdrop-blur lg:hidden">
        {BOTTOM.map((item) => {
          const on = active(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={on ? 'page' : undefined}
              className={cn(
                'flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium',
                on ? 'text-ink' : 'text-ink-3',
              )}
            >
              <Icon className={cn('h-5 w-5', on && 'text-accent')} />
              {t(item.label)}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMore(true)}
          className={cn(
            'flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium',
            moreActive ? 'text-ink' : 'text-ink-3',
          )}
        >
          <IconMore className={cn('h-5 w-5', moreActive && 'text-accent')} />
          {t('More')}
        </button>
      </nav>

      <Dialog open={more} onClose={() => setMore(false)} title={t('More')} size="sm">
        <div className="space-y-5">
          <OrgSwitcher onSwitched={() => setMore(false)} />
          <NavGroup title={msg('Manage')} items={MANAGE.slice(4)} onNavigate={() => setMore(false)} />
          <NavGroup title={msg('Organization')} items={ORGANIZATION} onNavigate={() => setMore(false)} />
          {isSuperadmin && <NavGroup title={msg('Platform')} items={PLATFORM} onNavigate={() => setMore(false)} />}
          <NavGroup
            title={msg('Account')}
            items={[{ href: '/account', label: msg('Account'), icon: IconUser }]}
            onNavigate={() => setMore(false)}
          />
        </div>
        <div className="-mx-5 mt-5 -mb-4">
          <AccountBlock />
        </div>
      </Dialog>
    </div>
  );
}

function OrgBadge() {
  const { session } = useRole();
  if (!session?.organization) return null;
  return <span className="max-w-[50%] truncate text-sm text-ink-2">{session.organization.name}</span>;
}
