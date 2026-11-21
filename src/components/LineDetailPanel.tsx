import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowLeftRight, LineChart, Table2 } from 'lucide-react';
import type { Engine } from '../engine/sched';
import { fmt } from '../engine/sched';
import { SYS_LABEL, dayLabel, sourceNoteText } from '../engine/constants';
import { buildMareyDiagram, getSpecialServiceMeta } from '../engine/javaInsights';
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
  const [viewMode, setViewMode] = useState<'table' | 'marey'>('table');
  const [hoveredTripId, setHoveredTripId] = useState<string | null>(null);

  const line = engine.lines.get(lineId);
  const specialMeta = useMemo(() => getSpecialServiceMeta(line), [line]);
  const activeOnLine = useMemo(
    () => running.filter((r) => r.trip.line === lineId),
    [running, lineId],
  );
  const span = useMemo(() => (line ? engine.lineSpan(line.id, date) : null), [engine, line, date]);
  const grid = useMemo(
    () => (line && viewMode === 'table' ? engine.lineGrid(line.id, date, dir) : null),
    [engine, line, date, dir, viewMode],
  );
  const marey = useMemo(
    () => (line && viewMode === 'marey' ? buildMareyDiagram(engine, line.id, date, 90) : null),
    [engine, line, date, viewMode],
  );

  if (!line) {
    return (
      <div className="p-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali</span>
        </button>
        <p className="text-sm text-slate-500 mt-3">Jalur tidak ditemukan.</p>
      </div>
    );
  }

  const firstSt = engine.st.get(line.stations[0])?.name || line.stations[0];
  const lastSt =
    engine.st.get(line.stations[line.stations.length - 1])?.name ||
    line.stations[line.stations.length - 1];
  const dirLabel = dir === 0 ? `${firstSt} → ${lastSt}` : `${lastSt} → ${firstSt}`;
  const hoveredSeries = hoveredTripId
    ? marey?.series.find((s) => s.tripId === hoveredTripId) ?? null
    : null;

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
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: line.color }}
          />
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
        <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
          {line.name}
        </h2>
        <p className="text-xs text-slate-600 dark:text-slate-300">
          {firstSt} ↔ {lastSt} · {line.stations.length} stasiun utama
        </p>
        {specialMeta && (
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            {specialMeta.specialBadge && (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                {specialMeta.specialBadge}
              </span>
            )}
            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              Estimasi: {specialMeta.fareText}
            </span>
          </div>
        )}
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

      {/* View Mode Switcher (Tabel Jadwal vs Grafik GAPEKA Marey) + Date Controls */}
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col gap-2.5">
        <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'table'}
            onClick={() => setViewMode('table')}
            className={`py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
              viewMode === 'table'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Table2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Tabel Jadwal</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'marey'}
            data-testid="gapeka-marey-tab"
            onClick={() => setViewMode('marey')}
            className={`py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
              viewMode === 'marey'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <LineChart className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Grafik GAPEKA</span>
          </button>
        </div>

        <div className="flex items-center justify-between gap-2">
          {viewMode === 'table' ? (
            <button
              type="button"
              onClick={() => setDir((d) => (d === 0 ? 1 : 0))}
              className="flex-1 flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <span className="truncate">{dirLabel}</span>
              <ArrowLeftRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </button>
          ) : (
            <div className="flex-1 text-[11px] text-slate-600 dark:text-slate-300 flex items-center gap-3 flex-wrap">
              <span className="inline-flex items-center gap-1">
                <span className="w-3 h-0.5 rounded-full" style={{ backgroundColor: line.color }} />
                <span>Arah pergi</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-3 h-0.5 rounded-full bg-amber-500" />
                <span>Arah balik</span>
              </span>
            </div>
          )}
          <input
            type="date"
            aria-label="Tanggal jadwal jalur"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="px-2 py-2 rounded-lg text-xs font-mono tabular-nums bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
          />
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          {dayLabel(date, engine.net.holidays)} ·{' '}
          {viewMode === 'table'
            ? `${grid?.trips.length ?? 0} perjalanan arah ini`
            : `${marey?.series.length ?? 0} grafik perjalanan (ketuk garis KA untuk detail)`}
        </p>
      </div>

      {/* Main Content: Timetable Matrix OR Interactive Marey GAPEKA Diagram */}
      <div className="p-4 flex flex-col gap-3">
        {viewMode === 'marey' ? (
          marey && marey.series.length > 0 ? (
            <div className="flex flex-col gap-2" data-testid="gapeka-marey-chart">
              {hoveredSeries && (
                <div className="px-2.5 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-800 text-white text-[11px] flex items-center justify-between gap-2">
                  <span className="font-semibold truncate">
                    KA {hoveredSeries.tripId.replace(/^[a-z]+-/, '')} → {hoveredSeries.head}
                  </span>
                  <span className="font-mono tabular-nums text-amber-300 shrink-0">
                    {fmt(hoveredSeries.startSec)} – {fmt(hoveredSeries.endSec)}
                  </span>
                </div>
              )}

              <div className="overflow-x-auto sepur-scroll border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/80 p-2">
                {(() => {
                  const stCount = Math.max(2, marey.stations.length);
                  const rowH = Math.max(16, Math.min(26, Math.floor(320 / stCount)));
                  const padTop = 22;
                  const padBottom = 18;
                  const padLeft = 86;
                  const padRight = 14;
                  const hoursSpan = Math.max(2, (marey.maxSec - marey.minSec) / 3600);
                  const plotW = Math.max(320, Math.min(900, Math.round(hoursSpan * 42)));
                  const plotH = (stCount - 1) * rowH;
                  const svgW = padLeft + plotW + padRight;
                  const svgH = padTop + plotH + padBottom;

                  const xOf = (sec: number) =>
                    padLeft + ((sec - marey.minSec) / (marey.maxSec - marey.minSec)) * plotW;
                  const yOf = (idx: number) =>
                    padTop + (idx / Math.max(1, stCount - 1)) * plotH;

                  const startHr = Math.floor(marey.minSec / 3600);
                  const endHr = Math.ceil(marey.maxSec / 3600);
                  const hrStep = hoursSpan > 14 ? 2 : 1;
                  const hourTicks: number[] = [];
                  for (let h = startHr; h <= endHr; h += hrStep) hourTicks.push(h);

                  // Label every Nth station if very many stops so labels never overlap
                  const stLabelStep = stCount > 18 ? Math.ceil(stCount / 14) : 1;
                  const showNowLine =
                    date === clock.date &&
                    clock.sec >= marey.minSec &&
                    clock.sec <= marey.maxSec;

                  return (
                    <svg
                      width={svgW}
                      height={svgH}
                      viewBox={`0 0 ${svgW} ${svgH}`}
                      role="img"
                      aria-label={`Diagram GAPEKA ${line.name}`}
                      className="block select-none"
                    >
                      {/* Vertical hour grid lines */}
                      {hourTicks.map((h) => {
                        const x = xOf(h * 3600);
                        return (
                          <g key={`hr-${h}`}>
                            <line
                              x1={x}
                              y1={padTop}
                              x2={x}
                              y2={padTop + plotH}
                              stroke="currentColor"
                              className="text-slate-200 dark:text-slate-800"
                              strokeWidth={1}
                            />
                            <text
                              x={x}
                              y={13}
                              textAnchor="middle"
                              className="fill-slate-500 dark:fill-slate-400 text-[9px] font-mono"
                            >
                              {String(h % 24).padStart(2, '0')}.00
                            </text>
                          </g>
                        );
                      })}

                      {/* Horizontal station lines & names */}
                      {marey.stations.map((st, idx) => {
                        const y = yOf(idx);
                        const showLabel =
                          idx === 0 ||
                          idx === stCount - 1 ||
                          idx % stLabelStep === 0;
                        return (
                          <g key={st.id}>
                            <line
                              x1={padLeft}
                              y1={y}
                              x2={padLeft + plotW}
                              y2={y}
                              stroke="currentColor"
                              className="text-slate-100 dark:text-slate-800/80"
                              strokeWidth={1}
                            />
                            {showLabel && (
                              <text
                                x={padLeft - 6}
                                y={y + 3}
                                textAnchor="end"
                                onClick={() => onOpenStation(st.id)}
                                className="fill-slate-600 dark:fill-slate-300 text-[9px] font-medium cursor-pointer hover:fill-blue-600"
                              >
                                {st.name.length > 13 ? `${st.name.slice(0, 12)}…` : st.name}
                              </text>
                            )}
                          </g>
                        );
                      })}

                      {/* Train trajectories (clickable polylines) */}
                      {marey.series.map((s) => {
                        const pts = s.points
                          .map((p) => `${xOf(p.timeSec).toFixed(1)},${yOf(p.stationIndex).toFixed(1)}`)
                          .join(' ');
                        const isHovered = hoveredTripId === s.tripId;
                        const stroke = s.dir === 0 ? marey.lineColor : '#F59E0B';
                        return (
                          <polyline
                            key={`${s.tripId}-${s.startSec}`}
                            points={pts}
                            fill="none"
                            stroke={stroke}
                            strokeWidth={isHovered ? 2.8 : 1.35}
                            strokeOpacity={hoveredTripId && !isHovered ? 0.25 : 0.88}
                            className="cursor-pointer transition-opacity"
                            onMouseEnter={() => setHoveredTripId(s.tripId)}
                            onMouseLeave={() => setHoveredTripId(null)}
                            onClick={() => onOpenTrain(s.tripId, s.tripDate)}
                          >
                            <title>
                              KA {s.tripId.replace(/^[a-z]+-/, '')} → {s.head} ({fmt(s.startSec)}–{fmt(s.endSec)})
                            </title>
                          </polyline>
                        );
                      })}

                      {/* Live WIB "Sekarang" vertical cursor */}
                      {showNowLine && (
                        <g>
                          <line
                            x1={xOf(clock.sec)}
                            y1={padTop - 4}
                            x2={xOf(clock.sec)}
                            y2={padTop + plotH + 4}
                            stroke="#EF4444"
                            strokeWidth={1.6}
                            strokeDasharray="3 2"
                          />
                          <circle
                            cx={xOf(clock.sec)}
                            cy={padTop - 4}
                            r={3}
                            fill="#EF4444"
                          />
                        </g>
                      )}
                    </svg>
                  );
                })()}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Diagram Marey menampilkan grafik ruang-waktu resmi GAPEKA. Titik silang garis menunjukkan jadwal persilangan KA berlawanan arah.
              </p>
            </div>
          ) : (
            <p className="text-xs text-slate-500 text-center py-6">
              Data grafik GAPEKA tidak tersedia untuk tanggal yang dipilih.
            </p>
          )
        ) : grid && grid.trips.length > 0 ? (
          <div className="overflow-x-auto sepur-scroll border border-slate-200 dark:border-slate-800 rounded-lg">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                  <th className="sticky left-0 z-10 bg-slate-50 dark:bg-slate-800 text-left px-2.5 py-2 font-semibold text-slate-700 dark:text-slate-200 min-w-[125px] border-r border-slate-200 dark:border-slate-700">
                    Stasiun
                  </th>
                  {grid.trips.slice(0, 28).map((tr) => (
                    <th
                      key={tr.key}
                      className="px-2 py-2 font-mono tabular-nums font-semibold text-slate-700 dark:text-slate-300 text-center whitespace-nowrap"
                    >
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
