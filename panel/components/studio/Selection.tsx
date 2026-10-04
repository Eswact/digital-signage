'use client';

import { createContext, useContext } from 'react';
import { cn } from '@/lib/cn';

interface SelectionValue {
  selected: string | null;
  select: (key: string | null) => void;
}

const SelectionContext = createContext<SelectionValue | null>(null);

export const SelectionProvider = SelectionContext.Provider;

export function useSelection() {
  return useContext(SelectionContext);
}

/**
 * An element of the preview that can be clicked and customized. Outside an editor
 * (no context) it is a plain box. All elements with the same key are highlighted
 * together (e.g. every order number).
 */
export function Sel({
  k,
  className,
  style,
  children,
}: {
  k: string;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}) {
  const ctx = useSelection();
  if (!ctx) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );
  }
  const active = ctx.selected === k;
  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        ctx.select(k);
      }}
      className={cn(
        // Inset outline so full-width elements are not clipped at the edges.
        'cursor-pointer rounded-[2px] [outline-offset:-2px]',
        active
          ? 'outline outline-2 outline-accent'
          : 'hover:outline hover:outline-1 hover:outline-dashed hover:outline-accent/70',
        className,
      )}
      style={style}
    >
      {children}
    </div>
  );
}
