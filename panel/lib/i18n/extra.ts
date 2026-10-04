import { msg } from './index';

/**
 * Strings that come from data files (shared/design-tokens.json: theme and element names)
 * and are translated at render time. Listed here so `npm run i18n:check` sees them.
 */
export const TOKEN_LABELS = [
  // themes
  msg('Midnight'), msg('Navy'), msg('Forest'), msg('Wine'), msg('Carbon'), msg('Paper'), msg('Sand'), msg('Sky'), msg('Mint'),
  // order board elements
  msg('Board title'), msg('Clock'), msg('Column header'), msg('Order number'), msg('Order label'),
  // queue number elements
  msg('Heading'), msg('Current number'), msg('Current name'), msg('Subtitle'), msg('List title'), msg('Queue number'), msg('Queue name'),
];
