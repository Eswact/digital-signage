'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';

const HEX = /^#([0-9a-f]{6}|[0-9a-f]{8})$/i;

/** Color swatch (system picker) + hex field. Accepts '#rrggbbaa' (transparency) too. */
export function ColorInput({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (hex: string) => void;
  className?: string;
}) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);

  function commit() {
    const v = text.trim().toLowerCase();
    if (HEX.test(v)) {
      if (v !== value) onChange(v);
    } else {
      setText(value);
    }
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <label
        className="relative h-9 w-9 flex-shrink-0 cursor-pointer overflow-hidden rounded border border-line-strong"
        style={{
          backgroundImage:
            'linear-gradient(45deg,#d4d4d0 25%,transparent 25%,transparent 75%,#d4d4d0 75%),linear-gradient(45deg,#d4d4d0 25%,transparent 25%,transparent 75%,#d4d4d0 75%)',
          backgroundSize: '10px 10px',
          backgroundPosition: '0 0,5px 5px',
        }}
      >
        <span className="absolute inset-0" style={{ backgroundColor: value }} />
        <input
          type="color"
          value={value.slice(0, 7)}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-label="Pick color"
        />
      </label>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
        spellCheck={false}
        className="h-9 w-full min-w-0 rounded border border-line-strong bg-surface px-2 font-mono text-xs text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
      />
    </div>
  );
}
