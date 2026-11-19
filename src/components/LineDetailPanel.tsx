import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowLeftRight } from 'lucide-react';
import type { Engine } from '../engine/sched';
import { fmt } from '../engine/sched';
import { SYS_LABEL, dayLabel, sourceNoteText } from '../engine/constants';
import type { ClockState, RunningTrain } from '../engine/types';
import { ShareButton } from './ShareButton';

interface LineDetailPanelProps {
  engine: Engine;
  lineId: string;
  clock: ClockState;
  running: RunningTrain[];
  onBack: () => void;
  onShare: () => void;
  onOpenTrain: (id: string, date: string) => void;
  onOpenStation: (id: string) => void;
}

export function LineDetailPanel({
  engine,
  lineId,
  clock,
  running,
  onBack,
  onShare,
  onOpenTrain,
  onOpenStation,
}: LineDetailPanelProps) {
  const [dir, setDir] = useState<0 | 1>(0);
  const [date, setDate] = useState(clock.date);

  const line = engine.lines.get(lineId);
  const activeOnLine = useMemo(
    () => running.filter((r) => r.trip.line === lineId),
    [running, lineId],
  );
  const span = useMemo(() => (line ? engine.lineSpan(line.id, date) : null), [engine, line, date]);
  const grid = useMemo(() => (line ? engine.lineGrid(line.id, date, dir) : null), [engine, line, date, dir]);

  if (!line) {
    return (
      <div className="p-4">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-xs font-semibold">
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali</span>
        </button>
        <p className="text-sm text-slate-500 mt-3">Jalur tidak ditemukan.</p>
      </div>
    );
  }

  const firstSt = engine.st.get(line.stations[0])?.name || line.stations[0];
  const lastSt = engine.st.get(line.stations[line.stations.length - 1])?.name || line.stations[line.stations.length - 1];
  const dirLabel = dir === 0 ? `${firstSt} → ${lastSt}` : `${lastSt} → ${firstSt}`;

  return (
    <div className="flex flex-col">
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali</span>
        </button>
        <div className="flex items-center gap-2">
          <span className="font-mono tabular-nums text-xs text-slate-500 dark:text-slate-400">
            {activeOnLine.length} aktif
          </span>
          <ShareButton
            onClick={onShare}
            ariaLabel={`Bagikan tautan ${line.name}`}
            title="Salin tautan jalur ini"
          />
        </div>
      </div>

      {/* Header */}
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col gap-2">
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: line.color }} />
          <span>{SYS_LABEL[line.sys]}</span>
          {span && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {span.count} perjalanan ({fmt(span.first)}–{fmt(span.last)})
              </span>
            </>
          )}
        </div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">{line.name}</h2>
        <p className="text-xs text-slate-600 dark:text-slate-300">
          {firstSt} ↔ {lastSt} · {line.stations.length} stasiun utama
        </p>
      </div>

      {/* Active trains right now on this line */}
      {activeOnLine.length > 0 && (
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col gap-2">
          <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Sedang beroperasi ({activeOnLine.length})
          </h3>
          <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800/70">
            {activeOnLine.slice(0, 8).map((r) => (
              <button
                key={r.trip.key}
                type="button"
                onClick={() => onOpenTrain(r.trip.id, r.trip.date)}
                className="py-2 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded px-1 -mx-1"
              >
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                  KA {r.trip.id.replace(/^[a-z]+-/, '')} → {r.trip.head}
                </span>
                <span className="font-mono tabular-nums text-[11px] text-blue-600 dark:text-blue-400 shrink-0">
                  {Math.round(r.s.progress * 100)}%
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Direction & Date Controls */}
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setDir((d) => (d === 0 ? 1 : 0))}
            className="flex-1 flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <span className="truncate">{dirLabel}</span>
            <ArrowLeftRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          </button>
          <input
            type="date"
            aria-label="Tanggal jadwal jalur"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="px-2 py-2 rounded-lg text-xs font-mono tabular-nums bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
          />
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          {dayLabel(date, engine.net.holidays)} · {grid?.trips.length ?? 0} perjalanan arah ini
        </p>
      </div>

      {/* Scrollable Timetable Matrix */}
      <div className="p-4 flex flex-col gap-3">
        {grid && grid.trips.length > 0 ? (
          <div className="overflow-x-auto sepur-scroll border border-slate-200 dark:border-slate-800 rounded-lg">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                  <th className="sticky left-0 z-10 bg-slate-50 dark:bg-slate-800 text-left px-2.5 py-2 font-semibold text-slate-700 dark:text-slate-200 min-w-[125px] border-r border-slate-200 dark:border-slate-700">
                    Stasiun
                  </th>
                  {grid.trips.slice(0, 28).map((tr) => (
                    <th key={tr.key} className="px-2 py-2 font-mono tabular-nums font-semibold text-slate-700 dark:text-slate-300 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onOpenTrain(tr.id, tr.date)}
                        className="hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
                      >
                        {tr.id.replace(/^[a-z]+-/, '')}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {grid.rows.map((row) => {
                  const st = engine.st.get(row.sid);
                  return (
                    <tr key={row.sid} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="sticky left-0 z-10 bg-white dark:bg-slate-900 px-2.5 py-1.5 font-medium text-slate-800 dark:text-slate-200 border-r border-slate-100 dark:border-slate-800 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onOpenStation(row.sid)}
                          className="hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
                        >
                          {st?.name || row.sid}
                        </button>
                      </td>
                      {grid.trips.slice(0, 28).map((tr, col) => {
                        const val = row.cells[col];
                        return (
                          <td
                            key={tr.key}
                            className="px-2 py-1.5 text-center font-mono tabular-nums text-[11px] text-slate-600 dark:text-slate-300 whitespace-nowrap"
                          >
                            {val === undefined ? '·' : val === -1 ? '│' : fmt(val)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-slate-500 text-center py-6">
            Tidak ada perjalanan untuk arah ini pada tanggal yang dipilih.
          </p>
        )}

        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
          {sourceNoteText(line)}
        </p>
      </div>
    </div>
  );
}
