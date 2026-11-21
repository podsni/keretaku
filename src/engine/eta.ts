import type { Engine, TrailResult } from './sched';
import { STOCK } from './stock';
import type { LiveGpsFix, GpsTrackMatch } from './gps';
import type { ClockState, Line, TrainState, Trip } from './types';

export type Camera3DMode = 'auto' | 'chase' | 'side' | 'trackside' | 'top' | 'free';

export interface NextStationEta {
  status: 'upcoming' | 'dwelling' | 'running' | 'finished';
  stationIndex: number;
  stationId: string;
  stationName: string;
  scheduledArrSec: number;
  estimatedArrSec: number;
  remainingSimSec: number;
  remainingRealSec: number | null; // null when paused
  distanceMeters: number;
  legProgress: number; // 0..1 along current stop-to-stop leg
  source: 'gps' | 'schedule';
}

export interface Car3DPose {
  index: number;
  centerLngLat: [number, number];
  bearingDeg: number;
  lengthM: number;
  liv: string;
  cab: 'f' | 'r' | '';
  loco: boolean;
}

export interface Train3DPose {
  id: string;
  date: string;
  label: string;
  stockKey: string;
  lineColor: string;
  selected: boolean;
  headLngLat: [number, number];
  bearingDeg: number;
  speedKmh: number;
  trailCoords: [number, number][];
  cars: Car3DPose[];
  specialCar?: 'panoramic' | 'suite' | 'ssng' | null;
}

