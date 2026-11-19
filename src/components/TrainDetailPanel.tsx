import { memo, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Box,
  Clock,
  Crosshair,
  FastForward,
  Navigation,
  Radio,
  TrainFront,
} from 'lucide-react';
import type { Engine } from '../engine/sched';
import { dur, fmt } from '../engine/sched';
import { computeStopLegSpeeds } from '../engine/analytics';
import {
  clampSpeedKmh,
  fleetKey,
  formatDistanceKm,
  formatWait,
  sourceNoteText,
  trainDisplayInfo,
} from '../engine/constants';
import {
  computeNextStationEta,
  formatCountdown,
  formatRealCountdown,
} from '../engine/eta';
import {
  type LiveGpsFix,
  buildConsistSummary,
  formatScheduleDelta,
  snapGpsToTrip,
} from '../engine/gps';
import type { ClockState, FleetMap } from '../engine/types';
import { ShareButton } from './ShareButton';

interface TrainDetailPanelProps {
  engine: Engine;
  trainId: string;
  trainDate: string;
  clock: ClockState;
  simSpeed: number;
  simPaused: boolean;
  threeD: boolean;
  fleet: FleetMap | null;
  followTrain: boolean;
  gpsTracking: boolean;
  gpsFix: LiveGpsFix | null;
  gpsError: string | null;
  onBack: () => void;
  onShare: () => void;
  onToggleFollow: () => void;
  onToggle3DView: () => void;
  onToggleGpsTracking: () => void;
  onFastForward: () => void;
  onOpenStation: (id: string) => void;
  onOpenLine: (id: string) => void;
}

