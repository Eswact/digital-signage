import { clearSession, getSession, setSession, tokenTtl, Session } from './session';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

/**
 * Absolute API base for examples shown to people (ingest API snippets). Behind a
 * reverse proxy the panel runs with `NEXT_PUBLIC_API_URL=/api`, so the browser origin is added.
 */
export const API_BASE =
  API_URL.startsWith('/') && typeof window !== 'undefined' ? `${window.location.origin}${API_URL}` : API_URL;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    /** Machine-readable error code from the server (e.g. LIMIT_REACHED, MEDIA_IN_USE). */
    public code?: string,
    public body?: Record<string, unknown>,
  ) {
    super(message);
  }
}

// --- Token refresh -------------------------------------------------------------

let refreshing: Promise<Session | null> | null = null;

/**
 * Exchanges the refresh token for a new session. Refresh tokens rotate and the
 * server treats reuse as theft, so only one refresh may run at a time — across
 * tabs too (Web Locks) — and a tab that finds the token already rotated simply
 * adopts the newer session.
 */
function refreshSession(usedRefreshToken: string): Promise<Session | null> {
  if (refreshing) return refreshing;
  const run = async (): Promise<Session | null> => {
    const current = getSession();
    if (!current) return null;
    if (current.refreshToken !== usedRefreshToken) return current;
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: current.refreshToken }),
      });
      if (res.status === 401 || res.status === 403) {
        clearSession();
        return null;
      }
      if (!res.ok) return null;
      const next = (await res.json()) as Session;
      setSession(next);
      return next;
    } catch {
      return null; // offline: keep the session, the caller reports the failure
    }
  };
  const locked = async (): Promise<Session | null> =>
    typeof navigator !== 'undefined' && navigator.locks ? ((await navigator.locks.request('signage-refresh', run)) as Session | null) : run();
  const promise = locked().finally(() => {
    refreshing = null;
  });
  refreshing = promise;
  return promise;
}

/** A valid access token, refreshing first when it is about to expire. */
export async function freshAccessToken(): Promise<string | null> {
  const session = getSession();
  if (!session) return null;
  if (tokenTtl(session.accessToken) > 20) return session.accessToken;
  const next = await refreshSession(session.refreshToken);
  return next?.accessToken ?? null;
}

function toError(res: Response, body: unknown): ApiError {
  const b = (body ?? {}) as { message?: string | string[]; code?: string };
  const message = Array.isArray(b.message) ? b.message.join(', ') : (b.message ?? res.statusText);
  return new ApiError(res.status, message, b.code, body as Record<string, unknown>);
}

export async function api<T = unknown>(
  path: string,
  options: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  const { auth = true, ...init } = options;

  const send = (token: string | null) =>
    fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        ...(init.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });

  let res = await send(auth ? await freshAccessToken() : null);

  if (res.status === 401 && auth) {
    const session = getSession();
    const next = session ? await refreshSession(session.refreshToken) : null;
    if (next) res = await send(next.accessToken);
    else if (!getSession() && typeof window !== 'undefined' && !location.pathname.startsWith('/login')) {
      location.replace(`/login?next=${encodeURIComponent(location.pathname + location.search)}`);
    }
  }

  const text = res.status === 204 ? '' : await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {
    body = undefined;
  }
  if (!res.ok) throw toError(res, body);
  return body as T;
}

// --- Auth ----------------------------------------------------------------------

export type LoginResult = Session | { twoFactorRequired: true; challenge: string };

export async function login(email: string, password: string): Promise<LoginResult> {
  const res = await api<LoginResult>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
    auth: false,
  });
  if ('accessToken' in res) setSession(res);
  return res;
}

export async function loginTwoFactor(challenge: string, code: string): Promise<Session> {
  const res = await api<Session>('/auth/login/2fa', {
    method: 'POST',
    body: JSON.stringify({ challenge, code }),
    auth: false,
  });
  setSession(res);
  return res;
}

/** First-run setup only (creates the superadmin). */
export async function registerFirstUser(email: string, password: string, name?: string): Promise<Session> {
  const res = await api<Session>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, name: name || undefined }),
    auth: false,
  });
  setSession(res);
  return res;
}

export async function logout(): Promise<void> {
  const session = getSession();
  clearSession();
  if (session) {
    await api('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: session.refreshToken }),
      auth: false,
    }).catch(() => undefined);
  }
}

/** Re-reads profile + memberships (e.g. after renaming the organization or toggling 2FA). */
export async function refreshProfile(): Promise<void> {
  const me = await api<Omit<Session, 'accessToken' | 'refreshToken'>>('/auth/me');
  const current = getSession();
  if (current) setSession({ ...current, ...me });
}

export async function switchOrganization(organizationId: string): Promise<Session> {
  // Rotates the refresh token like a normal refresh, so it shares the same lock.
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return (await navigator.locks.request('signage-refresh', () => doSwitch(organizationId))) as Session;
  }
  return doSwitch(organizationId);
}

