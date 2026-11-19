import type { Engine } from './sched';
import type { JplData, Line, RunningTrain, Station, SystemFilterId } from './types';
import { chipOf, clampSpeedKmh, jplParseRow, jplTitleLabel, trainDisplayInfo } from './constants';

export interface NetworkSummary {
  total: number;
  moving: number;
  dwelling: number;
  byChip: Record<SystemFilterId, number>;
  fastest: {
    train: RunningTrain;
    line: Line;
    kmh: number;
  } | null;
}

/** Pure network telemetry summary computed from currently running trains. */
export function summarizeNetwork(engine: Engine, running: RunningTrain[]): NetworkSummary {
  const byChip: Record<SystemFilterId, number> = {
    all: 0,
    krl: 0,
    mrt: 0,
    lrt: 0,
    bandara: 0,
    whoosh: 0,
    kai: 0,
    barang: 0,
  };

  let moving = 0;
  let dwelling = 0;
  let fastest: NetworkSummary['fastest'] = null;

  for (const r of running) {
    const line = engine.lines.get(r.trip.line);
    if (!line) continue;
    const c = chipOf(line.sys);
    byChip.all++;
    byChip[c]++;

    if (r.s.kind === 'run') {
      moving++;
      const kmh = clampSpeedKmh(r.s.v ?? 0, line);
      if (!fastest || kmh > fastest.kmh) {
        fastest = { train: r, line, kmh };
      }
    } else {
      dwelling++;
    }
  }

  return {
    total: byChip.all,
    moving,
    dwelling,
    byChip,
    fastest,
  };
}

export interface SearchResults {
  stations: Station[];
  lines: Line[];
  trains: RunningTrain[];
  jpls: { index: number; title: string; road: string; daop: string; cat: string }[];
}

/** Fast, ranked client-side search across stations, lines, active trains, and JPL crossings. */
export function unifiedSearch(
  query: string,
  engine: Engine,
  running: RunningTrain[],
  jpl: JplData | null,
): SearchResults {
  const q = query.trim().toLowerCase();
  if (!q) return { stations: [], lines: [], trains: [], jpls: [] };

  const scoredStations: { s: Station; score: number }[] = [];
  for (const s of engine.allStations()) {
    const nm = s.name.toLowerCase();
    const id = s.id.toLowerCase();
    const code = (s.code || '').toLowerCase();
    let score = 0;
    if (id === q || code === q || nm === q) score = 100;
    else if (nm.startsWith(q) || id.startsWith(q)) score = 70;
    else if (nm.includes(q)) score = 40;
    if (score > 0) {
      if ((s.lines?.length ?? 0) > 2) score += 10;
      scoredStations.push({ s, score });
    }
  }
  scoredStations.sort((a, b) => b.score - a.score || a.s.name.localeCompare(b.s.name));

  const scoredLines: { l: Line; score: number }[] = [];
  for (const l of engine.allLines()) {
    const nm = l.name.toLowerCase();
    const svc = (l.svc || '').toLowerCase();
    const sh = l.short.toLowerCase();
    let score = 0;
    if (nm === q || svc === q || sh === q) score = 100;
    else if (nm.startsWith(q) || svc.startsWith(q)) score = 70;
    else if (nm.includes(q) || svc.includes(q)) score = 40;
    if (score > 0) scoredLines.push({ l, score });
  }
  scoredLines.sort((a, b) => b.score - a.score || a.l.name.localeCompare(b.l.name));

  const matchedTrains: RunningTrain[] = [];
  for (const r of running) {
    const line = engine.lines.get(r.trip.line);
    const info = trainDisplayInfo(r.trip, line);
    const hay = `${info.name} ${info.num} ${r.trip.head} ${r.trip.id}`.toLowerCase();
    if (hay.includes(q)) {
      matchedTrains.push(r);
      if (matchedTrains.length >= 12) break;
    }
  }

  const jpls: SearchResults['jpls'] = [];
  if (jpl && q.length >= 2) {
    for (let i = 0; i < jpl.x.length; i++) {
      const row = jpl.x[i];
      const hay = `${row[6]} ${row[7]} ${row[14]} ${row[15]}`.toLowerCase();
      if (hay.includes(q)) {
        const parsed = jplParseRow(jpl, i);
        jpls.push({
          index: i,
          title: jplTitleLabel(parsed),
          road: parsed.road,
          daop: parsed.daop,
          cat: parsed.cat,
        });
        if (jpls.length >= 8) break;
      }
    }
  }

  return {
    stations: scoredStations.slice(0, 10).map((x) => x.s),
    lines: scoredLines.slice(0, 8).map((x) => x.l),
    trains: matchedTrains,
    jpls,
  };
}

/**
 * Compute estimated maximum cruise speed (km/j) from the previous stopping station
 * to each stopping station along a trip, using actual OSM rail distances and timetable deltas.
 */
export function computeStopLegSpeeds(
  engine: Engine,
  trip: import('./types').Trip,
): (number | null)[] {
  const line = engine.lines.get(trip.line);
  const out: (number | null)[] = new Array(trip.sids.length).fill(null);
  let prevStopIdx = -1;
  for (let i = 0; i < trip.sids.length; i++) {
    const stopsHere = Boolean(trip.flags[i] & 1);
    if (!stopsHere) continue;
    if (prevStopIdx >= 0) {
      let distMeters = 0;
      for (let k = prevStopIdx; k < i; k++) {
        distMeters += engine.seg(trip.sids[k], trip.sids[k + 1]).len;
      }
      const dt = trip.arr[i] - trip.dep[prevStopIdx];
      if (distMeters > 50 && dt > 15) {
        // Account for acceleration/braking overhead (~1.12x average speed for peak leg speed)
        const estPeakMps = (distMeters / dt) * 1.12;
        const kmh = clampSpeedKmh(estPeakMps, line);
        if (kmh >= 8) out[i] = kmh;
      }
    }
    prevStopIdx = i;
  }
  return out;
}

/**
 * Find railway lines connecting a petak (stationA <-> stationB), deduplicated by line short code.
 */
export function linesBetweenStations(
  engine: Engine,
  stationA: string,
  stationB: string,
): Line[] {
  const stA = engine.st.get(stationA);
  const stB = engine.st.get(stationB);
  const aLines = new Set(stA?.lines || []);
  const bLines = new Set(stB?.lines || []);
  const ids =
    aLines.size && bLines.size
      ? [...aLines].filter((id) => bLines.has(id))
      : [...(aLines.size ? aLines : bLines)];

  const found: Line[] = [];
  const seenShort = new Set<string>();
  const rank = (sys: string) =>
    sys === 'krl' || sys === 'mrt' || sys === 'lrtj' || sys === 'jbdb' || sys === 'bandara'
      ? 0
      : sys === 'whoosh'
        ? 1
        : sys === 'regional'
          ? 2
          : sys === 'kai'
            ? 3
            : 4;

  const lines = ids
    .map((id) => engine.lines.get(id))
    .filter((l): l is Line => Boolean(l))
    .sort((a, b) => rank(a.sys) - rank(b.sys) || a.short.localeCompare(b.short));

  for (const l of lines) {
    const key = `${l.sys}:${l.short}`;
    if (seenShort.has(key)) continue;
    seenShort.add(key);
    found.push(l);
    if (found.length >= 8) break;
  }
  return found;
}

