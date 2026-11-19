import { useState } from 'react';
import { ChevronDown, ChevronUp, Layers } from 'lucide-react';
import { JCAT } from '../engine/constants';
import type { JplData, JplFilter } from '../engine/types';

interface JplLegendCardProps {
  jplData: JplData | null;
  jplFilter: JplFilter;
  onUpdateJplFilter: (next: JplFilter) => void;
  onOpenLayers: () => void;
}

const LEGEND_ORDER = [
  'jaga',
  'palang',
  'sinyal',
  'tdk',
  'liar',
  'tutup',
  'ped',
  'unk',
  'fly',
  'under',
];

export function JplLegendCard({
  jplData,
  jplFilter,
  onUpdateJplFilter,
  onOpenLayers,
}: JplLegendCardProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const visibleCats = LEGEND_ORDER.filter(
    (k) => JCAT[k] && (!jplData || (jplData.stats[k] ?? 0) > 0),
  );

  const handleToggleCat = (cat: string) => {
    const all = visibleCats;
    let cur = jplFilter.cats.length ? [...jplFilter.cats] : [...all];
    if (!jplFilter.cats.length) cur = [cat];
    else cur = cur.includes(cat) ? cur.filter((x) => x !== cat) : [...cur, cat];
    onUpdateJplFilter({ ...jplFilter, cats: cur.length === all.length ? [] : cur });
  };

  const hasFilter = jplFilter.cats.length > 0 || jplFilter.daop !== '';

  return (
    <div className="pointer-events-auto">
      {/* Mobile compact toggle button */}
      <button
        type="button"
        onClick={() => setMobileOpen((v) => !v)}
        aria-expanded={mobileOpen}
        className="md:hidden inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 shadow-md text-xs font-semibold text-slate-800 dark:text-slate-100"
      >
        <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
        <span>Legenda JPL</span>
        {mobileOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
      </button>

      {/* Legend Card (always shown on md+, toggleable on mobile) */}
      <section
        aria-label="Legenda perlintasan sebidang"
        className={`${
          mobileOpen ? 'flex mt-1.5' : 'hidden md:flex'
        } flex-col w-[248px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-lg p-3 gap-1.5`}
      >
        <div className="flex items-center justify-between gap-2 pb-1">
          <h3 className="text-xs font-bold text-slate-900 dark:text-white">
            Perlintasan sebidang
          </h3>
          {hasFilter && (
            <button
              type="button"
              onClick={() => onUpdateJplFilter({ cats: [], daop: '' })}
              className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              Reset
            </button>
          )}
        </div>

        <div className="flex flex-col gap-0.5 max-h-[260px] overflow-y-auto sepur-scroll">
          {visibleCats.map((k) => {
            const [label, color] = JCAT[k];
            const active = !jplFilter.cats.length || jplFilter.cats.includes(k);
            return (
              <button
                key={k}
                type="button"
                onClick={() => handleToggleCat(k)}
                aria-pressed={active}
                className={`flex items-center gap-2 px-1.5 py-1 rounded-lg text-left text-[11px] leading-snug transition-colors ${
                  active
                    ? 'text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
                    : 'text-slate-400 dark:text-slate-500 opacity-55 hover:opacity-80'
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/70 dark:border-slate-900"
                  style={{ backgroundColor: color }}
                />
                <span className="truncate">{label}</span>
              </button>
            );
          })}

          <div className="flex items-center gap-2 px-1.5 py-1 text-[11px] text-slate-600 dark:text-slate-400">
            <span className="w-3 h-3 rounded-full bg-amber-400 border-[1.5px] border-slate-900 shrink-0" />
            <span className="truncate">Kelompok titik (ketuk perbesar)</span>
          </div>
        </div>

        <div className="pt-1.5 mt-0.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 text-[10px] text-slate-400 dark:text-slate-500">
          <span>© OpenStreetMap</span>
          <button
            type="button"
            onClick={onOpenLayers}
            className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 font-medium"
          >
            <Layers className="w-3 h-3" />
            <span>Filter lengkap</span>
          </button>
        </div>
      </section>
    </div>
  );
}
