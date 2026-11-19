import { useMemo, useState } from 'react';
import { ArrowLeft, Building2, Navigation, Star } from 'lucide-react';
import type { Engine } from '../engine/sched';
import { fmt } from '../engine/sched';
import {
  SYS_SHORT,
  dayLabel,
  formatWait,
  trainDisplayInfo,
} from '../engine/constants';
import type { ClockState, StationsExtraData } from '../engine/types';
import { ShareButton } from './ShareButton';

interface StationDetailPanelProps {
  engine: Engine;
  stationId: string;
  clock: ClockState;
  stationsExtra: StationsExtraData | null;
  isFavorite: boolean;
  onBack: () => void;
  onShare: () => void;
  onToggleFavorite: (id: string) => void;
  onOpenTrain: (id: string, date: string) => void;
  onOpenLine: (id: string) => void;
  onPlanFrom: (id: string) => void;
  onPlanTo: (id: string) => void;
}

export function StationDetailPanel({
  engine,
  stationId,
  clock,
  stationsExtra,
  isFavorite,
  onBack,
  onShare,
  onToggleFavorite,
  onOpenTrain,
  onOpenLine,
  onPlanFrom,
  onPlanTo,
}: StationDetailPanelProps) {
  const [boardMode, setBoardMode] = useState<'live' | 'full'>('live');
  const [scheduleDate, setScheduleDate] = useState(clock.date);
  const [dirFilter, setDirFilter] = useState<string>('all');
  const [imgFailed, setImgFailed] = useState(false);

  const station = engine.st.get(stationId);
  const extra = stationsExtra?.s?.[stationId];

  const departures = useMemo(
    () => (station ? engine.departures(station.id, clock, 36, 8 * 3600) : []),
    [engine, station, clock.date, Math.floor(clock.sec / 30)],
  );

  const fullDay = useMemo(
    () => (station && boardMode === 'full' ? engine.stationDay(station.id, scheduleDate) : null),
    [engine, station, boardMode, scheduleDate],
  );

  if (!station) {
    return (
      <div className="p-4">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-xs font-semibold">
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali</span>
        </button>
        <p className="text-sm text-slate-500 mt-3">Stasiun tidak ditemukan.</p>
      </div>
    );
  }

  const lines = (station.lines || []).map((lid) => engine.lines.get(lid)).filter(Boolean);

  return (
    <div className="flex flex-col">
      {/* Top Bar */}
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali</span>
        </button>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onToggleFavorite(station.id)}
            aria-pressed={isFavorite}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 min-h-[36px] rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
              isFavorite
                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Star className={`w-3.5 h-3.5 ${isFavorite ? 'fill-amber-500 text-amber-500' : ''}`} />
            <span>{isFavorite ? 'Stasiunku' : 'Simpan'}</span>
          </button>
          <ShareButton
            onClick={onShare}
            ariaLabel={`Bagikan tautan Stasiun ${station.name}`}
            title="Salin tautan stasiun ini"
          />
        </div>
      </div>

      {/* Station Header + Wikimedia Photo */}
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            <span>{station.id}</span>
            {extra?.daop && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-sans">{extra.daop}</span>
              </>
            )}
            {extra?.km && (
              <>
                <span aria-hidden="true">·</span>
                <span>KM {extra.km}</span>
              </>
            )}
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
            Stasiun {station.name}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {station.sys.map((s) => SYS_SHORT[s]).join(' · ')}
          </p>
        </div>

        {/* Station Photo */}
        {extra?.img?.t && !imgFailed ? (
          <figure className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800">
            <img
              src={extra.img.t}
              alt={`Foto Stasiun ${station.name}`}
              referrerPolicy="no-referrer"
              onError={() => setImgFailed(true)}
              className="w-full h-36 object-cover"
            />
            <figcaption className="px-2.5 py-1.5 text-[11px] text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 flex items-center justify-between gap-2">
              <span className="truncate">Foto: {extra.img.a}</span>
              <a
                href={extra.img.p}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline shrink-0"
              >
                {extra.img.l}
              </a>
            </figcaption>
          </figure>
        ) : (
          <div className="rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 px-3 py-2.5 flex items-center gap-2.5 text-xs text-slate-500 dark:text-slate-400">
            <Building2 className="w-4 h-4 shrink-0 text-slate-400" />
            <span>
              {station.lat.toFixed(4)}°, {station.lng.toFixed(4)}° ·{' '}
              {lines.length} layanan rel terhubung
            </span>
          </div>
        )}

        {/* Quick Route Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPlanFrom(station.id)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 dark:bg-blue-600 text-white hover:bg-slate-800 dark:hover:bg-blue-500 transition-colors"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>Berangkat dari sini</span>
          </button>
          <button
            type="button"
            onClick={() => onPlanTo(station.id)}
            className="flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            Tujuan ke sini
          </button>
        </div>

        {/* Lines Serving Station */}
        {lines.length > 0 && (
          <div className="flex flex-wrap gap-x-3 gap-y-1.5 pt-1">
            {lines.slice(0, 10).map((l) => (
              <button
                key={l!.id}
                type="button"
                onClick={() => onOpenLine(l!.id)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: l!.color }} />
                <span>{l!.svc || l!.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Mode Switcher: Live Departures vs Full Day Schedule */}
      <div className="px-4 pt-3 pb-2 flex items-center justify-between gap-2">
        <div className="flex items-center p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={boardMode === 'live'}
            onClick={() => setBoardMode('live')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              boardMode === 'live'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Papan langsung
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={boardMode === 'full'}
            onClick={() => setBoardMode('full')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              boardMode === 'full'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Jadwal sehari
          </button>
        </div>

        {boardMode === 'full' && (
          <input
            type="date"
            aria-label="Tanggal jadwal stasiun"
            value={scheduleDate}
            onChange={(e) => e.target.value && setScheduleDate(e.target.value)}
            className="text-xs font-mono tabular-nums bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-lg px-2 py-1"
          />
        )}
      </div>

      {/* Live Departure Board */}
      {boardMode === 'live' ? (
        <div className="px-4 pb-4">
          {departures.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 py-6 text-center">
              Tidak ada keberangkatan terjadwal dalam 8 jam ke depan.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {departures.map((d) => {
                const line = engine.lines.get(d.trip.line);
                const info = trainDisplayInfo(d.trip, line);
                return (
                  <button
                    key={`${d.trip.key}-${d.i}`}
                    type="button"
                    onClick={() => onOpenTrain(d.trip.id, d.trip.date)}
                    className="w-full py-2.5 flex items-center justify-between gap-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded px-1.5 -mx-1.5 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-1.5 h-8 rounded-full shrink-0"
                        style={{ backgroundColor: line?.color || '#64748b' }}
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {d.trip.head}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {info.name} · KA {info.num}
                          {d.trip.freight ? ' · KA barang' : ''}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono tabular-nums text-xs font-bold text-slate-900 dark:text-white">
                        {fmt(d.dep)}
                      </div>
                      <div
                        className={`font-mono tabular-nums text-[11px] font-medium ${
                          d.wait <= 120
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-blue-600 dark:text-blue-400'
                        }`}
                      >
                        {formatWait(d.wait)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="px-4 pb-4 flex flex-col gap-3">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            {dayLabel(scheduleDate, engine.net.holidays)} · {fullDay?.rows.length ?? 0} perjalanan
          </div>
          {fullDay && fullDay.groups.length > 1 && (
            <select
              aria-label="Filter arah tujuan"
              value={dirFilter}
              onChange={(e) => setDirFilter(e.target.value)}
              className="w-full px-2.5 py-2 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
            >
              <option value="all">Semua arah ({fullDay.rows.length})</option>
              {fullDay.groups.map(([head, items]) => (
                <option key={head} value={head}>
                  Tujuan {head} ({items.length})
                </option>
              ))}
            </select>
          )}
          <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {(fullDay?.rows || [])
              .filter((r) => dirFilter === 'all' || (r.terminates ? 'Tiba (stasiun akhir)' : r.trip.head) === dirFilter)
              .slice(0, 120)
              .map((r) => {
                const line = engine.lines.get(r.trip.line);
                const info = trainDisplayInfo(r.trip, line);
                return (
                  <button
                    key={`${r.trip.key}-${r.i}`}
                    type="button"
                    onClick={() => onOpenTrain(r.trip.id, r.trip.date)}
                    className="w-full py-2 flex items-center justify-between gap-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded px-1 -mx-1"
                  >
                    <div className="min-w-0 flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: line?.color || '#64748b' }}
                      />
                      <span className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                        {r.terminates ? `Tiba (${info.name})` : r.trip.head}
                      </span>
                    </div>
                    <div className="font-mono tabular-nums text-xs font-semibold text-slate-900 dark:text-white shrink-0">
                      {fmt(r.dep)}
                    </div>
                  </button>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
