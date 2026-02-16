'use client';

import { type ThemeName, themes, themeOrder } from '@/lib/themes';

interface ThemeSwitcherProps {
  current: ThemeName;
  onChange: (theme: ThemeName) => void;
}

export default function ThemeSwitcher({ current, onChange }: ThemeSwitcherProps) {
  const next = () => {
    const i = themeOrder.indexOf(current);
    onChange(themeOrder[(i + 1) % themeOrder.length]);
  };

  const [bg, border] = themes[current].preview;

  return (
    <button
      onClick={next}
      title={`theme: ${themes[current].label}`}
      aria-label={`Switch theme, currently ${themes[current].label}`}
      className="flex flex-col items-center gap-1 group"
    >
      <div
        className="w-6 h-6 overflow-hidden transition-transform group-hover:scale-110 group-active:scale-95"
        style={{ border: `2px solid ${border}` }}
      >
        <div className="w-full h-full relative">
          <div className="absolute inset-0" style={{ backgroundColor: bg }} />
          <div
            className="absolute inset-0"
            style={{
              backgroundColor: border,
              clipPath: 'polygon(100% 0, 0% 100%, 100% 100%)',
            }}
          />
        </div>
      </div>
      <span
        className="text-[8px] font-mono uppercase tracking-[0.15em] transition-colors"
        style={{ color: 'var(--th-text-faint)' }}
      >
        theme
      </span>
    </button>
  );
}
