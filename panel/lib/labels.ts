import type { IconType } from 'react-icons';
import { msg } from '@/lib/i18n';
import type { OrgLimits, Orientation, TemplateType } from '@/lib/api';
import {
  IconInfoBoard,
  IconMedia,
  IconOrderBoard,
  IconQueue,
  IconWeb,
} from '@/components/ui/icons';

export const ROLE_LABEL = {
  owner: msg('Owner'),
  editor: msg('Editor'),
  viewer: msg('Viewer'),
} as const;

export const ROLE_HELP = {
  owner: msg('Manages members, settings and everything below'),
  editor: msg('Creates and edits screens, media, devices and schedules'),
  viewer: msg('Can look, but not change anything'),
} as const;

/** Templates that can be created from the panel, with their picker presentation. */
export const TEMPLATE_META: Record<TemplateType, { icon: IconType; name: string; description: string }> = {
  'media-player': {
    icon: IconMedia,
    name: msg('Media & Slideshow'),
    description: msg('A picture, a video or a slideshow of both'),
  },
  'info-board': {
    icon: IconInfoBoard,
    name: msg('Info & Announcement Board'),
    description: msg('Free-form text and lists placed anywhere on the screen'),
  },
  'order-board': {
    icon: IconOrderBoard,
    name: msg('Order Board'),
    description: msg('Dynamic columns of order numbers, fed by your POS'),
  },
  'queue-number': {
    icon: IconQueue,
    name: msg('Queue Number'),
    description: msg('Big current number and the next in line, fed by API'),
  },
  webview: {
    icon: IconWeb,
    name: msg('Web Page'),
    description: msg('Shows an external web page (needs a connection)'),
  },
};

export const TEMPLATE_ORDER: TemplateType[] = ['media-player', 'info-board', 'order-board', 'queue-number', 'webview'];

export const ORIENTATION_LABEL: Record<Orientation, string> = {
  landscape: msg('Landscape'),
  portrait: msg('Portrait'),
  auto: msg('Adaptive'),
};

export const ORIENTATION_OPTIONS: { value: Orientation; label: string }[] = [
  { value: 'landscape', label: msg('Landscape') },
  { value: 'portrait', label: msg('Portrait') },
  { value: 'auto', label: msg('Adaptive') },
];

/** Monday-first display order; values follow JS (0 = Sunday). */
export const WEEKDAYS: { value: number; short: string; long: string }[] = [
  { value: 1, short: msg('Mon'), long: msg('Monday') },
  { value: 2, short: msg('Tue'), long: msg('Tuesday') },
  { value: 3, short: msg('Wed'), long: msg('Wednesday') },
  { value: 4, short: msg('Thu'), long: msg('Thursday') },
  { value: 5, short: msg('Fri'), long: msg('Friday') },
  { value: 6, short: msg('Sat'), long: msg('Saturday') },
  { value: 0, short: msg('Sun'), long: msg('Sunday') },
];

/** Plan limits editable by the platform administrator (label, optional unit). */
export const LIMIT_FIELDS: { key: keyof OrgLimits; label: string; unit?: string }[] = [
  { key: 'maxScreens', label: msg('Screens') },
  { key: 'maxDevices', label: msg('Devices') },
  { key: 'maxMembers', label: msg('Team members') },
  { key: 'maxMediaFiles', label: msg('Media files') },
  { key: 'storageQuotaMb', label: msg('Storage'), unit: 'MB' },
  { key: 'maxUploadMb', label: msg('Largest single file'), unit: 'MB' },
  { key: 'maxVideoSeconds', label: msg('Longest video'), unit: 's' },
];
