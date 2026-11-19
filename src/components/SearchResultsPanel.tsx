import { SearchX, TrainFront } from 'lucide-react';
import type { Engine } from '../engine/sched';
import type { SearchResults } from '../engine/analytics';
import { JCAT, SYS_SHORT, trainDisplayInfo } from '../engine/constants';

interface SearchResultsPanelProps {
  query: string;
  engine: Engine;
  results: SearchResults;
  onOpenStation: (id: string) => void;
  onOpenLine: (id: string) => void;
  onOpenTrain: (id: string, date: string) => void;
  onOpenJpl: (index: number) => void;
}

export function SearchResultsPanel({
  query,
  engine,
  results,
  onOpenStation,
  onOpenLine,
  onOpenTrain,
  onOpenJpl,
}: SearchResultsPanelProps) {
  const empty =
    results.stations.length === 0 &&
    results.lines.length === 0 &&
    results.trains.length === 0 &&
    results.jpls.length === 0;

  if (empty) {
    return (
      <div className="p-8 text-center flex flex-col items-center gap-2 text-slate-500 dark:text-slate-400">
        <SearchX className="w-6 h-6 text-slate-400" />
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          Tidak ada hasil untuk &ldquo;{query}&rdquo;
        </p>
        <p className="text-xs">
          Coba cari nama stasiun (Manggarai, Gambir, Bandung), nama KA (Argo, Whoosh), atau nomor kereta.
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-100 dark:divide-slate-800">
      {results.stations.length > 0 && (
        <section className="p-4 flex flex-col gap-1.5">
          <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400">Stasiun</h3>
          <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
            {results.stations.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onOpenStation(s.id)}
                className="w-full py-2 flex items-center justify-between gap-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded px-1.5 -mx-1.5"
              >
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">{s.name}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {s.sys.map((x) => SYS_SHORT[x]).join(' · ')}
                  </div>
                </div>
                <span className="font-mono tabular-nums text-[11px] text-slate-400 shrink-0">{s.id}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {results.trains.length > 0 && (
        <section className="p-4 flex flex-col gap-1.5">
          <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400">Kereta aktif saat ini</h3>
          <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
            {results.trains.map((r) => {
              const line = engine.lines.get(r.trip.line);
              const info = trainDisplayInfo(r.trip, line);
              return (
                <button
                  key={r.trip.key}
                  type="button"
                  onClick={() => onOpenTrain(r.trip.id, r.trip.date)}
                  className="w-full py-2 flex items-center justify-between gap-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded px-1.5 -mx-1.5"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: line?.color || '#64748b' }}
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                        {info.name}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        KA {info.num} · tujuan {r.trip.head}
                      </div>
                    </div>
                  </div>
                  <TrainFront className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                </button>
              );
            })}
          </div>
        </section>
      )}

      {results.lines.length > 0 && (
        <section className="p-4 flex flex-col gap-1.5">
          <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400">Jalur &amp; Layanan</h3>
          <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
            {results.lines.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => onOpenLine(l.id)}
                className="w-full py-2 flex items-center gap-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded px-1.5 -mx-1.5"
              >
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: l.color }} />
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">{l.name}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">{SYS_SHORT[l.sys]}</div>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {results.jpls.length > 0 && (
        <section className="p-4 flex flex-col gap-1.5">
          <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400">Perlintasan sebidang (JPL)</h3>
          <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
            {results.jpls.map((jp) => (
              <button
                key={jp.index}
                type="button"
                onClick={() => onOpenJpl(jp.index)}
                className="w-full py-2 flex items-center justify-between gap-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded px-1.5 -mx-1.5"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: JCAT[jp.cat]?.[1] || '#64748b' }}
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">{jp.title}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {JCAT[jp.cat]?.[0] || jp.cat}
                      {jp.daop && jp.daop !== '-' ? ` · ${jp.daop}` : ''}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
