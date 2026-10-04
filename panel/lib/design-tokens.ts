// GENERATED — do not edit by hand. Source: shared/design-tokens.json
// Regenerate: node scripts/gen-design-tokens.mjs
import type { FontKey, Palette, TextAlign, ThemeMode } from '@/lib/api';

export interface TokenElement {
  key: string;
  label: string;
  font: FontKey;
  size: number;
  weight: number;
  color: string;
  align: TextAlign;
}

export const DESIGN_TOKENS: {
  presets: { id: string; label: string; mode: ThemeMode; palette: Palette }[];
  elements: Record<'order-board' | 'queue-number', TokenElement[]>;
  blockDefaults: Omit<TokenElement, 'key' | 'label'>;
} = {
  "presets": [
    {
      "id": "midnight",
      "label": "Midnight",
      "mode": "dark",
      "palette": {
        "background": "#0e0e16",
        "background2": "#1a1a26",
        "surface": "#ffffff10",
        "card": "#ffffff1a",
        "text": "#ffffff",
        "muted": "#9aa0aa",
        "accent": "#6366f1"
      }
    },
    {
      "id": "navy",
      "label": "Navy",
      "mode": "dark",
      "palette": {
        "background": "#0b1020",
        "background2": "#131c36",
        "surface": "#ffffff0f",
        "card": "#ffffff1a",
        "text": "#f8fafc",
        "muted": "#8899aa",
        "accent": "#38bdf8"
      }
    },
    {
      "id": "forest",
      "label": "Forest",
      "mode": "dark",
      "palette": {
        "background": "#0a1712",
        "background2": "#12291f",
        "surface": "#ffffff0f",
        "card": "#ffffff1a",
        "text": "#f0fdf4",
        "muted": "#86a898",
        "accent": "#22c55e"
      }
    },
    {
      "id": "wine",
      "label": "Wine",
      "mode": "dark",
      "palette": {
        "background": "#1a0b12",
        "background2": "#2a1220",
        "surface": "#ffffff0f",
        "card": "#ffffff1a",
        "text": "#fff1f2",
        "muted": "#b08a98",
        "accent": "#f43f5e"
      }
    },
    {
      "id": "carbon",
      "label": "Carbon",
      "mode": "dark",
      "palette": {
        "background": "#000000",
        "background2": "#111111",
        "surface": "#ffffff12",
        "card": "#ffffff1f",
        "text": "#ffffff",
        "muted": "#a1a1aa",
        "accent": "#f59e0b"
      }
    },
    {
      "id": "paper",
      "label": "Paper",
      "mode": "light",
      "palette": {
        "background": "#f7f8fa",
        "background2": "#eceef2",
        "surface": "#ffffff",
        "card": "#f3f4f6",
        "text": "#18181b",
        "muted": "#71717a",
        "accent": "#4f46e5"
      }
    },
    {
      "id": "sand",
      "label": "Sand",
      "mode": "light",
      "palette": {
        "background": "#faf6ef",
        "background2": "#f1e9db",
        "surface": "#ffffff",
        "card": "#f7f1e6",
        "text": "#292524",
        "muted": "#8a7f72",
        "accent": "#d97706"
      }
    },
    {
      "id": "sky",
      "label": "Sky",
      "mode": "light",
      "palette": {
        "background": "#f0f7ff",
        "background2": "#dcebfb",
        "surface": "#ffffff",
        "card": "#eef5fd",
        "text": "#0f172a",
        "muted": "#64748b",
        "accent": "#0284c7"
      }
    },
    {
      "id": "mint",
      "label": "Mint",
      "mode": "light",
      "palette": {
        "background": "#f0fdf6",
        "background2": "#dcf5e8",
        "surface": "#ffffff",
        "card": "#ecfbf3",
        "text": "#052e1a",
        "muted": "#5f7d6e",
        "accent": "#059669"
      }
    }
  ],
  "elements": {
    "order-board": [
      {
        "key": "title",
        "label": "Board title",
        "font": "roboto",
        "size": 56,
        "weight": 700,
        "color": "text",
        "align": "start"
      },
      {
        "key": "clock",
        "label": "Clock",
        "font": "roboto",
        "size": 36,
        "weight": 500,
        "color": "muted",
        "align": "end"
      },
      {
        "key": "columnHeader",
        "label": "Column header",
        "font": "roboto",
        "size": 34,
        "weight": 600,
        "color": "#ffffff",
        "align": "start"
      },
      {
        "key": "orderCode",
        "label": "Order number",
        "font": "mono",
        "size": 88,
        "weight": 700,
        "color": "text",
        "align": "start"
      },
      {
        "key": "orderLabel",
        "label": "Order label",
        "font": "roboto",
        "size": 28,
        "weight": 400,
        "color": "muted",
        "align": "start"
      }
    ],
    "queue-number": [
      {
        "key": "heading",
        "label": "Heading",
        "font": "roboto",
        "size": 56,
        "weight": 500,
        "color": "muted",
        "align": "center"
      },
      {
        "key": "number",
        "label": "Current number",
        "font": "mono",
        "size": 300,
        "weight": 700,
        "color": "text",
        "align": "center"
      },
      {
        "key": "currentName",
        "label": "Current name",
        "font": "roboto",
        "size": 64,
        "weight": 600,
        "color": "text",
        "align": "center"
      },
      {
        "key": "subtitle",
        "label": "Subtitle",
        "font": "roboto",
        "size": 44,
        "weight": 400,
        "color": "muted",
        "align": "center"
      },
      {
        "key": "queueTitle",
        "label": "List title",
        "font": "roboto",
        "size": 40,
        "weight": 700,
        "color": "muted",
        "align": "start"
      },
      {
        "key": "queueNumber",
        "label": "Queue number",
        "font": "mono",
        "size": 72,
        "weight": 700,
        "color": "accent",
        "align": "start"
      },
      {
        "key": "queueName",
        "label": "Queue name",
        "font": "roboto",
        "size": 36,
        "weight": 400,
        "color": "muted",
        "align": "start"
      }
    ]
  },
  "blockDefaults": {
    "font": "roboto",
    "size": 48,
    "weight": 400,
    "color": "text",
    "align": "start"
  }
};
