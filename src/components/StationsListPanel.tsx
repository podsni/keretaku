import { memo, useMemo, useState } from 'react';
import type { Engine } from '../engine/sched';
import { haversine } from '../engine/sched';
import { CHIP_SYS, SYS_SHORT, chipOf, formatDistanceKm } from '../engine/constants';
import type { StationsExtraData, SystemFilterId } from '../engine/types';

interface StationsListPanelProps {
  engine: Engine;
  stationsExtra: StationsExtraData | null;
  userLocation: [number, number] | null;
  onOpenStation: (id: string) => void;
}

const DAOP_OPTIONS: [string, string][] = [
  ['', 'Semua wilayah (Daop 1–9)'],
  ['Daop 1', 'Daop 1 · Jakarta & Banten'],
  ['Daop 2', 'Daop 2 · Bandung & Priangan'],
  ['Daop 3', 'Daop 3 · Cirebon'],
  ['Daop 4', 'Daop 4 · Semarang & Pantura'],
  ['Daop 5', 'Daop 5 · Purwokerto'],
  ['Daop 6', 'Daop 6 · Yogyakarta & Solo'],
  ['Daop 7', 'Daop 7 · Madiun'],
  ['Daop 8', 'Daop 8 · Surabaya & Malang'],
  ['Daop 9', 'Daop 9 · Jember & Banyuwangi'],
];

export const StationsListPanel = memo(function StationsListPanel({
  engine,
  stationsExtra,
  userLocation,
  onOpenStation,
}: StationsListPanelProps) {
  const [chip, setChip] = useState<SystemFilterId>('all');
  const [daopFilter, setDaopFilter] = useState('');
  const [filterText, setFilterText] = useState('');
  const [limit, setLimit] = useState(80);

  const totalStations = useMemo(() => engine.allStations().length, [engine]);

  const stations = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    let list = engine.allStations().filter((s) => {
      if (chip !== 'all' && !s.sys.some((sys) => chipOf(sys) === chip)) return false;
      if (daopFilter) {
        const d = stationsExtra?.s?.[s.id]?.daop || '';
        if (d !== daopFilter) return false;
      }
      if (q && !s.name.toLowerCase().includes(q) && !s.id.toLowerCase().includes(q)) return false;
      return true;
    });
    if (userLocation) {
      list = list
        .slice()
        .sort(
          (a, b) =>
            haversine(userLocation, [a.lng, a.lat]) - haversine(userLocation, [b.lng, b.lat]),
        );
    } else {
      list = list
        .slice()
        .sort((a, b) => (b.lines?.length || 0) - (a.lines?.length || 0) || a.name.localeCompare(b.name));
    }
    return list;
  }, [engine, chip, daopFilter, filterText, userLocation, stationsExtra]);

  const visibleStations = stations.slice(0, limit);
  const remaining = Math.max(0, stations.length - visibleStations.length);

  return (
    <div className="flex flex-col">
      <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex flex-col gap-2">
        <input
          type="search"
          aria-label="Saring daftar stasiun"
          placeholder={`Telusuri ${totalStations} stasiun di seluruh lintas…`}
          value={filterText}
          onChange={(e) => {
            setFilterText(e.target.value);
            setLimit(80);
          }}
          className="w-full px-3 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
        />

        {stationsExtra && (
          <select
            aria-label="Saring berdasarkan wilayah Daop"
            value={daopFilter}
            onChange={(e) => {
              setDaopFilter(e.target.value);
              setLimit(80);
            }}
            className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500"
          >
            {DAOP_OPTIONS.map(([val, label]) => (
              <option key={val || 'all'} value={val}>
                {label}
              </option>
            ))}
          </select>
        )}

        <div className="flex items-center gap-1 overflow-x-auto sepur-scroll">
          {CHIP_SYS.filter(([id]) => id !== 'barang').map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setChip(id);
                setLimit(80);
              }}
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

      <div className="px-4 py-2 text-[11px] text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 flex justify-between">
        <span className="font-mono tabular-nums">{stations.length} stasiun</span>
        <span>{userLocation ? 'Diurutkan dari lokasimu' : 'Diurutkan konektivitas'}</span>
      </div>

      <div className="divide-y divide-slate-100 dark:divide-slate-800/70 px-4">
        {visibleStations.map((s) => {
          const extra = stationsExtra?.s?.[s.id];
          const dist = userLocation ? haversine(userLocation, [s.lng, s.lat]) : null;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onOpenStation(s.id)}
              className="w-full py-2.5 flex items-center justify-between gap-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded px-1.5 -mx-1.5 transition-colors"
            >
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                  {s.name}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {s.sys.map((x) => SYS_SHORT[x]).join(' · ')}
                  {extra?.daop ? ` · ${extra.daop}` : ''}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-mono tabular-nums text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  {s.id}
                </div>
                {dist !== null && (
                  <div className="font-mono tabular-nums text-[10px] text-blue-600 dark:text-blue-400">
                    {formatDistanceKm(dist)}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {remaining > 0 && (
        <div className="p-3 flex justify-center">
          <button
            type="button"
            onClick={() => setLimit((prev) => prev + 160)}
            className="w-full py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            Tampilkan lebih banyak ({remaining} stasiun lagi)
          </button>
        </div>
      )}
    </div>
  );
});
