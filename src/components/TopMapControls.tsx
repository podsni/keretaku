import { Compass } from 'lucide-react';
import { CHIP_SYS, REGION_PRESETS } from '../engine/constants';
import type { RegionPreset, SystemFilterId } from '../engine/types';

interface TopMapControlsProps {
  systemFilter: SystemFilterId;
  activeCounts: Record<SystemFilterId, number>;
  onSelectFilter: (id: SystemFilterId) => void;
  onJumpRegion: (preset: RegionPreset) => void;
}

export function TopMapControls({
  systemFilter,
  activeCounts,
  onSelectFilter,
  onJumpRegion,
}: TopMapControlsProps) {
  return (
    <div className="pointer-events-none flex flex-col gap-1.5 items-start w-full">
      {/* Row 1: Responsive Horizontal System Filter Strip (Desktop & Mobile) */}
      <div
        role="group"
        aria-label="Filter sistem kereta"
        className="pointer-events-auto flex items-center gap-0.5 p-1 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/90 dark:border-slate-800 rounded-xl shadow-sm overflow-x-auto max-w-full no-scrollbar"
      >
        {CHIP_SYS.map(([id, label]) => {
          const active = systemFilter === id;
          const count = activeCounts[id] ?? 0;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelectFilter(id)}
              aria-pressed={active}
              className={`px-2.5 py-1.5 min-h-[34px] md:min-h-[32px] text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 touch-manipulation ${
                active
                  ? 'bg-slate-900 dark:bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>{label}</span>
              <span
                className={`font-mono tabular-nums text-[11px] ${
                  active ? 'text-slate-300 dark:text-blue-100' : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Row 2: Quick Corridor / Region Jump Strip (Desktop lg+) */}
      <div className="pointer-events-auto hidden lg:flex items-center gap-1 px-2 py-1 bg-white/92 dark:bg-slate-900/92 backdrop-blur-md border border-slate-200/90 dark:border-slate-800 rounded-xl shadow-xs">
        <Compass className="w-3.5 h-3.5 text-slate-400 mr-1 shrink-0" aria-hidden="true" />
        {REGION_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => onJumpRegion(preset)}
            className="px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}
