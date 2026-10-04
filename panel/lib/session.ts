'use client';

import { useSyncExternalStore } from 'react';

/*
 * Browser session: a short-lived access token plus a rotating refresh token.
 * Kept in localStorage (the panel is a client-side app); `api()` refreshes the
 * access token transparently, one refresh at a time even across tabs.
 */

export type UserRole = 'superadmin' | 'user';
export type OrgRole = 'owner' | 'editor' | 'viewer';

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  twoFactorEnabled: boolean;
}

export interface Membership {
  organizationId: string;
  organizationName: string;
  role: OrgRole;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
  organization: { id: string; name: string; role: OrgRole } | null;
  organizations: Membership[];
}

const KEY = 'signage_session';
const EVENT = 'signage:session';

let cachedRaw: string | null | undefined;
let cachedValue: Session | null = null;

function read(): Session | null {
  if (typeof window === 'undefined') return null;
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return cachedValue;
  }
  if (raw === cachedRaw) return cachedValue;
  cachedRaw = raw;
  try {
    cachedValue = raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    cachedValue = null;
  }
  return cachedValue;
}

export const getSession = read;

export function setSession(session: Session): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    // Storage blocked: keep it in memory for this page only.
    cachedRaw = undefined;
    cachedValue = session;
  }
  window.dispatchEvent(new Event(EVENT));
}

export function clearSession(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
  cachedRaw = undefined;
  cachedValue = null;
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void): () => void {
  const onStorage = (e: StorageEvent) => e.key === KEY && cb();
  window.addEventListener(EVENT, cb);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener('storage', onStorage);
  };
}

/** Current session (null when signed out). `undefined` before the first client render. */
export function useSession(): Session | null | undefined {
  return useSyncExternalStore(
    subscribe,
    read,
    () => undefined,
  );
}

/** Role in the active organization; the platform superadmin counts as owner everywhere. */
export function effectiveRole(session: Session | null | undefined): OrgRole | null {
  if (!session) return null;
  if (session.user.role === 'superadmin') return 'owner';
  return session.organization?.role ?? null;
}

export function useRole() {
  const session = useSession();
  const role = effectiveRole(session);
  return {
    session,
    role,
    isSuperadmin: session?.user.role === 'superadmin',
    isOwner: role === 'owner',
    /** editor or owner */
    canEdit: role === 'owner' || role === 'editor',
  };
}

/** Seconds until the access token expires (from its `exp` claim). */
export function tokenTtl(token: string): number {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return Number(payload.exp) - Date.now() / 1000;
  } catch {
    return 0;
  }
}
