import { memo } from 'react';
import { X } from 'lucide-react';
import type { Engine } from '../engine/sched';
import { fmt } from '../engine/sched';
import { clampSpeedKmh, formatDistanceKm, trainDisplayInfo } from '../engine/constants';
import {
  type Camera3DMode,
  computeNextStationEta,
  formatCountdown,
  formatRealCountdown,
} from '../engine/eta';
import type { LiveGpsFix } from '../engine/gps';
import { snapGpsToTrip } from '../engine/gps';
import type { ClockState } from '../engine/types';

interface Train3DHudProps {
  engine: Engine;
  trainId: string;
  trainDate: string;
  clock: ClockState;
  simSpeed: number;
  simPaused: boolean;
  gpsTracking: boolean;
  gpsFix: LiveGpsFix | null;
  cameraMode: Camera3DMode;
  onSelectCameraMode: (mode: Camera3DMode) => void;
  onExit3D: () => void;
}

const CAMERA_MODES: [Camera3DMode, string][] = [
  ['auto', 'Otomatis'],
  ['chase', 'Kejar'],
  ['side', 'Samping'],
  ['trackside', 'Tepi rel'],
  ['top', 'Atas'],
  ['free', 'Bebas'],
];

export const Train3DHud = memo(function Train3DHud({
  engine,
  trainId,
  trainDate,
  clock,
  simSpeed,
  simPaused,
  gpsTracking,
  gpsFix,
  cameraMode,
  onSelectCameraMode,
  onExit3D,
}: Train3DHudProps) {
  const found = engine.find(trainId, clock, trainDate);
  const trip = found?.trip;
  const line = trip ? engine.lines.get(trip.line) : undefined;
  if (!trip || !line) return null;

  const t = found?.t ?? clock.sec;
  const state = engine.state(trip, t);
  const gpsMatch = gpsTracking && gpsFix ? snapGpsToTrip(engine, trip, clock, gpsFix) : null;
  const eta = computeNextStationEta({
    engine,
    trip,
    t,
    state,
    simSpeed,
    simPaused,
    gpsMatch,
  });

  const info = trainDisplayInfo(trip, line);
  const schedKmh = state?.kind === 'run' ? clampSpeedKmh(state.v ?? 0, line) : 0;
  const curKmh =
    gpsMatch && gpsMatch.onCorridor && gpsMatch.gpsKmh !== null ? gpsMatch.gpsKmh : schedKmh;

  // Build compact segmented stop dots along the trip (up to 7 evenly sampled stopping stations)
  const stopIndices: number[] = [];
  for (let i = 0; i < trip.sids.length; i++) {
    if (trip.flags[i] & 1) stopIndices.push(i);
  }
  const maxDots = 7;
  const displayStops =
    stopIndices.length <= maxDots
      ? stopIndices
      : Array.from({ length: maxDots }, (_, idx) =>
          stopIndices[Math.round((idx / (maxDots - 1)) * (stopIndices.length - 1))],
        );

  const progress =
    gpsMatch && gpsMatch.onCorridor
      ? gpsMatch.progress
      : (state?.progress ?? (t > trip.arr[trip.arr.length - 1] ? 1 : 0));

  return (
    <div
      data-testid="train-3d-hud"
      className="pointer-events-auto w-full max-w-[430px] rounded-2xl bg-slate-900/95 text-slate-100 border border-slate-700/80 shadow-2xl px-3.5 py-2.5 flex flex-col gap-2"
    >
      {/* Top Row: Line Bar + Train Name + Speed + Close */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-1 h-4 rounded-full shrink-0"
            style={{ backgroundColor: line.color }}
            aria-hidden="true"
          />
          <span className="text-xs sm:text-sm font-bold text-white truncate">
            {info.name}
          </span>
          <span className="text-[11px] font-mono text-slate-400 shrink-0">
            {info.num}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <div className="px-2 py-0.5 rounded-lg bg-slate-800 border border-slate-700 font-mono tabular-nums text-xs font-bold text-amber-400">
            {curKmh} <span className="text-[10px] font-sans font-medium text-slate-400">km/j</span>
          </div>
          <button
            type="button"
            onClick={onExit3D}
            aria-label="Keluar dari tampilan 3D"
            title="Keluar dari mode 3D"
            className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors touch-manipulation"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Next Station ETA + Distance + Live Countdown */}
      <div className="flex items-center justify-between gap-2 text-[11px] -mt-0.5">
        <span className="text-slate-200 truncate">
          {eta.status === 'finished' ? (
            `Tiba di ${eta.stationName}`
          ) : eta.status === 'upcoming' ? (
            <>
              Berangkat <strong className="text-white">{eta.stationName}</strong> {fmt(eta.scheduledArrSec)}
            </>
          ) : (
            <>
              Berikutnya <strong className="text-white">{eta.stationName}</strong>{' '}
              <span className="font-mono tabular-nums text-slate-300">{fmt(eta.estimatedArrSec)}</span>
              {eta.distanceMeters > 0 && (
                <span className="text-slate-400"> · {formatDistanceKm(eta.distanceMeters)}</span>
              )}
            </>
          )}
        </span>

        {eta.status !== 'finished' && (
          <span className="font-mono tabular-nums text-[11px] font-semibold text-sky-400 shrink-0">
            {simPaused
              ? 'Dijeda'
              : simSpeed > 1 && eta.remainingRealSec !== null
                ? `${formatCountdown(eta.remainingSimSec)} (${formatRealCountdown(eta.remainingRealSec)})`
                : formatCountdown(eta.remainingSimSec)}
          </span>
        )}
      </div>

      {/* Horizontal Mini Route Progress Line with Station Dots */}
      <div className="relative h-3 flex items-center" aria-hidden="true">
        <div className="w-full h-0.5 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-white rounded-full transition-all duration-300"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
        <div className="absolute inset-0 flex items-center justify-between">
          {displayStops.map((sIdx, i) => {
            const passed = t >= trip.arr[sIdx];
            return (
              <span
                key={`${sIdx}-${i}`}
                className={`w-2 h-2 rounded-full border ${
                  passed
                    ? 'bg-white border-white'
                    : 'bg-slate-900 border-slate-400'
                }`}
              />
            );
          })}
        </div>
      </div>

      {/* 6 Camera View Mode Buttons (Otomatis | Kejar | Samping | Tepi rel | Atas | Bebas) */}
      <div className="flex items-center gap-1 overflow-x-auto sepur-scroll sm:grid sm:grid-cols-6">
        {CAMERA_MODES.map(([id, label]) => {
          const active = cameraMode === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelectCameraMode(id)}
              aria-pressed={active}
              className={`px-2 sm:px-1.5 py-1 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap text-center shrink-0 touch-manipulation ${
                active
                  ? 'bg-white text-slate-950 shadow-xs'
                  : 'bg-slate-800/90 text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <p className="text-[10px] text-slate-400 leading-none">
        Seret untuk memutar kamera, gulir untuk zoom
      </p>
    </div>
  );
});
