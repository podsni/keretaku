import { memo, useMemo, useState } from 'react';
import type { Engine } from '../engine/sched';
import { CHIP_SYS, SYS_LABEL, chipOf } from '../engine/constants';
import type { RunningTrain, SystemFilterId, SystemId } from '../engine/types';

interface LinesListPanelProps {
  engine: Engine;
  running: RunningTrain[];
  onOpenLine: (id: string) => void;
}

const GROUP_ORDER: SystemId[] = [
  'krl',
  'mrt',
  'lrtj',
  'jbdb',
  'bandara',
  'whoosh',
  'regional',
  'kai',
  'barang',
];

export const LinesListPanel = memo(function LinesListPanel({
  engine,
  running,
  onOpenLine,
}: LinesListPanelProps) {
  const [chip, setChip] = useState<SystemFilterId>('all');
  const [filterText, setFilterText] = useState('');

  const activeByLine = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of running) map.set(r.trip.line, (map.get(r.trip.line) || 0) + 1);
    return map;
  }, [running]);

  const totalLines = useMemo(() => engine.allLines().length, [engine]);

  const grouped = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    const all = engine.allLines().filter((l) => {
      if (chip !== 'all' && chipOf(l.sys) !== chip) return false;
      if (!q) return true;
      const origin = engine.st.get(l.stations[0])?.name.toLowerCase() || '';
      const dest = engine.st.get(l.stations[l.stations.length - 1])?.name.toLowerCase() || '';
      return (
        l.name.toLowerCase().includes(q) ||
        l.short.toLowerCase().includes(q) ||
        origin.includes(q) ||
        dest.includes(q)
      );
    });
    const out: { sys: SystemId; lines: typeof all }[] = [];
    for (const sys of GROUP_ORDER) {
      const items = all
        .filter((l) => l.sys === sys)
        .sort(
          (a, b) =>
            (activeByLine.get(b.id) || 0) - (activeByLine.get(a.id) || 0) ||
            a.name.localeCompare(b.name),
        );
      if (items.length) out.push({ sys, lines: items });
    }
    return out;
  }, [engine, chip, filterText, activeByLine]);

  return (
    <div className="flex flex-col">
      <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex flex-col gap-2">
        <input
          type="search"
          aria-label="Saring daftar jalur dan layanan kereta"
          placeholder={`Cari dari ${totalLines} jalur & layanan kereta…`}
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          className="w-full px-3 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
        />
        <div className="flex items-center gap-1 overflow-x-auto sepur-scroll">
          {CHIP_SYS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setChip(id)}
              aria-pressed={chip === id}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                chip === id
                  ? 'bg-slate-900 dark:bg-blue-600 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {grouped.length === 0 ? (
        <p className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
          Tidak ada layanan kereta yang cocok dengan pencarian &ldquo;{filterText}&rdquo;.
        </p>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {grouped.map(({ sys, lines }) => (
            <section key={sys} className="p-4 flex flex-col gap-2">
              <div className="flex items-baseline justify-between">
                <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  {SYS_LABEL[sys]}
                </h3>
                <span className="font-mono tabular-nums text-[11px] text-slate-400">
                  {lines.length} layanan
                </span>
              </div>
              <div className="divide-y divide-slate-100/80 dark:divide-slate-800/60">
                {lines.map((l) => {
                  const cnt = activeByLine.get(l.id) || 0;
                  const origin = engine.st.get(l.stations[0])?.name || l.stations[0];
                  const dest =
                    engine.st.get(l.stations[l.stations.length - 1])?.name ||
                    l.stations[l.stations.length - 1];
                  return (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => onOpenLine(l.id)}
                      className="w-full py-2 flex items-center justify-between gap-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded px-1.5 -mx-1.5 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: l.color }}
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                            {l.name}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {origin} ↔ {dest} · {l.stations.length} stasiun
                          </div>
                        </div>
                      </div>
                      <span
                        className={`font-mono tabular-nums text-[11px] shrink-0 ${
                          cnt > 0
                            ? 'text-blue-600 dark:text-blue-400 font-bold'
                            : 'text-slate-400 dark:text-slate-500'
                        }`}
                      >
                        {cnt > 0 ? `${cnt} aktif` : '—'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
});
