import { clampSpeedKmh } from './constants';
import { type Engine, haversine } from './sched';
import type { ClockState, DepartureItem, Line, RunningTrain, Station } from './types';

export type NearbyCategoryFilter = 'all' | 'commuter' | 'intercity' | 'freight';

export interface CompassDir {
  code: string;
  label: string;
  arrow: string;
  bearingDeg: number;
}

export interface NearbyLiveTrain {
  train: RunningTrain;
  line: Line;
  distanceMeters: number;
  compass: CompassDir;
  speedKmh: number;
  moving: boolean;
  approaching: boolean;
  nextStationId: string | null;
  nextStationName: string | null;
  nextArrivalSec: number | null;
  currentStationName: string | null;
  category: Exclude<NearbyCategoryFilter, 'all'>;
}

export interface NearestStationInfo {
  station: Station;
  distanceMeters: number;
  compass: CompassDir;
  nextDeparture: DepartureItem | null;
}

const COMPASS_SECTORS: readonly { code: string; label: string; arrow: string }[] = [
  { code: 'U', label: 'Utara', arrow: '↑' },
  { code: 'TL', label: 'Timur Laut', arrow: '↗' },
  { code: 'T', label: 'Timur', arrow: '→' },
  { code: 'TG', label: 'Tenggara', arrow: '↘' },
  { code: 'S', label: 'Selatan', arrow: '↓' },
  { code: 'BD', label: 'Barat Daya', arrow: '↙' },
  { code: 'B', label: 'Barat', arrow: '←' },
  { code: 'BL', label: 'Barat Laut', arrow: '↖' },
];

/** Initial great-circle bearing in degrees [0, 360) from point A to point B ([lng, lat]). */
export function bearingBetween(from: [number, number], to: [number, number]): number {
  const rad = Math.PI / 180;
  const lat1 = from[1] * rad;
  const lat2 = to[1] * rad;
  const dLng = (to[0] - from[0]) * rad;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Map vector from anchor point to target point into an 8-point Indonesian compass direction. */
export function compassDirection(from: [number, number], to: [number, number]): CompassDir {
  const deg = bearingBetween(from, to);
  const idx = Math.round(deg / 45) % 8;
  const sector = COMPASS_SECTORS[idx];
  return {
    code: sector.code,
    label: sector.label,
    arrow: sector.arrow,
    bearingDeg: deg,
  };
}

/**
 * Returns true if a moving train at `trainPos` heading `trainBearingDeg`
 * is closing the distance toward `observerPos`.
 */
export function isTrainApproaching(
  trainPos: [number, number],
  trainBearingDeg: number,
  observerPos: [number, number],
  distanceMeters?: number,
): boolean {
  const dist = distanceMeters ?? haversine(observerPos, trainPos);
  if (dist < 150) return false;
  const toObserver = bearingBetween(trainPos, observerPos);
  const diff = Math.abs((((toObserver - trainBearingDeg) % 360) + 540) % 360 - 180);
  return diff <= 65;
}

export function nearbyCategoryOf(line: Line): Exclude<NearbyCategoryFilter, 'all'> {
  if (line.sys === 'barang') return 'freight';
  if (line.sys === 'kai' || line.sys === 'whoosh') return 'intercity';
  return 'commuter';
}

export interface FindNearbyTrainsOptions {
  category?: NearbyCategoryFilter;
  maxDistanceMeters?: number;
  limit?: number;
}

/**
 * Rank currently running live trains by Haversine distance from `anchorCoord` ([lng, lat]).
 * Annotates each train with compass direction, speed, next station ETA, and approaching indicator.
 */
export function findNearbyLiveTrains(
  engine: Engine,
  running: RunningTrain[],
  anchorCoord: [number, number],
  opts: FindNearbyTrainsOptions = {},
): NearbyLiveTrain[] {
  const { category = 'all', maxDistanceMeters = Infinity, limit = 10 } = opts;
  const list: NearbyLiveTrain[] = [];

  for (const r of running) {
    const line = engine.lines.get(r.trip.line);
    if (!line) continue;
    const cat = nearbyCategoryOf(line);
    if (category !== 'all' && cat !== category) continue;

    const dist = haversine(anchorCoord, r.s.p);
    if (dist > maxDistanceMeters) continue;

    const moving = r.s.kind === 'run';
    const speedKmh = moving ? clampSpeedKmh(r.s.v ?? 0, line) : 0;
    const approaching =
      moving && speedKmh >= 5 && isTrainApproaching(r.s.p, r.s.bearing, anchorCoord, dist);

    const nextIdx =
      r.s.nextStop !== undefined
        ? r.s.nextStop
        : r.s.next !== null && r.s.next !== undefined
          ? r.s.next
          : null;
    const nextStationId =
      nextIdx !== null && nextIdx >= 0 && nextIdx < r.trip.sids.length
        ? r.trip.sids[nextIdx]
        : null;
    const nextStationName = nextStationId ? (engine.st.get(nextStationId)?.name ?? nextStationId) : null;
    const nextArrivalSec =
      nextIdx !== null && nextIdx >= 0 && nextIdx < r.trip.arr.length
        ? (r.trip.arr[nextIdx] ?? r.trip.dep[nextIdx] ?? null)
        : null;

    const atIdx = r.s.kind === 'dwell' && r.s.at !== undefined ? r.s.at : null;
    const currentStationName =
      atIdx !== null && atIdx >= 0 && atIdx < r.trip.sids.length
        ? (engine.st.get(r.trip.sids[atIdx])?.name ?? r.trip.sids[atIdx])
        : null;

    list.push({
      train: r,
      line,
      distanceMeters: dist,
      compass: compassDirection(anchorCoord, r.s.p),
      speedKmh,
      moving,
      approaching,
      nextStationId,
      nextStationName,
      nextArrivalSec,
      currentStationName,
      category: cat,
    });
  }

  list.sort((a, b) => a.distanceMeters - b.distanceMeters);
  return limit > 0 ? list.slice(0, limit) : list;
}

/**
 * Find the closest railway stations to `anchorCoord` ([lng, lat]) along with
 * each station's immediate next scheduled departure.
 */
export function findNearestStations(
  engine: Engine,
  anchorCoord: [number, number],
  clock: ClockState,
  limit = 3,
): NearestStationInfo[] {
  const scored: { station: Station; distanceMeters: number }[] = [];
  for (const station of engine.allStations()) {
    const distanceMeters = haversine(anchorCoord, [station.lng, station.lat]);
    scored.push({ station, distanceMeters });
  }
  scored.sort((a, b) => a.distanceMeters - b.distanceMeters);
  return scored.slice(0, limit).map(({ station, distanceMeters }) => {
    const deps = engine.departures(station.id, clock, 1, 4 * 3600);
    return {
      station,
      distanceMeters,
      compass: compassDirection(anchorCoord, [station.lng, station.lat]),
      nextDeparture: deps[0] ?? null,
    };
  });
}