async function doSwitch(organizationId: string): Promise<Session> {
  const session = getSession();
  if (!session) throw new ApiError(401, 'Not signed in');
  const next = await api<Session>('/auth/switch-org', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: session.refreshToken, organizationId }),
    auth: false,
  });
  setSession(next);
  return next;
}

// --- Media ---------------------------------------------------------------------

export const mediaUrl = (mediaId: string) => `${API_URL}/media/file/${mediaId}`;

export type MediaKind = 'image' | 'video';

/** Descriptor of a library file as stored inside screen data (filled by the server). */
export interface AssetRef {
  mediaId: string;
  kind?: MediaKind;
  sha256?: string;
  bytes?: number;
  width?: number | null;
  height?: number | null;
  durationMs?: number | null;
  avgColor?: string | null;
}

export interface MediaItem {
  id: string;
  kind: MediaKind;
  name: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  sha256: string;
  avgColor: string | null;
  origin: 'library' | 'screen' | 'overlay';
  createdAt: string;
  usedBy: Array<{ id: string; name: string }>;
}

// --- Domain types --------------------------------------------------------------

export interface Device {
  id: string;
  deviceId: string;
  name?: string;
  status: 'online' | 'offline';
  lastSeenAt?: string | null;
  pairedAt?: string | null;
  organizationId?: string | null;
  /** Base assignment. */
  currentScreenId?: string | null;
  /** What the device shows right now (a schedule may override the base assignment). */
  activeScreenId?: string | null;
  currentScreen?: Screen | null;
  groupId?: string | null;
  group?: Group | null;
  /** APK version and supported templates as reported by the device (absent on old devices). */
  appVersion?: number | null;
  appVersionName?: string | null;
  templates?: Record<string, number> | null;
}

/**
 * Can the device render this template? `null` for devices that report nothing.
 * Compares against the backend template `version` + `minAppVersion`.
 */
export function deviceSupports(
  device: Pick<Device, 'appVersion' | 'templates'>,
  def: Pick<TemplateDefinition, 'type' | 'version' | 'minAppVersion'> | undefined,
): boolean | null {
  if (!def || (device.appVersion == null && device.templates == null)) return null;
  if ((device.appVersion ?? 0) < def.minAppVersion) return false;
  return (device.templates?.[def.type] ?? 0) >= def.version;
}

export interface Group {
  id: string;
  name: string;
  currentScreenId?: string | null;
  createdAt: string;
}

export type TemplateType = 'order-board' | 'queue-number' | 'info-board' | 'media-player' | 'webview';

/** `auto` (adaptive): the orientation is not locked and follows the device. */
export type Orientation = 'landscape' | 'portrait' | 'auto';

export interface Screen {
  id: string;
  name: string;
  template: TemplateType;
  orientation: Orientation;
  data: Record<string, unknown>;
  organizationId?: string;
  updatedAt: string;
}

export interface TemplateDefinition {
  type: TemplateType;
  label: string;
  /** Template data-schema version (compared with what the device reports). */
  version: number;
  /** Lowest APK versionCode that can render this template. */
  minAppVersion: number;
  customEditor?: boolean;
  defaultData: Record<string, unknown>;
}

// --- Shared appearance (all templates) — same schema as Android ui/design ----------

export type ThemeMode = 'dark' | 'light';

export type ColorToken = 'background' | 'background2' | 'surface' | 'card' | 'text' | 'muted' | 'accent';

export type Palette = Record<ColorToken, string>;

export interface Appearance {
  mode: ThemeMode;
  preset: string;
  /** User colors on top of the preset. */
  colors?: Partial<Palette>;
}

export type FontKey = 'roboto' | 'inter' | 'montserrat' | 'oswald' | 'bebas' | 'playfair' | 'mono';

export type TextAlign = 'start' | 'center' | 'end';

/** Element style. `size` is a relative unit: the screen's short side = 1080. */
export interface ElementStyle {
  font?: FontKey;
  size?: number;
  /** '#rrggbb' / '#rrggbbaa' or a palette key ('text' | 'muted' | 'accent'). */
  color?: string;
  weight?: number;
  italic?: boolean;
  align?: TextAlign;
}

export type ElementStyles = Record<string, ElementStyle>;

// --- Banners and badges (every template) ---------------------------------------

export type Fit = 'cover' | 'contain';
/** Letterbox fill when the media is `contain`: blurred copy of it, a color, or nothing. */
export type Fill = 'match' | 'color' | 'none';

export interface MediaBox {
  fit?: Fit;
  /** Visible part when `cover` (0–100 %, like CSS object-position). */
  focalX?: number;
  focalY?: number;
  fill?: Fill;
  fillColor?: string;
}

export interface Banner extends MediaBox {
  id: string;
  position: 'top' | 'bottom';
  /** Height as a percentage of the screen height. */
  heightPct: number;
  kind: 'image' | 'text';
  media?: AssetRef;
  text?: string;
  /** Background of a text banner. */
  background?: string;
}