/** Format a countdown duration in seconds as crisp MM:SS or Hj MM:SS. */
export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (hrs > 0) {
    return `${hrs}j ${pad(mins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
}

/** Format compact real-time duration for accelerated simulation speeds (e.g. "8 dtk", "1m 12d"). */
export function formatRealCountdown(seconds: number): string {
  const s = Math.max(0, seconds);
  if (s < 1 && s > 0) return '<1 dtk';
  const r = Math.round(s);
  if (r < 60) return `${r} dtk`;
  const m = Math.floor(r / 60);
  const rem = r % 60;
  if (m < 60) return rem > 0 ? `${m}m ${rem}d` : `${m} mnt`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm > 0 ? `${h}j ${rm}m` : `${h} jam`;
}

/** Compute remaining rail distance in meters from current running state to target station index. */
function computeRemainingRailMeters(
  engine: Engine,
  trip: Trip,
  state: TrainState,
  targetIdx: number,
): number {
  if (state.kind !== 'run' || state.from === undefined) return 0;
  let dist = 0;
  const segIdx = state.from;
  if (segIdx < trip.sids.length - 1) {
    const curPl = engine.seg(trip.sids[segIdx], trip.sids[segIdx + 1]);
    const traveled = Math.max(0, Math.min(curPl.len, state.d ?? 0));
    dist += curPl.len - traveled;
  }
  for (let i = segIdx + 1; i < targetIdx && i < trip.sids.length - 1; i++) {
    dist += engine.seg(trip.sids[i], trip.sids[i + 1]).len;
  }
  return Math.max(0, Math.round(dist));
}

/**
 * Calculate estimated arrival time, remaining rail distance, and live countdown
 * to the next stopping station based on GAPEKA schedule, optional Live GPS lock,
 * and active simulation speed.
 */
export function computeNextStationEta(params: {
  engine: Engine;
  trip: Trip;
  t: number;
  state: TrainState | null;
  simSpeed: number;
  simPaused: boolean;
  gpsMatch?: GpsTrackMatch | null;
}): NextStationEta {
  const { engine, trip, t, state, simSpeed, simPaused, gpsMatch } = params;
  const effSpeed = Math.max(1, simSpeed || 1);
  const lastIdx = trip.sids.length - 1;

  // Before departure
  if (t < trip.dep[0]) {
    const stId = trip.sids[0];
    const stName = engine.st.get(stId)?.name || stId;
    const remSim = Math.max(0, trip.dep[0] - t);
    return {
      status: 'upcoming',
      stationIndex: 0,
      stationId: stId,
      stationName: stName,
      scheduledArrSec: trip.dep[0],
      estimatedArrSec: trip.dep[0],
      remainingSimSec: remSim,
      remainingRealSec: simPaused ? null : remSim / effSpeed,
      distanceMeters: 0,
      legProgress: 0,
      source: 'schedule',
    };
  }

  // Live GPS locked on rail corridor
  if (gpsMatch && gpsMatch.onCorridor) {
    const nsIdx = gpsMatch.nextStopIndex;
    const stId = trip.sids[nsIdx];
    const stName = engine.st.get(stId)?.name || stId;
    const schedArr = trip.arr[nsIdx];

    let remSim: number;
    if (gpsMatch.gpsKmh !== null && gpsMatch.gpsKmh >= 8 && gpsMatch.distToNextStopMeters > 0) {
      remSim = gpsMatch.distToNextStopMeters / (gpsMatch.gpsKmh / 3.6);
    } else {
      remSim = Math.max(0, schedArr - t + gpsMatch.scheduleDeltaSec);
    }

    // Find previous stopping station for leg progress
    let prevStopIdx = 0;
    for (let i = nsIdx - 1; i >= 0; i--) {
      if (trip.flags[i] & 1) {
        prevStopIdx = i;
        break;
      }
    }
    let legTotalM = 0;
    for (let i = prevStopIdx; i < nsIdx; i++) {
      legTotalM += engine.seg(trip.sids[i], trip.sids[i + 1]).len;
    }
    const legProgress =
      legTotalM > 1
        ? Math.max(0, Math.min(1, 1 - gpsMatch.distToNextStopMeters / legTotalM))
        : gpsMatch.progress;

    return {
      status: 'running',
      stationIndex: nsIdx,
      stationId: stId,
      stationName: stName,
      scheduledArrSec: schedArr,
      estimatedArrSec: t + remSim,
      remainingSimSec: remSim,
      remainingRealSec: simPaused ? null : remSim / effSpeed,
      distanceMeters: gpsMatch.distToNextStopMeters,
      legProgress,
      source: 'gps',
    };
  }

  // Finished trip
  if (!state || t >= trip.arr[lastIdx]) {
    const stId = trip.sids[lastIdx];
    const stName = engine.st.get(stId)?.name || stId;
    return {
      status: 'finished',
      stationIndex: lastIdx,
      stationId: stId,
      stationName: stName,
      scheduledArrSec: trip.arr[lastIdx],
      estimatedArrSec: trip.arr[lastIdx],
      remainingSimSec: 0,
      remainingRealSec: 0,
      distanceMeters: 0,
      legProgress: 1,
      source: 'schedule',
    };
  }

  // Dwelling at a station
  if (state.kind === 'dwell' && state.at !== undefined) {
    const atIdx = state.at;
    if (atIdx >= lastIdx) {
      const stId = trip.sids[lastIdx];
      return {
        status: 'finished',
        stationIndex: lastIdx,
        stationId: stId,
        stationName: engine.st.get(stId)?.name || stId,
        scheduledArrSec: trip.arr[lastIdx],
        estimatedArrSec: trip.arr[lastIdx],
        remainingSimSec: 0,
        remainingRealSec: 0,
        distanceMeters: 0,
        legProgress: 1,
        source: 'schedule',
      };
    }

    // Find next stopping station after current dwell
    let nextIdx = lastIdx;
    for (let i = atIdx + 1; i < trip.sids.length; i++) {
      if (trip.flags[i] & 1) {
        nextIdx = i;
        break;
      }
    }
    const stId = trip.sids[nextIdx];
    const stName = engine.st.get(stId)?.name || stId;
    const remSim = Math.max(0, trip.arr[nextIdx] - t);
    let distM = 0;
    for (let i = atIdx; i < nextIdx; i++) {
      distM += engine.seg(trip.sids[i], trip.sids[i + 1]).len;
    }

    return {
      status: 'dwelling',
      stationIndex: nextIdx,
      stationId: stId,
      stationName: stName,
      scheduledArrSec: trip.arr[nextIdx],
      estimatedArrSec: trip.arr[nextIdx],
      remainingSimSec: remSim,
      remainingRealSec: simPaused ? null : remSim / effSpeed,
      distanceMeters: Math.round(distM),
      legProgress: 0,
      source: 'schedule',
    };
  }

  // Running toward next stop
  const nsIdx = state.nextStop ?? state.next ?? lastIdx;
  const stId = trip.sids[nsIdx];
  const stName = engine.st.get(stId)?.name || stId;
  const remSim = Math.max(0, trip.arr[nsIdx] - t);
  const distM = computeRemainingRailMeters(engine, trip, state, nsIdx);

  let prevStopIdx = 0;
  for (let i = nsIdx - 1; i >= 0; i--) {
    if (trip.flags[i] & 1) {
      prevStopIdx = i;
      break;
    }
  }
  const legDep = trip.dep[prevStopIdx];
  const legArr = trip.arr[nsIdx];
  const legSpan = Math.max(1, legArr - legDep);
  const legProgress = Math.max(0, Math.min(1, (t - legDep) / legSpan));

  return {
    status: 'running',
    stationIndex: nsIdx,
    stationId: stId,
    stationName: stName,
    scheduledArrSec: legArr,
    estimatedArrSec: legArr,
    remainingSimSec: remSim,
    remainingRealSec: simPaused ? null : remSim / effSpeed,
    distanceMeters: distM,
    legProgress,
    source: 'schedule',
  };
}

/** Sample a point along a TrailResult at distance d (meters from head of train). */
function sampleTrailAt(tr: TrailResult, d: number): [number, number] {
  const { pts, cum } = tr;
  const hiMax = cum.length - 1;
  if (hiMax <= 0) return pts[0] || [0, 0];
  if (d <= 0) return pts[0];
  if (d >= cum[hiMax]) return pts[hiMax];

  let lo = 0;
  let hi = hiMax;
  while (lo < hi - 1) {
    const m = (lo + hi) >> 1;
    if (cum[m] <= d) lo = m;
    else hi = m;
  }
  const span = cum[hi] - cum[lo] || 1;
  const frac = (d - cum[lo]) / span;
  const a = pts[lo];
  const b = pts[hi];
  return [a[0] + (b[0] - a[0]) * frac, a[1] + (b[1] - a[1]) * frac];
}

function compassBearing(from: [number, number], to: [number, number]): number {
  const cosLat = Math.cos(((from[1] + to[1]) * 0.5 * Math.PI) / 180);
  const dx = (to[0] - from[0]) * cosLat;
  const dy = to[1] - from[1];
  if (dx * dx + dy * dy < 1e-16) return 0;
  return ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
}

/**
 * Slice a train's track trail into articulated per-car 3D poses (midpoint + exact track chord bearing)
 * so locomotives and coaches bend naturally around railway curves.
 */
export function computeConsist3DPoses(
  tr: TrailResult,
  stockId: string,
  fallbackBearingDeg: number,
  gapM = 0.65,
): Car3DPose[] {
  const spec = STOCK[stockId] || STOCK.ka;
  const cars: Car3DPose[] = [];
  let offset = 0;
  const n = spec.cars.length;

  for (let i = 0; i < n; i++) {
    const car = spec.cars[i];
    const start = offset + (i > 0 ? gapM * 0.5 : 0);
    const end = offset + car.len - (i < n - 1 ? gapM * 0.5 : 0);
    const effLen = Math.max(4, end - start);
    const mid = (start + end) * 0.5;

    // Sample front & rear bogie points (~32% from center) for crisp tangent bearing
    const bogieSpan = Math.min(effLen * 0.34, 6);
    const frontPt = sampleTrailAt(tr, Math.max(0, mid - bogieSpan));
    const rearPt = sampleTrailAt(tr, mid + bogieSpan);
    const midPt = sampleTrailAt(tr, mid);

    const dx = frontPt[0] - rearPt[0];
    const dy = frontPt[1] - rearPt[1];
    const bearingDeg =
      dx * dx + dy * dy > 1e-14 ? compassBearing(rearPt, frontPt) : fallbackBearingDeg;

    cars.push({
      index: i,
      centerLngLat: midPt,
      bearingDeg,
      lengthM: effLen,
      liv: car.liv,
      cab: car.cab || '',
      loco: Boolean(car.loco),
    });

    offset += car.len;
  }

  return cars;
}

/**
 * Compute target MapLibre camera parameters (center, zoom, pitch, bearing)
 * for 3D train tracking presets matching rail-twin view angles.
 */
export function compute3DCameraTarget(
  headLngLat: [number, number],
  bearingDeg: number,
  mode: Camera3DMode,
  elapsedSec = 0,
  consistLengthM = 140,
): { center: [number, number]; zoom: number; pitch: number; bearing: number } | null {
  if (mode === 'free') return null;

  const brgRad = (bearingDeg * Math.PI) / 180;
  const cosLat = Math.max(0.1, Math.cos((headLngLat[1] * Math.PI) / 180));
  // Center focus around the front-middle of the consist so loco + coaches frame heroically together
  const offsetBackM = Math.min(consistLengthM * 0.28, 42);
  const dLat = (-Math.cos(brgRad) * offsetBackM) / 111320;
  const dLng = (-Math.sin(brgRad) * offsetBackM) / (111320 * cosLat);
  const center: [number, number] = [headLngLat[0] + dLng, headLngLat[1] + dLat];

  switch (mode) {
    case 'side':
      // Classic broadside profile view matching reference rail-twin screenshots
      return {
        center,
        zoom: 18.45,
        pitch: 64,
        bearing: (bearingDeg + 90) % 360,
      };
    case 'chase':
      // Over-the-shoulder chase behind the train looking forward down the track
      return {
        center: headLngLat,
        zoom: 18.35,
        pitch: 68,
        bearing: bearingDeg % 360,
      };
    case 'trackside':
      // Low-angle railfan camera slightly ahead and beside the rail
      return {
        center: headLngLat,
        zoom: 18.75,
        pitch: 73,
        bearing: (bearingDeg + 145) % 360,
      };
    case 'top':
      // High aerial overview of full consist and track geometry
      return {
        center,
        zoom: 17.5,
        pitch: 18,
        bearing: (bearingDeg + 90) % 360,
      };
    case 'auto':
    default: {
      // Gentle cinematic orbital sweep around the train
      const orbitDeg = (bearingDeg + 78 + Math.sin(elapsedSec * 0.14) * 32) % 360;
      return {
        center,
        zoom: 18.35,
        pitch: 62 + Math.sin(elapsedSec * 0.1) * 4,
        bearing: (orbitDeg + 360) % 360,
      };
    }
  }
}

export type { ClockState, Line, LiveGpsFix };