export const TrainDetailPanel = memo(function TrainDetailPanel({
  engine,
  trainId,
  trainDate,
  clock,
  simSpeed,
  simPaused,
  threeD,
  fleet,
  followTrain,
  gpsTracking,
  gpsFix,
  gpsError,
  onBack,
  onShare,
  onToggleFollow,
  onToggle3DView,
  onToggleGpsTracking,
  onFastForward,
  onOpenStation,
  onOpenLine,
}: TrainDetailPanelProps) {
  const [showPassThrough, setShowPassThrough] = useState(false);
  const [selectedCarIdx, setSelectedCarIdx] = useState<number | null>(null);
  const [imgFailed, setImgFailed] = useState(false);

  const found = engine.find(trainId, clock, trainDate);
  const trip = found?.trip;
  const line = trip ? engine.lines.get(trip.line) : undefined;
  const t = found?.t ?? clock.sec;
  const state = trip ? engine.state(trip, t) : null;
  const profile = useMemo(() => (trip ? engine.speedProfile(trip, 160) : null), [engine, trip]);
  const legSpeeds = useMemo(
    () => (trip ? computeStopLegSpeeds(engine, trip) : []),
    [engine, trip],
  );
  const consist = useMemo(() => (line ? buildConsistSummary(line) : null), [line]);
  const gpsMatch = useMemo(
    () => (trip && gpsTracking && gpsFix ? snapGpsToTrip(engine, trip, clock, gpsFix) : null),
    [engine, trip, clock, gpsTracking, gpsFix],
  );
  const nextEta = useMemo(
    () =>
      trip
        ? computeNextStationEta({
            engine,
            trip,
            t,
            state,
            simSpeed,
            simPaused,
            gpsMatch,
          })
        : null,
    [engine, trip, t, state, simSpeed, simPaused, gpsMatch],
  );

  if (!trip || !line) {
    return (
      <div className="p-4 flex flex-col gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white min-h-[36px]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali</span>
        </button>
        <p className="text-sm text-slate-500">Perjalanan kereta tidak ditemukan pada tanggal ini.</p>
      </div>
    );
  }

  const info = trainDisplayInfo(trip, line);
  const fk = fleetKey(line);
  const fleetItem = fleet?.[fk];
  const schedKmh = state?.kind === 'run' ? clampSpeedKmh(state.v ?? 0, line) : 0;
  const curKmh =
    gpsMatch && gpsMatch.onCorridor && gpsMatch.gpsKmh !== null ? gpsMatch.gpsKmh : schedKmh;
  const avgKmh = profile ? clampSpeedKmh(profile.avg, line) : 0;
  const peakKmh = profile ? clampSpeedKmh(profile.vmax, line) : 0;
  const originName = engine.st.get(trip.sids[0])?.name || trip.sids[0];
  const destName = engine.st.get(trip.sids[trip.sids.length - 1])?.name || trip.head;

  // Determine current petak & status string (preferring on-corridor Live GPS when active)
  let statusLine = 'Perjalanan selesai';
  let nextStationLabel: string | null = null;
  let currentPetakLabel: string | null = null;
  let runningSegIndex: number | null = null;

  if (gpsMatch && gpsMatch.onCorridor) {
    runningSegIndex = gpsMatch.segIndex;
    const fromName = engine.st.get(gpsMatch.fromStationId)?.name || gpsMatch.fromStationId;
    const toName = engine.st.get(gpsMatch.toStationId)?.name || gpsMatch.toStationId;
    const nextName = engine.st.get(gpsMatch.nextStopStationId)?.name || gpsMatch.nextStopStationId;
    currentPetakLabel = `Petak ${fromName} – ${toName}`;
    statusLine = `Terkunci Live GPS menuju ${nextName}`;
    nextStationLabel = `Sisa ±${formatDistanceKm(gpsMatch.distToNextStopMeters)} ke ${nextName}`;
  } else if (t < trip.dep[0]) {
    statusLine = `Berangkat ${formatWait(trip.dep[0] - t)} lagi dari ${originName}`;
  } else if (state?.kind === 'dwell' && state.at !== undefined) {
    const stName = engine.st.get(trip.sids[state.at])?.name || trip.sids[state.at];
    const leaveIn = trip.dep[state.at] - t;
    statusLine =
      state.at === trip.sids.length - 1
        ? `Tiba di stasiun akhir ${stName}`
        : `Berhenti di ${stName}${leaveIn > 5 ? ` · berangkat ${formatWait(leaveIn)}` : ''}`;
  } else if (state?.kind === 'run') {
    const nsIdx = state.nextStop ?? state.next ?? trip.sids.length - 1;
    const nsName = engine.st.get(trip.sids[nsIdx])?.name || trip.sids[nsIdx];
    const eta = Math.max(0, trip.arr[nsIdx] - t);
    statusLine = `Berjalan menuju ${nsName}`;
    nextStationLabel = `Tiba dalam ${formatWait(eta)} (${fmt(trip.arr[nsIdx])})`;
    if (state.from !== undefined && state.from < trip.sids.length - 1) {
      runningSegIndex = state.from;
      const segA = engine.st.get(trip.sids[state.from])?.name || trip.sids[state.from];
      const segB = engine.st.get(trip.sids[state.from + 1])?.name || trip.sids[state.from + 1];
      currentPetakLabel = `Petak ${segA} – ${segB}`;
    }
  }

  const deltaInfo = gpsMatch && gpsMatch.onCorridor ? formatScheduleDelta(gpsMatch.scheduleDeltaSec) : null;
  const activeProgress =
    gpsMatch && gpsMatch.onCorridor
      ? gpsMatch.progress
      : (state?.progress ?? (t > trip.arr[trip.arr.length - 1] ? 1 : 0));

  // Build SVG Speed Profile Chart
  const svgW = 320;
  const svgH = 92;
  const padL = 28;
  const padR = 6;
  const padT = 8;
  const padB = 12;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;
  const rawMaxV = Math.max(20, ...((profile?.pts || []).map((p) => clampSpeedKmh(p[1], line))));
  const yTop = Math.ceil(rawMaxV / 20) * 20;
  const yMid = Math.round(yTop / 2);
  const tStart = trip.dep[0];
  const tEnd = trip.arr[trip.arr.length - 1];
  const spanT = Math.max(1, tEnd - tStart);

  const coords = (profile?.pts || []).map(([pt, pv]) => {
    const x = padL + ((pt - tStart) / spanT) * plotW;
    const kmh = clampSpeedKmh(pv, line);
    const y = padT + plotH - (kmh / yTop) * plotH;
    return [x, y] as [number, number];
  });
  const linePoints = coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const areaPath =
    coords.length > 1
      ? `M ${coords[0][0].toFixed(1)},${(padT + plotH).toFixed(1)} ` +
        coords.map(([x, y]) => `L ${x.toFixed(1)},${y.toFixed(1)}`).join(' ') +
        ` L ${coords[coords.length - 1][0].toFixed(1)},${(padT + plotH).toFixed(1)} Z`
      : '';
  const nowX = padL + Math.max(0, Math.min(1, (t - tStart) / spanT)) * plotW;
  const stopTicks = trip.sids
    .map((_, idx) => (trip.flags[idx] & 1 ? padL + ((trip.arr[idx] - tStart) / spanT) * plotW : null))
    .filter((v): v is number => v !== null);

  const stopsCount = trip.flags.filter((f) => f & 1).length;
  const passCount = trip.sids.length - stopsCount;
  const focusedCar =
    consist && selectedCarIdx !== null && consist.cars[selectedCarIdx]
      ? consist.cars[selectedCarIdx]
      : null;

  return (
    <div className="flex flex-col">
      {/* Top Bar */}
      <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white min-h-[36px] pr-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali</span>
        </button>
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            type="button"
            onClick={() => onOpenLine(line.id)}
            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline truncate max-w-[140px] min-h-[36px] inline-flex items-center px-1"
          >
            Jadwal jalur
          </button>
          <ShareButton
            onClick={onShare}
            ariaLabel={`Bagikan tautan ${info.name}`}
            title="Salin tautan kereta ini"
          />
        </div>
      </div>

      {/* Header & Live Positioning Status */}
      <div className="p-4 flex flex-col gap-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: line.color }}
              />
              <span>KA {info.num}</span>
              <span aria-hidden="true">·</span>
              <span className="truncate">
                {trip.freight ? 'KA Barang' : consist?.formationLabel || line.short}
              </span>
              {trip.est && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-amber-600 dark:text-amber-400 font-medium">Perkiraan</span>
                </>
              )}
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mt-1 leading-tight">
              {info.name}
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
              {originName} → {destName} · {fmt(trip.dep[0])}–{fmt(trip.arr[trip.arr.length - 1])} ({dur(tEnd - tStart)})
            </p>
          </div>
          <span
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs"
            style={{ backgroundColor: line.color }}
            aria-hidden="true"
          >
            <TrainFront className="w-4 h-4" />
          </span>
        </div>

        {/* Live Status & Source Switcher (GAPEKA 2026 / Live GPS Perangkat) */}
        <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 rounded-xl p-3 flex flex-col gap-2.5">
          {/* Position Source Row */}
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200/70 dark:border-slate-700/70">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300 min-w-0">
              <Radio
                className={`w-3.5 h-3.5 shrink-0 ${
                  gpsMatch?.onCorridor
                    ? 'text-emerald-500'
                    : gpsTracking
                      ? 'text-amber-500'
                      : 'text-blue-600 dark:text-blue-400'
                }`}
                aria-hidden="true"
              />
              <span className="truncate">
                {gpsMatch?.onCorridor
                  ? 'Live GPS · Terkunci di rel'
                  : gpsTracking
                    ? 'Mencari sinyal GPS di koridor…'
                    : 'Posisi Live · GAPEKA 2026'}
              </span>
            </div>
            <button
              type="button"
              onClick={onToggleGpsTracking}
              aria-pressed={gpsTracking}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors shrink-0 touch-manipulation ${
                gpsTracking
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Navigation className="w-3 h-3" />
              <span>{gpsTracking ? 'GPS Aktif' : 'Live GPS'}</span>
            </button>
          </div>

          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-900 dark:text-white">{statusLine}</p>
              {currentPetakLabel && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                  {currentPetakLabel}
                </p>
              )}
              {deltaInfo && (
                <p
                  className={`text-[11px] font-semibold mt-0.5 ${
                    deltaInfo.tone === 'ontime'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : deltaInfo.tone === 'late'
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-blue-600 dark:text-blue-400'
                  }`}
                >
                  {deltaInfo.label} · akurasi ±{Math.round(gpsFix?.accuracy ?? 0)} m
                </p>
              )}
              {gpsTracking && gpsMatch && !gpsMatch.onCorridor && (
                <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">
                  Perangkat berjarak ±{formatDistanceKm(gpsMatch.offTrackMeters)} dari lintas KA ini — menampilkan posisi GAPEKA.
                </p>
              )}
              {gpsTracking && gpsError && (
                <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5">{gpsError}</p>
              )}
            </div>
            <div className="text-right shrink-0">
              <div className="font-mono tabular-nums text-lg font-bold text-slate-900 dark:text-white leading-none">
                {curKmh}
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 ml-0.5">
                  km/j
                </span>
              </div>
              <span className="text-[10px] text-slate-400">
                {gpsMatch?.onCorridor && gpsMatch.gpsKmh !== null ? 'sensor GPS' : 'menurut GAPEKA'}
              </span>
            </div>
          </div>

          {/* Estimated Arrival & Live Countdown Card (Schedule + Simulation Speed) */}
          {nextEta && nextEta.status !== 'finished' && (
            <div
              data-testid="next-station-eta-card"
              className="rounded-lg bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-700/80 px-2.5 py-2 flex flex-col gap-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    <Clock className="w-3 h-3 text-blue-600 dark:text-blue-400 shrink-0" aria-hidden="true" />
                    <span className="truncate">
                      {nextEta.status === 'upcoming'
                        ? 'Jadwal berangkat awal'
                        : nextEta.source === 'gps'
                          ? 'Estimasi tiba (Live GPS)'
                          : 'Estimasi tiba berikutnya'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenStation(nextEta.stationId)}
                    className="text-xs font-bold text-slate-900 dark:text-white hover:underline truncate block max-w-full mt-0.5"
                  >
                    {nextEta.stationName}
                    {nextEta.distanceMeters > 0 && (
                      <span className="font-normal text-slate-500 dark:text-slate-400">
                        {' '}· {formatDistanceKm(nextEta.distanceMeters)}
                      </span>
                    )}
                  </button>
                </div>

                <div className="text-right shrink-0">
                  <div
                    data-testid="eta-countdown-value"
                    className="font-mono tabular-nums text-sm font-bold text-blue-600 dark:text-blue-400 leading-tight"
                  >
                    {formatCountdown(nextEta.remainingSimSec)}
                  </div>
                  <div className="font-mono tabular-nums text-[10px] text-slate-500 dark:text-slate-400">
                    {nextEta.status === 'upcoming' ? 'berangkat ' : 'tiba '}
                    {fmt(nextEta.estimatedArrSec)} WIB
                  </div>
                </div>
              </div>

              {/* Simulation-speed aware real-time countdown bar */}
              <div className="flex items-center justify-between gap-2 text-[10px] text-slate-500 dark:text-slate-400">
                <span>
                  {simPaused
                    ? 'Hitung mundur dijeda'
                    : simSpeed > 1 && nextEta.remainingRealSec !== null
                      ? `Simulasi ${simSpeed}× · ~${formatRealCountdown(nextEta.remainingRealSec)} waktu nyata`
                      : nextStationLabel || 'Kecepatan waktu nyata (1×)'}
                </span>
                {nextEta.status === 'running' && (
                  <span className="font-mono tabular-nums shrink-0">
                    {Math.round(nextEta.legProgress * 100)}% petak
                  </span>
                )}
              </div>

              {/* Leg Countdown Progress Bar */}
              <div className="w-full h-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.round(nextEta.legProgress * 100)}%`,
                    backgroundColor: nextEta.source === 'gps' ? '#10B981' : '#2563EB',
                  }}
                />
              </div>
            </div>
          )}

          {/* Overall Trip Progress Bar */}
          <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${Math.round(activeProgress * 100)}%`,
                backgroundColor: gpsMatch?.onCorridor ? '#10B981' : line.color,
              }}
            />
          </div>

          <div className="grid grid-cols-3 gap-1.5 pt-0.5">
            <button
              type="button"
              onClick={onToggleFollow}
              aria-pressed={followTrain}
              className={`flex items-center justify-center gap-1 px-2 py-2 min-h-[38px] rounded-xl text-[11px] font-semibold transition-colors touch-manipulation ${
                followTrain
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Crosshair className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{followTrain ? 'Diikuti' : 'Ikuti'}</span>
            </button>
            <button
              type="button"
              onClick={onToggle3DView}
              aria-pressed={threeD}
              className={`flex items-center justify-center gap-1 px-2 py-2 min-h-[38px] rounded-xl text-[11px] font-semibold transition-colors touch-manipulation ${
                threeD
                  ? 'bg-slate-900 dark:bg-sky-500 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Box className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{threeD ? '3D Aktif' : 'Lihat 3D'}</span>
            </button>
            <button
              type="button"
              onClick={onFastForward}
              className="flex items-center justify-center gap-1 px-2 py-2 min-h-[38px] rounded-xl text-[11px] font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap touch-manipulation"
            >
              <FastForward className="w-3.5 h-3.5 shrink-0" />
              <span>60×</span>
            </button>
          </div>
        </div>

        {/* Visual Rangkaian / Stamformasi Kereta */}
        {consist && (
          <section
            aria-label="Rangkaian kereta"
            className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/70 p-3 flex flex-col gap-2"
          >
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                Rangkaian &amp; Stamformasi
              </h3>
              <span className="font-mono tabular-nums text-[11px] text-slate-500 dark:text-slate-400">
                {consist.formationLabel} · ±{consist.totalLengthM} m
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 -mt-1">
              {consist.model}
            </p>

            {/* Stylized Consist Schematic Strip */}
            <div className="overflow-x-auto sepur-scroll pb-1 -mx-0.5 px-0.5">
              <div className="inline-flex items-end gap-1 min-w-max pt-1">
                {consist.cars.map((car) => {
                  const isActive = selectedCarIdx === car.index;
                  const widthPx = Math.max(26, Math.round(car.lengthM * 1.65));
                  return (
                    <button
                      key={car.index}
                      type="button"
                      onClick={() =>
                        setSelectedCarIdx((prev) => (prev === car.index ? null : car.index))
                      }
                      title={`${car.role} (${car.lengthM} m)`}
                      aria-label={`${car.role}, panjang ${car.lengthM} meter`}
                      className={`group relative flex flex-col items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-md transition-transform ${
                        isActive ? '-translate-y-0.5' : 'hover:-translate-y-0.5'
                      }`}
                    >
                      <div
                        style={{
                          width: `${widthPx}px`,
                          backgroundColor: car.bodyColor,
                        }}
                        className={`h-6 relative overflow-hidden border shadow-2xs flex items-center justify-center ${
                          isActive
                            ? 'border-blue-600 ring-1 ring-blue-500/40'
                            : 'border-slate-400/70 dark:border-slate-600'
                        } ${
                          car.isCabFront
                            ? 'rounded-l-xl rounded-r-sm'
                            : car.isCabRear
                              ? 'rounded-r-xl rounded-l-sm'
                              : 'rounded-sm'
                        }`}
                      >
                        {/* Livery Stripes */}
                        <span
                          className="absolute inset-x-0 bottom-1 h-1.5"
                          style={{ backgroundColor: car.stripePrimary }}
                          aria-hidden="true"
                        />
                        <span
                          className="absolute inset-x-0 bottom-0 h-1"
                          style={{ backgroundColor: car.stripeSecondary }}
                          aria-hidden="true"
                        />
                        {/* Headlight on front cab */}
                        {car.isCabFront && (
                          <span
                            className="absolute left-0.5 top-1 w-1.5 h-1.5 rounded-full bg-amber-300 border border-slate-700/40"
                            aria-hidden="true"
                          />
                        )}
                        <span className="relative z-10 font-mono text-[9px] font-bold text-slate-900 bg-white/80 px-1 rounded-xs leading-tight">
                          {car.code}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {focusedCar ? (
              <div className="text-[11px] bg-slate-50 dark:bg-slate-800/70 rounded-lg px-2.5 py-1.5 flex items-center justify-between gap-2">
                <span className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                  Unit #{focusedCar.index + 1}: {focusedCar.role}
                </span>
                <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400 shrink-0">
                  {focusedCar.lengthM} m
                </span>
              </div>
            ) : (
              <p className="text-[10px] text-slate-400 dark:text-slate-500">
                Ketuk unit kereta untuk melihat rincian stamformasi tipikal layanan ini.
              </p>
            )}
          </section>
        )}

        {/* Fleet Photo */}
        {fleetItem && (
          <figure className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800">
            {!imgFailed ? (
              <img
                src={`/${fleetItem.img}`}
                alt={fleetItem.caption}
                loading="lazy"
                referrerPolicy="no-referrer"
                onError={() => setImgFailed(true)}
                className="w-full h-32 object-cover"
              />
            ) : (
              <div className="w-full h-24 flex flex-col items-center justify-center gap-1.5 text-slate-400">
                <TrainFront className="w-7 h-7" />
                <span className="text-xs">{fleetItem.model}</span>
              </div>
            )}
            <figcaption className="px-2.5 py-1.5 text-[11px] text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 flex items-center justify-between gap-2">
              <span className="truncate font-medium text-slate-700 dark:text-slate-300">
                Ilustrasi armada: {fleetItem.model}
              </span>
              <a
                href={fleetItem.source}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline shrink-0"
              >
                {fleetItem.license}
              </a>
            </figcaption>
          </figure>
        )}
      </div>

      {/* Rich Speed Profile Telemetry */}
      {profile && (
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
              Profil kecepatan
            </span>
            <span className="font-mono tabular-nums text-[11px] text-slate-500 dark:text-slate-400">
              {formatDistanceKm(profile.D)} · rata {avgKmh} · maks {peakKmh} km/j
            </span>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-2.5 border border-slate-200/70 dark:border-slate-800">
            <svg
              viewBox={`0 0 ${svgW} ${svgH}`}
              className="w-full h-[92px] overflow-visible"
              aria-label="Grafik profil kecepatan kereta menurut waktu"
            >
              {[
                { val: yTop, y: padT },
                { val: yMid, y: padT + plotH / 2 },
                { val: 0, y: padT + plotH },
              ].map(({ val, y }) => (
                <g key={val}>
                  <line
                    x1={padL}
                    x2={svgW - padR}
                    y1={y}
                    y2={y}
                    stroke="currentColor"
                    className="text-slate-200 dark:text-slate-700"
                    strokeWidth="0.75"
                  />
                  <text
                    x={padL - 5}
                    y={y + 3}
                    textAnchor="end"
                    className="fill-slate-400 dark:fill-slate-500 font-mono"
                    fontSize="8.5"
                  >
                    {val}
                  </text>
                </g>
              ))}

              {areaPath && <path d={areaPath} fill={line.color} fillOpacity="0.16" />}
              <polyline
                fill="none"
                stroke={line.color}
                strokeWidth="1.8"
                strokeLinejoin="round"
                points={linePoints}
              />

              {stopTicks.map((sx, idx) => (
                <line
                  key={idx}
                  x1={sx}
                  x2={sx}
                  y1={padT + plotH - 4}
                  y2={padT + plotH + 3}
                  stroke={line.color}
                  strokeWidth="1.2"
                  opacity="0.75"
                />
              ))}

              {t >= tStart && t <= tEnd && (
                <line
                  x1={nowX}
                  x2={nowX}
                  y1={padT}
                  y2={padT + plotH}
                  stroke="#2563EB"
                  strokeWidth="1.4"
                  strokeDasharray="3 2"
                />
              )}
            </svg>
            <div className="flex justify-between font-mono tabular-nums text-[10px] text-slate-400 pl-7 pr-1 -mt-1">
              <span>{fmt(tStart)}</span>
              <span>{fmt((tStart + tEnd) / 2)}</span>
              <span>{fmt(tEnd)}</span>
            </div>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-snug mt-2">
              km/j menurut waktu · garis kecil = stasiun berhenti · garis putus = sekarang. Dihitung dari jarak rel OpenStreetMap &amp; jadwal.
            </p>
          </div>
        </div>
      )}

      {/* Stops & Pass-Through Stations Timeline */}
      <div className="p-4 flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Jadwal &amp; stasiun dilewati
          </h3>
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 tabular-nums">
            {stopsCount} berhenti{passCount > 0 ? ` · ${passCount} dilewati` : ''}
          </span>
        </div>

        {passCount > 0 && (
          <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer select-none py-1">
            <input
              type="checkbox"
              checked={showPassThrough}
              onChange={(e) => setShowPassThrough(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
            />
            <span>Tampilkan {passCount} stasiun yang dilewati langsung</span>
          </label>
        )}

        <ol className="relative flex flex-col">
          {trip.sids.map((sid, idx) => {
            const stopsHere = Boolean(trip.flags[idx] & 1);
            const isTrainAfterThisNode = runningSegIndex === idx;
            if (!stopsHere && !showPassThrough) {
              // If train is currently passing through a hidden intermediate segment, keep timeline clean
              return null;
            }
            const st = engine.st.get(sid);
            const passed = t > trip.dep[idx];
            const isFirst = idx === 0;
            const isLast = idx === trip.sids.length - 1;
            const isCurrent = state?.kind === 'dwell' && state.at === idx;
            const isNext = state?.kind === 'run' && state.nextStop === idx;
            const segMax = legSpeeds[idx];
            const dwellSec = Math.max(0, trip.dep[idx] - trip.arr[idx]);
            return (
              <li key={`${sid}-${idx}`} className="relative pl-6 py-2 flex flex-col">
                <div className="flex items-start justify-between gap-3">
                  {/* Vertical connector line */}
                  {!isLast && (
                    <span
                      className="absolute left-[7px] top-4 bottom-[-10px] w-0.5"
                      style={{
                        backgroundColor: passed ? '#cbd5e1' : line.color,
                        opacity: passed ? 0.6 : 0.45,
                      }}
                      aria-hidden="true"
                    />
                  )}
                  {/* Node dot */}
                  <span
                    className={`absolute rounded-full border-2 ${
                      stopsHere ? 'left-1 top-2.5 w-3 h-3' : 'left-[6px] top-3 w-2 h-2'
                    }`}
                    style={{
                      borderColor: passed ? '#94a3b8' : line.color,
                      backgroundColor: isCurrent || isNext ? line.color : '#ffffff',
                    }}
                    aria-hidden="true"
                  />

                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => onOpenStation(sid)}
                      className={`text-left hover:underline block truncate max-w-full ${
                        passed
                          ? 'text-slate-400 dark:text-slate-500'
                          : isCurrent || isNext
                            ? 'text-slate-900 dark:text-white font-bold'
                            : 'text-slate-800 dark:text-slate-100 font-semibold'
                      } ${stopsHere ? 'text-xs' : 'text-[11px] italic font-normal'}`}
                    >
                      {st?.name || sid}
                      {!stopsHere && ' (lewat)'}
                    </button>
                    {stopsHere && segMax && (
                      <span className="block text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 tabular-nums">
                        maks. ≈ {segMax} km/j dari stasiun sebelumnya
                      </span>
                    )}
                  </div>

                  <div className="font-mono tabular-nums text-xs shrink-0 text-right leading-tight">
                    <div
                      className={
                        passed
                          ? 'text-slate-400 dark:text-slate-500'
                          : isNext
                            ? 'text-blue-600 dark:text-blue-400 font-bold'
                            : 'text-slate-800 dark:text-slate-100 font-semibold'
                      }
                    >
                      {isFirst ? fmt(trip.dep[idx]) : fmt(trip.arr[idx])}
                    </div>
                    <div className="text-[10px] font-sans text-slate-400 dark:text-slate-500 mt-0.5">
                      {isFirst
                        ? 'berangkat'
                        : isLast
                          ? 'tiba'
                          : !stopsHere
                            ? 'lewat'
                            : dwellSec >= 60
                              ? `berangkat ${fmt(trip.dep[idx])}`
                              : ''}
                    </div>
                  </div>
                </div>

                {/* Inline Live Train Position Indicator inside Timeline */}
                {isTrainAfterThisNode && (
                  <div className="mt-2 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-200/80 dark:border-blue-800/60 flex items-center justify-between gap-2 text-[11px]">
                    <span className="font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-1.5 truncate">
                      <span className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400 shrink-0" />
                      <span>Posisi kereta saat ini</span>
                    </span>
                    <span className="font-mono tabular-nums font-bold text-blue-700 dark:text-blue-300 shrink-0">
                      {curKmh} km/j
                    </span>
                  </div>
                )}
              </li>
            );
          })}
        </ol>

        <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed pt-3 border-t border-slate-100 dark:border-slate-800">
          {sourceNoteText(line)}
        </p>
      </div>
    </div>
  );
});