export type Corner = 'tl' | 'tr' | 'bl' | 'br';
export type BadgeShape = 'circle' | 'rounded' | 'square';

export interface Badge extends MediaBox {
  id: string;
  corner: Corner;
  /** Size as a percentage of the screen's short side. */
  sizePct: number;
  /** Distance from the corner, % of the short side. */
  marginPct?: number;
  shape: BadgeShape;
  kind: 'image' | 'text';
  media?: AssetRef;
  text?: string;
  background?: string;
}

export interface Overlays {
  banners: Banner[];
  badges: Badge[];
}

export interface Styled {
  appearance?: Appearance;
  styles?: ElementStyles;
  overlays?: Overlays;
}

// --- order-board ---------------------------------------------------------------
export interface OrderColumn {
  id: string;
  title: string;
  accent?: string;
}

export interface OrderItem {
  id: string;
  code: string;
  label?: string;
  columnId: string;
}

export interface OrderBoardData extends Styled {
  title?: string;
  showLabel?: boolean;
  showClock?: boolean;
  /** Page-turn interval (s, default 8) when orders do not fit a column. */
  pageSeconds?: number;
  columns: OrderColumn[];
  orders: OrderItem[];
}

// --- queue-number --------------------------------------------------------------
export interface QueueItem {
  id: string;
  number: string;
  name?: string;
}

export interface QueueData extends Styled {
  heading?: string;
  current?: string;
  currentName?: string;
  subtitle?: string;
  showQueue?: boolean;
  queueTitle?: string;
  showNames?: boolean;
  queueLimit?: number;
  queue?: QueueItem[];
}

// --- info-board ----------------------------------------------------------------
export type BlockKind = 'text' | 'list';
export type BulletStyle = 'dot' | 'dash' | 'number' | 'check' | 'none';

/** Free-form block: x/y/w are percentages of the screen (top-left corner + width). */
export interface InfoBlock {
  id: string;
  kind: BlockKind;
  text?: string;
  items?: string[];
  bullet?: BulletStyle;
  x: number;
  y: number;
  w: number;
  style?: ElementStyle;
}

export interface InfoBoardData extends Styled {
  blocks: InfoBlock[];
}

// --- media-player --------------------------------------------------------------
export interface Slide extends AssetRef, MediaBox {
  id: string;
  /** Display time of an image slide in seconds (videos play to the end). */
  durationSec?: number;
  muted?: boolean;
  /** Library name, for display only. */
  name?: string;
}

export interface MediaPlayerData extends Styled {
  items: Slide[];
  transition?: 'none' | 'fade' | 'slide';
  defaultDurationSec?: number;
  shuffle?: boolean;
}

// --- webview -------------------------------------------------------------------
export interface WebViewData extends Styled {
  url?: string;
  /** Reload interval in seconds; 0 = never. */
  reloadSeconds?: number;
}

export interface ApiKey {
  id: string;
  /** Visible prefix of the key (e.g. "sk_1a2b3c4d"); the key itself is not stored. */
  prefix: string;
  name: string;
  screenId: string;
  lastUsedAt?: string | null;
  createdAt: string;
}

/** Creation response: the raw key appears here only, once. */
export interface CreatedApiKey extends ApiKey {
  key: string;
}

/** Live state returned by queue operations (next/prev/…). */
export interface QueueState {
  current: string;
  currentName: string;
  queue: QueueItem[];
}

// --- Schedules -----------------------------------------------------------------

export interface Schedule {
  id: string;
  name: string;
  targetType: 'device' | 'group';
  targetId: string;
  screenId: string;
  /** 0 = Sunday … 6 = Saturday */
  days: number[];
  startTime?: string | null;
  endTime?: string | null;
  priority: number;
  enabled: boolean;
  activeNow: boolean;
}

// --- Organizations, plans ------------------------------------------------------

export interface OrgLimits {
  maxScreens: number;
  maxDevices: number;
  maxMembers: number;
  storageQuotaMb: number;
  maxMediaFiles: number;
  maxVideoSeconds: number;
  maxUploadMb: number;
}

export interface OrgUsage {
  screens: number;
  devices: number;
  members: number;
  mediaFiles: number;
  storageBytes: number;
}

export interface OrganizationDetail {
  id: string;
  name: string;
  plan: string;
  timezone: string;
  limits: OrgLimits;
  usage: OrgUsage;
  members: Array<{
    userId: string;
    email: string;
    name: string | null;
    role: 'owner' | 'editor' | 'viewer';
    joinedAt: string;
  }>;
  invitations: Array<{ id: string; email: string; role: 'owner' | 'editor' | 'viewer'; expiresAt: string }>;
}

export interface AdminOrganization {
  id: string;
  name: string;
  plan: string;
  timezone: string;
  /** Overrides set for this organization only. */
  limits: Partial<OrgLimits>;
  effective: OrgLimits;
  usage: OrgUsage;
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  name?: string | null;
  role: 'superadmin' | 'user';
  createdAt: string;
}
