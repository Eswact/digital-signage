'use client';

import { useEffect, useState } from 'react';
import { useT, msg } from '@/lib/i18n';
import { cn } from '@/lib/cn';
import { POSTER } from '@/lib/brand';

/* The marketing side of the sign-in page: rotating slides that explain the product.
 * Fixed dark colors on purpose (it is a poster, not part of the themed UI): the default theme's dark mode. */

const BG = POSTER.background;
const ACCENT = POSTER.accent;

function Frame({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('relative aspect-video w-full overflow-hidden border border-white/20 bg-white/[0.04]', className)}>
      {children}
    </div>
  );
}

function ArtLive() {
  return (
    <div className="grid w-full grid-cols-3 gap-3">
      {[0, 1, 2].map((i) => (
        <Frame key={i} className={i === 1 ? 'translate-y-4' : ''}>
          <div className="absolute inset-x-[10%] top-[16%] h-[14%] bg-white/80" />
          <div className="absolute inset-x-[10%] top-[40%] h-[8%] w-[60%] bg-white/30" />
          <div className="absolute inset-x-[10%] top-[56%] h-[8%] w-[45%] bg-white/30" />
          <div className="absolute bottom-[12%] right-[10%] h-[14%] w-[14%] rounded-full" style={{ background: ACCENT }} />
        </Frame>
      ))}
    </div>
  );
}

function ArtBoards() {
  return (
    <div className="grid w-full grid-cols-5 gap-3">
      <Frame className="col-span-3">
        <div className="absolute inset-[8%] grid grid-cols-2 gap-[6%]">
          {['#f59e0b', '#22c55e'].map((c) => (
            <div key={c} className="flex flex-col gap-[8%] bg-white/10 p-[8%]">
              <div className="h-[10%] w-full" style={{ background: c }} />
              {[0, 1, 2].map((r) => (
                <div key={r} className="h-[16%] w-full bg-white/25" />
              ))}
            </div>
          ))}
        </div>
      </Frame>
      <Frame className="col-span-2 flex items-center justify-center">
        <span className="font-mono text-4xl font-bold tracking-tight text-white sm:text-5xl">A042</span>
      </Frame>
    </div>
  );
}

function ArtMedia() {
  return (
    <Frame className="max-w-md">
      <div className="absolute inset-x-0 top-0 h-[16%]" style={{ background: ACCENT }} />
      <div className="absolute inset-x-0 bottom-0 top-[16%] bg-gradient-to-br from-white/25 to-white/5" />
      <div className="absolute left-[8%] top-[34%] h-[10%] w-[44%] bg-white/80" />
      <div className="absolute left-[8%] top-[52%] h-[6%] w-[30%] bg-white/40" />
      <div className="absolute bottom-[8%] right-[6%] flex h-[26%] w-[16%] items-center justify-center rounded-full bg-white text-[10px] font-bold" style={{ color: BG }}>
        NEW
      </div>
    </Frame>
  );
}

function ArtSchedule() {
  const lit = new Set(['0-1', '0-2', '1-1', '1-2', '2-4', '3-4', '3-5', '4-1', '4-2', '5-3', '6-3']);
  return (
    <div className="grid w-full max-w-md grid-cols-7 gap-1.5">
      {Array.from({ length: 7 * 6 }, (_, i) => {
        const col = i % 7;
        const row = Math.floor(i / 7);
        const on = lit.has(`${col}-${row}`);
        return <div key={i} className="aspect-square" style={{ background: on ? ACCENT : 'rgba(255,255,255,.1)' }} />;
      })}
    </div>
  );
}

function ArtTeam() {
  return (
    <div className="flex flex-wrap gap-3">
      {[
        ['Owner', ACCENT, BG],
        ['Editor', '#fff', BG],
        ['Viewer', 'transparent', '#fff'],
      ].map(([label, bg, fg]) => (
        <div
          key={label}
          className="flex h-14 items-center gap-3 border border-white/30 px-5 text-sm font-semibold"
          style={{ background: bg, color: fg }}
        >
          <span className="h-5 w-5 rounded-full border-2 border-current" />
          {label}
        </div>
      ))}
    </div>
  );
}

const SLIDES = [
  {
    art: ArtLive,
    title: msg('Edit once. Every screen follows.'),
    text: msg('Changes reach your screens in under a second — no USB sticks, no re-uploading videos.'),
  },
  {
    art: ArtBoards,
    title: msg('Order boards and queue numbers, live.'),
    text: msg('Feed them from your POS or queue system over a simple API, or manage them by hand.'),
  },
  {
    art: ArtMedia,
    title: msg('Images, video, banners and badges.'),
    text: msg('Build slideshows and add a banner or badge to any screen. Media is cached on the device and plays offline.'),
  },
  {
    art: ArtSchedule,
    title: msg('Scheduled, not forgotten.'),
    text: msg('Breakfast menu until 11:00, lunch until 16:00 — screens switch by themselves.'),
  },
  {
    art: ArtTeam,
    title: msg('Built for teams.'),
    text: msg('Invite colleagues as owners, editors or viewers. Every organization is fully separate.'),
  },
];

export function PromoPanel() {
  const t = useT();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % SLIDES.length), 7000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className="relative hidden flex-1 flex-col justify-between overflow-hidden p-12 text-white lg:flex xl:p-16"
      style={{ background: BG }}
    >
      <div className="flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">
        <span className="h-px w-8 bg-white/40" /> Digital signage
      </div>

      <div className="relative min-h-[26rem]">
        {SLIDES.map((slide, i) => {
          const Art = slide.art;
          return (
            <div
              key={slide.title}
              aria-hidden={i !== index}
              className={cn(
                'absolute inset-0 flex flex-col justify-center gap-10 transition-all duration-700',
                i === index ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0',
              )}
            >
              <Art />
              <div className="max-w-xl">
                <h2 className="text-4xl font-semibold leading-[1.05] tracking-tightest xl:text-5xl">{t(slide.title)}</h2>
                <p className="mt-4 max-w-md text-base leading-relaxed text-white/65">{t(slide.text)}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2" role="tablist" aria-label="Slides">
        {SLIDES.map((slide, i) => (
          <button
            key={slide.title}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-label={`${i + 1}`}
            onClick={() => setIndex(i)}
            className="group py-3"
          >
            <span
              className={cn('block h-0.5 transition-all', i === index ? 'w-12' : 'w-6 group-hover:bg-white/60')}
              style={{ background: i === index ? ACCENT : 'rgba(255,255,255,.3)' }}
            />
          </button>
        ))}
        <span className="ml-auto font-mono text-xs tabular-nums text-white/50">
          {String(index + 1).padStart(2, '0')} / {String(SLIDES.length).padStart(2, '0')}
        </span>
      </div>
    </div>
  );
}
