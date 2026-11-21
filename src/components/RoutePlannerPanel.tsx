import { useEffect, useMemo, useState } from 'react';
import { ArrowUpDown, Footprints, MapPin, Play, TrainFront } from 'lucide-react';
import type { Engine } from '../engine/sched';
import { dur, fmt } from '../engine/sched';
import { trainDisplayInfo } from '../engine/constants';
import { tagJourneyHighlights } from '../engine/javaInsights';
import type { ClockState, Journey, Station } from '../engine/types';
import { ShareButton } from './ShareButton';

interface RoutePlannerPanelProps {
  engine: Engine;
  clock: ClockState;
  fromId: string | null;
  toId: string | null;
  routeDate?: string | null;
  routeSec?: number | null;
  pickMode: 'from' | 'to' | null;
  activeJourneyIndex: number;
  journeys: Journey[];
  onSetFrom: (id: string | null) => void;
  onSetTo: (id: string | null) => void;
  onSwap: () => void;
  onSetPickMode: (mode: 'from' | 'to' | null) => void;
  onSearch: (from: string, to: string, date: string, sec: number) => void;
  onSelectJourney: (index: number) => void;
  onSimulateJourney: (journey: Journey) => void;
  onShare: (date: string, sec: number) => void;
}

function StationAutocomplete({
  label,
  valueId,
  stations,
  pickActive,
  onSelect,
  onTogglePick,
}: {
  label: string;
  valueId: string | null;
  stations: Station[];
  pickActive: boolean;
  onSelect: (id: string) => void;
  onTogglePick: () => void;
}) {
  const current = valueId ? stations.find((s) => s.id === valueId) : null;
  const [text, setText] = useState(current?.name || '');
  const [open, setOpen] = useState(false);

  // Keep input synced when valueId changes externally (e.g. map click or swap)
  const displayVal = open ? text : current?.name || text;

  const suggestions = useMemo(() => {
    const q = text.trim().toLowerCase();
    if (!q) {
      return stations.filter((s) => ['MRI', 'BOO', 'THB', 'GMR', 'BD', 'YK', 'SBI', 'BKS', 'LBB', 'BHI'].includes(s.id)).slice(0, 8);
    }
    return stations
      .filter((s) => s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q))
      .slice(0, 8);
  }, [stations, text]);

  return (
    <div className="relative">
      <div className="flex items-center gap-1.5">
        <div className="relative flex-1">
          <input
            type="text"
            aria-label={label}
            placeholder={label}
            value={displayVal}
            onFocus={() => {
              setText(current?.name || '');
              setOpen(true);
            }}
            onBlur={() => setTimeout(() => setOpen(false), 160)}
            onChange={(e) => {
              setText(e.target.value);
              setOpen(true);
            }}
            className="w-full px-3 py-2 rounded-lg text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
          />
        </div>
        <button
          type="button"
          onClick={onTogglePick}
          aria-pressed={pickActive}
          title="Klik stasiun langsung di peta"
          aria-label={`Pilih ${label.toLowerCase()} di peta`}
          className={`p-2 rounded-lg border transition-colors shrink-0 ${
            pickActive
              ? 'bg-blue-600 border-blue-600 text-white'
              : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <MapPin className="w-4 h-4" />
        </button>
      </div>

      {open && suggestions.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-30 left-0 right-10 mt-1 max-h-52 overflow-y-auto sepur-scroll bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg divide-y divide-slate-100 dark:divide-slate-800"
        >
          {suggestions.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(s.id);
                  setText(s.name);
                  setOpen(false);
                }}
                className="w-full px-3 py-2 text-left text-xs flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <span className="font-semibold text-slate-900 dark:text-white">{s.name}</span>
                <span className="font-mono text-[11px] text-slate-400">{s.id}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function RoutePlannerPanel({
  engine,
  clock,
  fromId,
  toId,
  routeDate,
  routeSec,
  pickMode,
  activeJourneyIndex,
  journeys,
  onSetFrom,
  onSetTo,
  onSwap,
  onSetPickMode,
  onSearch,
  onSelectJourney,
  onSimulateJourney,
  onShare,
}: RoutePlannerPanelProps) {
  const formatTimeInput = (sec: number) => {
    const hh = String(Math.floor((sec % 86400) / 3600)).padStart(2, '0');
    const mm = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
    return `${hh}:${mm}`;
  };

  const [date, setDate] = useState(routeDate || clock.date);
  const [timeStr, setTimeStr] = useState(() =>
    formatTimeInput(routeSec !== null && routeSec !== undefined ? routeSec : clock.sec),
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (routeDate) setDate(routeDate);
  }, [routeDate]);

  useEffect(() => {
    if (routeSec !== null && routeSec !== undefined) {
      setTimeStr(formatTimeInput(routeSec));
    }
  }, [routeSec]);

  const stations = useMemo(
    () => engine.allStations().sort((a, b) => a.name.localeCompare(b.name)),
    [engine],
  );
  const journeyEstimates = useMemo(
    () => tagJourneyHighlights(engine, journeys),
    [engine, journeys],
  );

  const parsedTimeSec = () => {
    const [hh, mm] = timeStr.split(':').map(Number);
    return (Number.isFinite(hh) ? hh : 7) * 3600 + (Number.isFinite(mm) ? mm : 30) * 60;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromId || !toId) {
      setErrorMsg('Pilih stasiun asal dan stasiun tujuan terlebih dahulu.');
      return;
    }
    if (fromId === toId) {
      setErrorMsg('Stasiun asal dan tujuan tidak boleh sama.');
      return;
    }
    setErrorMsg(null);
    onSearch(fromId, toId, date, parsedTimeSec());
  };

  return (
    <div className="p-4 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">Perencana Perjalanan Kereta</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Cari rute lintas KRL, MRT, LRT, Bandara, Whoosh &amp; KA Antarkota (Connection Scan Algorithm).
          </p>
        </div>
        {fromId && toId && fromId !== toId && (
          <ShareButton
            onClick={() => onShare(date, parsedTimeSec())}
            label="Bagikan"
            ariaLabel="Bagikan tautan rute perjalanan ini"
            title="Salin tautan rute perjalanan"
          />
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
        <StationAutocomplete
          label="Stasiun asal"
          valueId={fromId}
          stations={stations}
          pickActive={pickMode === 'from'}
          onSelect={(id) => {
            onSetFrom(id);
            setErrorMsg(null);
          }}
          onTogglePick={() => onSetPickMode(pickMode === 'from' ? null : 'from')}
        />

        <div className="flex items-center gap-2">
          <div className="flex-1">
            <StationAutocomplete
              label="Stasiun tujuan"
              valueId={toId}
              stations={stations}
              pickActive={pickMode === 'to'}
              onSelect={(id) => {
                onSetTo(id);
                setErrorMsg(null);
              }}
              onTogglePick={() => onSetPickMode(pickMode === 'to' ? null : 'to')}
            />
          </div>
          <button
            type="button"
            onClick={onSwap}
            aria-label="Tukar stasiun asal dan tujuan"
            title="Tukar asal & tujuan"
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
          >
            <ArrowUpDown className="w-4 h-4" />
          </button>
        </div>

        {pickMode && (
          <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
            Ketuk salah satu titik stasiun di peta untuk memilih {pickMode === 'from' ? 'asal' : 'tujuan'}.
          </p>
        )}

        <div className="grid grid-cols-2 gap-2">
          <input
            type="date"
            aria-label="Tanggal keberangkatan"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="px-2.5 py-2 rounded-lg text-xs font-mono tabular-nums bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
          />
          <input
            type="time"
            aria-label="Jam keberangkatan"
            value={timeStr}
            onChange={(e) => setTimeStr(e.target.value)}
            className="px-2.5 py-2 rounded-lg text-xs font-mono tabular-nums bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
          />
        </div>

        {errorMsg && <p className="text-xs font-medium text-red-600 dark:text-red-400">{errorMsg}</p>}

        <button
          type="submit"
          className="w-full py-2.5 rounded-lg text-xs font-semibold bg-slate-900 dark:bg-blue-600 text-white hover:bg-slate-800 dark:hover:bg-blue-500 transition-colors"
        >
          Cari Rute Terbaik
        </button>
      </form>

      {/* Popular Quick Routes */}
      {journeys.length === 0 && (
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Contoh rute populer</span>
          {[
            { label: 'Bogor → Tanah Abang (KRL + transit)', from: 'BOO', to: 'THB' },
            { label: 'Gambir → Bandung (KA Antarkota)', from: 'GMR', to: 'BD' },
            { label: 'Halim → Tegalluar (Whoosh)', from: 'HLM', to: 'TGLR' },
            { label: 'Yogyakarta → Solo Balapan', from: 'YK', to: 'SLO' },
          ].map((ex) => {
            if (!engine.st.has(ex.from) || !engine.st.has(ex.to)) return null;
            return (
              <button
                key={ex.label}
                type="button"
                onClick={() => {
                  onSetFrom(ex.from);
                  onSetTo(ex.to);
                  const [hh, mm] = timeStr.split(':').map(Number);
                  onSearch(ex.from, ex.to, date, (hh || 7) * 3600 + (mm || 30) * 60);
                }}
                className="text-left px-2.5 py-2 rounded-lg border border-slate-200/80 dark:border-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                {ex.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Results */}
      {journeys.length > 0 && (
        <div className="flex flex-col gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              {journeys.length} pilihan rute ditemukan
            </span>
            <span className="text-[11px] text-slate-400">Transit min. 3 mnt</span>
          </div>

          {journeys.map((j, idx) => {
            const selected = idx === activeJourneyIndex;
            const est = journeyEstimates[idx];
            return (
              <div
                key={idx}
                className={`rounded-xl border transition-colors ${
                  selected
                    ? 'border-blue-600 bg-blue-50/40 dark:bg-blue-950/30'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelectJourney(idx)}
                  className="w-full p-3 text-left flex flex-col gap-2"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="font-mono tabular-nums text-sm font-bold text-slate-900 dark:text-white">
                      {fmt(j.dep)} → {fmt(j.arr)}
                    </div>
                    <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 font-mono tabular-nums">
                      {dur(j.arr - j.dep)}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {j.transfers === 0 ? 'Langsung tanpa pindah kereta' : `${j.transfers} kali pindah kereta`}
                    </div>
                    {est && est.minIdr > 0 && (
                      <span className="font-mono tabular-nums text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                        Est. {est.fareText}
                      </span>
                    )}
                  </div>

                  {est && est.badges.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {est.badges.map((b) => (
                        <span
                          key={b}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            b === 'Tercepat'
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60'
                              : b === 'Hemat'
                                ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/60'
                                : 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/60'
                          }`}
                        >
                          {b}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Legs breakdown */}
                  <div className="flex flex-col gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-800/80">
                    {j.legs.map((leg, li) => {
                      const stFrom = engine.st.get(leg.from)?.name || leg.from;
                      const stTo = engine.st.get(leg.to)?.name || leg.to;
                      if (leg.walk) {
                        return (
                          <div key={li} className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                            <Footprints className="w-3.5 h-3.5 shrink-0" />
                            <span>
                              Jalan kaki {stFrom} → {stTo} ({dur(leg.dur || 180)})
                            </span>
                          </div>
                        );
                      }
                      const line = leg.trip ? engine.lines.get(leg.trip.line) : undefined;
                      const info = leg.trip ? trainDisplayInfo(leg.trip, line) : null;
                      return (
                        <div key={li} className="flex items-start gap-2 text-xs">
                          <span
                            className="w-1.5 h-8 rounded-full mt-0.5 shrink-0"
                            style={{ backgroundColor: line?.color || '#2563eb' }}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                              <TrainFront className="w-3 h-3 shrink-0 text-slate-400" />
                              <span className="truncate">{info?.name || leg.trip?.line}</span>
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              <span className="font-mono tabular-nums">{fmt(leg.dep)}</span> {stFrom} →{' '}
                              <span className="font-mono tabular-nums">{fmt(leg.arr)}</span> {stTo}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </button>

                {selected && (
                  <div className="px-3 pb-3">
                    <button
                      type="button"
                      onClick={() => onSimulateJourney(j)}
                      className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Simulasikan perjalanan di peta</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
