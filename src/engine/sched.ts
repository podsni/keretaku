import type {
  ClockState,
  DepartureItem,
  FreightData,
  Journey,
  JourneyLeg,
  JplPass,
  KaiData,
  Line,
  LineGridRow,
  MotionProfile,
  NetworkData,
  PackedTrip,
  RunningTrain,
  SpeedLeg,
  SpeedProfile,
  Station,
  StationDayRow,
  SystemId,
  TrainState,
  Trip,
  TripsData,
} from './types';

export const DWELL = 25; // seconds assumed at an intermediate stop when only departures are known
export const CHANGE = 180; // minimum time to change trains at the same station (s)
export const WALK_SPEED = 1.1; // m/s between linked stations (interchanges)

const pad = (n: number) => String(n).padStart(2, '0');

/** Wall clock in Asia/Jakarta (UTC+7, no DST) regardless of device time zone. */
export function jakartaClock(ms = Date.now()): ClockState {
  const d = new Date(ms + 7 * 3600e3);
  const date = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  return {
    date,
    dow: d.getUTCDay(),
    sec: d.getUTCHours() * 3600 + d.getUTCMinutes() * 60 + d.getUTCSeconds() + (ms % 1000) / 1000,
  };
}

export function addDays(date: string, n: number): string {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 'weekday' or 'weekend' (Saturday, Sunday and national holidays). */
export function dayType(date: string, holidays: string[] = []): 'weekday' | 'weekend' {
  const dow = new Date(date + 'T00:00:00Z').getUTCDay();
  return dow === 0 || dow === 6 || holidays.includes(date) ? 'weekend' : 'weekday';
}

export const fmt = (sec: number): string => {
  const norm = ((Math.round(sec / 60) * 60) % 86400 + 86400) % 86400;
  return `${pad(Math.floor(norm / 3600))}.${pad(Math.floor((norm % 3600) / 60))}`;
};

export const dur = (s: number): string => {
  const m = Math.round(s / 60);
  return m < 60 ? `${m} mnt` : `${Math.floor(m / 60)} j ${pad(m % 60)} mnt`;
};

export function haversine(a: [number, number], b: [number, number]): number {
  const R = 6371000;
  const r = Math.PI / 180;
  const dla = (b[1] - a[1]) * r;
  const dlo = (b[0] - a[0]) * r;
  const h =
    Math.sin(dla / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dlo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

interface Polyline {
  coords: [number, number][];
  cum: number[];
  len: number;
}

function prepLine(coords: [number, number][]): Polyline {
  const cum = [0];
  for (let i = 1; i < coords.length; i++) {
    cum.push(cum[i - 1] + haversine(coords[i - 1], coords[i]));
  }
  return { coords, cum, len: cum[cum.length - 1] };
}

function along(pl: Polyline, f: number): { p: [number, number]; bearing: number } {
  const target = Math.max(0, Math.min(1, f)) * pl.len;
  const { cum, coords } = pl;
  let lo = 0;
  let hi = cum.length - 1;
  while (lo < hi - 1) {
    const m = (lo + hi) >> 1;
    if (cum[m] <= target) lo = m;
    else hi = m;
  }
  const seg = cum[hi] - cum[lo] || 1;
  const t = (target - cum[lo]) / seg;
  const a = coords[lo];
  const b = coords[hi];
  const k = Math.cos((a[1] * Math.PI) / 180);
  return {
    p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
    bearing: (Math.atan2((b[0] - a[0]) * k, b[1] - a[1]) * 180) / Math.PI,
  };
}

export const VREF: Record<SystemId, number> = {
  krl: 19,
  mrt: 22,
  lrtj: 17,
  jbdb: 20,
  bandara: 22,
  whoosh: 75,
  regional: 22,
  kai: 27,
  barang: 14,
};

export const VMAX: Record<SystemId, number> = {
  krl: 100,
  mrt: 100,
  lrtj: 70,
  jbdb: 90,
  bandara: 100,
  whoosh: 350,
  regional: 120,
  kai: 120,
  barang: 100,
};

export const ACCEL: Record<SystemId, number> = {
  krl: 0.7,
  mrt: 0.9,
  lrtj: 0.8,
  jbdb: 0.9,
  bandara: 0.6,
  whoosh: 0.45,
  regional: 0.3,
  kai: 0.25,
  barang: 0.12,
};

/** Fit a trapezoidal speed profile for distance D (m) in time T (s); sA/sB = stops at start/end. */
export function motion(D: number, T: number, a: number, sA: number | boolean, sB: number | boolean): MotionProfile {
  const n = (sA ? 1 : 0) + (sB ? 1 : 0);
  if (T <= 0 || D <= 0) return { D, T, vc: 0, ae: a, ta: 0, tb: 0 };
  if (!n) return { D, T, vc: D / T, ae: a, ta: 0, tb: 0 };
  const ae = Math.max(a, (n * 2 * D) / (T * T));
  const k = n / (2 * ae);
  const disc = Math.max(0, T * T - 4 * k * D);
  const vc = (T - Math.sqrt(disc)) / (2 * k);
  return { D, T, vc, ae, ta: sA ? vc / ae : 0, tb: sB ? vc / ae : 0 };
}

/** Distance covered (m) and speed (m/s) t seconds into a fitted segment. */
export function moveAt(m: MotionProfile, t: number): { s: number; v: number } {
  const { D, T, vc, ae, ta, tb } = m;
  if (t <= 0) return { s: 0, v: ta ? 0 : vc };
  if (t >= T) return { s: D, v: tb ? 0 : vc };
  if (t < ta) return { s: 0.5 * ae * t * t, v: ae * t };
  if (t > T - tb) {
    const r = T - t;
    return { s: D - 0.5 * ae * r * r, v: ae * r };
  }
  return { s: 0.5 * ae * ta * ta + vc * (t - ta), v: vc };
}

/** Normalise a packed trip [id, line, head, sids, dep, arr|null, flags|null]. */
export function unpack(p: PackedTrip, extra: { est?: boolean; freight?: boolean } = {}): Trip {
  const [id, line, head, sids, dep, arr0, flags0] = p;
  const n = sids.length;
  const flags = flags0 || new Array(n).fill(1);
  let arr = arr0;
  if (!arr) {
    arr = dep.map((d, i) => (i === 0 ? d : i === n - 1 ? d : Math.max(dep[i - 1] + 1, d - DWELL)));
  }
  return {
    id,
    line,
    head,
    sids,
    dep,
    arr,
    flags,
    est: false,
    start: dep[0],
    end: arr[arr.length - 1],
    date: '',
    type: 'weekday',
    key: '',
    ...extra,
  };
}

interface DayBundle {
  date: string;
  type: 'weekday' | 'weekend';
  trips: Trip[];
  byStation: Map<string, [Trip, number][]>;
  byId: Map<string, Trip>;
  segIdx?: Map<string, [Trip, number][]>;
}

interface Connection {
  dep: number;
  arr: number;
  a: number;
  b: number;
  trip: Trip;
  i: number;
  j: number;
  off: number;
}

export interface TrailResult {
  pts: [number, number][];
  cum: number[];
}

export class Engine {
  net: NetworkData;
  tripsData: TripsData;
  st: Map<string, Station>;
  lines: Map<string, Line>;
  segs: Record<string, [number, number][]>;
  kai: KaiData | null = null;
  fr: FreightData | null = null;
  freightOn: ((line: Line | undefined) => boolean) | null = null;
  private segCache = new Map<string, Polyline>();
  private dayCache = new Map<string, DayBundle>();
  private connCache = new Map<string, Connection[]>();
  private _sidx: { ids: string[]; idx: Map<string, number>; foot: [number, number][][] } | null = null;

  constructor(network: NetworkData, trips: TripsData, kai: KaiData | null = null) {
    this.net = network;
    this.tripsData = trips;
    this.st = new Map(network.stations.map((s) => [s.id, s]));
    this.lines = new Map(network.lines.map((l) => [l.id, l]));
    this.segs = { ...network.segs };
    if (kai) this.addKai(kai);
  }

  addKai(kai: KaiData): void {
    this.kai = kai;
    for (const l of kai.lines) this.lines.set(l.id, l);
    Object.assign(this.segs, kai.segs);
    this.dayCache.clear();
    this.connCache.clear();
  }

  addFreight(fr: FreightData): void {
    this.fr = fr;
    for (const l of fr.lines) this.lines.set(l.id, l);
    for (const s of fr.stations || []) {
      if (!this.st.has(s.id)) this.st.set(s.id, s);
    }
    Object.assign(this.segs, fr.segs);
    this.dayCache.clear();
    this.connCache.clear();
  }

  isFreight(trip: Trip): boolean {
    return !!trip.freight;
  }

  shown(trip: Trip): boolean {
    return !trip.freight || (!!this.freightOn && this.freightOn(this.lines.get(trip.line)));
  }

  allLines(): Line[] {
    return [...this.lines.values()];
  }

  allStations(): Station[] {
    return [...this.st.values()];
  }

  seg(a: string, b: string): Polyline {
    const k = a + '>' + b;
    let pl = this.segCache.get(k);
    if (pl) return pl;
    const key = a < b ? a + '>' + b : b + '>' + a;
    let c = this.segs[key];
    if (!c) {
      const A = this.st.get(a);
      const B = this.st.get(b);
      c = A && B ? [[A.lng, A.lat], [B.lng, B.lat]] : [[106.83, -6.24], [106.83, -6.24]];
    } else if (a > b) {
      c = c.slice().reverse();
    }
    pl = prepLine(c);
    this.segCache.set(k, pl);
    return pl;
  }

  freqTrips(line: Line, type: 'weekday' | 'weekend'): Trip[] {
    const f = line.freq;
    if (!f) return [];
    const out: Trip[] = [];
    const bands = f[type] || [];
    for (const dir of [0, 1]) {
      const sids = dir ? line.stations.slice().reverse() : line.stations.slice();
      const rel = [0];
      for (let i = 1; i < sids.length; i++) {
        rel.push(rel[i - 1] + this.seg(sids[i - 1], sids[i]).len / (f.kmh / 3.6) + (i > 1 ? f.dwell : 0));
      }
      const seen = new Set<number>();
      for (const [s, e, h] of bands) {
        for (let m = s; m < e; m += h) {
          if (seen.has(m)) continue;
          seen.add(m);
          const t0 = m * 60;
          const dep = rel.map((r) => Math.round(t0 + r));
          const lastSt = this.st.get(sids[sids.length - 1]);
          out.push(
            unpack(
              [`${line.short}-${dir ? 'B' : 'A'}${fmt(t0).replace('.', '')}`, line.id, lastSt?.name || '', sids, dep, null, null],
              { est: true },
            ),
          );
        }
      }
    }
    return out;
  }

  day(date: string): DayBundle {
    const cached = this.dayCache.get(date);
    if (cached) return cached;
    const type = dayType(date, this.net.holidays);
    const trips: Trip[] = [];
    for (const p of this.tripsData[type] || []) trips.push(unpack(p));
    for (const p of this.tripsData.daily || []) trips.push(unpack(p));
    if (this.kai) for (const p of this.kai.daily) trips.push(unpack(p));
    if (this.fr) for (const p of this.fr.daily) trips.push(unpack(p, { freight: true }));
    for (const l of this.lines.values()) {
      if (l.sched === 'frequency' || (l.freqDays && l.freqDays.includes(type))) {
        trips.push(...this.freqTrips(l, type));
      }
    }
    for (const t of trips) {
      t.start = t.dep[0];
      t.end = t.arr[t.arr.length - 1];
      t.date = date;
      t.type = type;
      t.key = date + '|' + t.id;
    }
    trips.sort((a, b) => a.start - b.start);
    const byStation = new Map<string, [Trip, number][]>();
    trips.forEach((t) =>
      t.sids.forEach((s, i) => {
        if (!(t.flags[i] & 1)) return;
        let arr = byStation.get(s);
        if (!arr) {
          arr = [];
          byStation.set(s, arr);
        }
        arr.push([t, i]);
      }),
    );
    const bundle: DayBundle = {
      date,
      type,
      trips,
      byStation,
      byId: new Map(trips.map((t) => [t.id, t])),
    };
    this.dayCache.set(date, bundle);
    if (this.dayCache.size > 5) {
      const firstKey = this.dayCache.keys().next().value;
      if (firstKey !== undefined) this.dayCache.delete(firstKey);
    }
    return bundle;
  }

  windows(clock: ClockState): { d: DayBundle; t: number }[] {
    return [
      { d: this.day(clock.date), t: clock.sec },
      { d: this.day(addDays(clock.date, -1)), t: clock.sec + 86400 },
    ];
  }

  state(trip: Trip, t: number): TrainState | null {
    const { sids } = trip;
    const n = sids.length;
    const { dep, arr } = this.vtimes(trip);
    if (t < dep[0] - 90 || t > arr[n - 1]) return null;
    if (t < dep[0]) {
      const pl0 = this.seg(sids[0], sids[1]);
      return {
        kind: 'dwell',
        at: 0,
        next: 1,
        p: this.pos(sids[0]),
        bearing: pl0.len ? along(pl0, 0).bearing : 0,
        progress: 0,
        nextStop: this.nextStopIdx(trip, 1),
      };
    }
    let lo = 0;
    let hi = n - 1;
    while (lo < hi) {
      const m = (lo + hi + 1) >> 1;
      if (dep[m] <= t) lo = m;
      else hi = m - 1;
    }
    const i = lo;
    if (i >= n - 1) {
      return {
        kind: 'dwell',
        at: n - 1,
        next: null,
        p: this.pos(sids[n - 1]),
        bearing: 0,
        progress: 1,
      };
    }
    if (t >= arr[i + 1]) {
      return {
        kind: 'dwell',
        at: i + 1,
        next: i + 2 < n ? i + 2 : null,
        p: this.pos(sids[i + 1]),
        bearing: 0,
        progress: (i + 1) / (n - 1),
        nextStop: this.nextStopIdx(trip, i + 1),
      };
    }
    const pl = this.seg(sids[i], sids[i + 1]);
    const m = this.segMotion(trip, i);
    const mv = moveAt(m, t - dep[i]);
    const f = pl.len ? mv.s / pl.len : 1;
    const a = along(pl, f);
    return {
      kind: 'run',
      from: i,
      next: i + 1,
      p: a.p,
      bearing: a.bearing,
      progress: (i + f) / (n - 1),
      nextStop: this.nextStopIdx(trip, i + 1),
      v: mv.v,
      vc: m.vc,
      d: mv.s,
    };
  }

  trail(trip: Trip, s: TrainState, len: number): TrailResult {
    const { sids } = trip;
    const pts: [number, number][] = [];
    const cum: number[] = [];
    let i: number;
    let d: number;
    if (s.kind === 'run') {
      i = s.from ?? 0;
      d = s.d ?? 0;
    } else if ((s.at ?? 0) > 0) {
      i = (s.at ?? 1) - 1;
      d = Infinity;
    } else {
      i = 0;
      d = 0;
    }
    let acc = 0;
    const push = (q: [number, number]) => {
      let point = q;
      if (pts.length) {
        const a = pts[pts.length - 1];
        const dd = haversine(a, point);
        if (dd < 0.01) return;
        if (acc + dd > len) {
          const t = (len - acc) / dd;
          point = [a[0] + (point[0] - a[0]) * t, a[1] + (point[1] - a[1]) * t];
          acc = len;
        } else {
          acc += dd;
        }
      }
      pts.push(point);
      cum.push(acc);
    };
    while (i >= 0 && acc < len) {
      const pl = this.seg(sids[i], sids[i + 1]);
      const { coords, cum: c } = pl;
      const dh = Math.min(d, pl.len);
      let k = c.length - 1;
      while (k > 0 && c[k - 1] >= dh) k--;
      if (!pts.length) push(along(pl, pl.len ? dh / pl.len : 0).p);
      for (let j = k - 1; j >= 0 && acc < len; j--) push(coords[j]);
      i--;
      d = Infinity;
    }
    if (acc < len && pts.length) {
      const a = pts[pts.length - 1];
      const b = pts.length > 1 ? pts[pts.length - 2] : null;
      let dx: number;
      let dy: number;
      if (b) {
        dx = a[0] - b[0];
        dy = a[1] - b[1];
      } else {
        const q = along(this.seg(sids[0], sids[1]), 0.02).p;
        dx = a[0] - q[0];
        dy = a[1] - q[1];
      }
      const k = Math.cos((a[1] * Math.PI) / 180);
      const m = Math.hypot(dx * k, dy) * 111320 || 1;
      const r = (len - acc) / m;
      pts.push([a[0] + dx * r, a[1] + dy * r]);
      cum.push(len);
    }
    return { pts, cum };
  }

  vtimes(trip: Trip): { dep: number[]; arr: number[] } {
    if (trip._vt) return trip._vt;
    const { sids, flags } = trip;
    const n = sids.length;
    const A = trip.arr.slice();
    const P = trip.dep.slice();
    const l = this.lines.get(trip.line);
    const urban = l ? /^(krl|mrt|lrtj|jbdb|bandara)$/.test(l.sys) : false;
    for (let i = 1; i < n - 1; i++) {
      if (!(flags[i] & 1)) A[i] = P[i];
      else if (urban) A[i] = Math.max(A[i], P[i] - 40);
    }
    const a = this.accelOf(trip);
    const vr = l?.id === 'kcic-f' ? VREF.regional : (l ? VREF[l.sys] : 20) || 20;
    const anchors = [0];
    for (let i = 1; i < n; i++) {
      if (i === n - 1 || A[i] - P[anchors[anchors.length - 1]] >= 600) anchors.push(i);
    }
    for (let w = 0; w < anchors.length - 1; w++) {
      const s0 = anchors[w];
      const e = anchors[w + 1];
      if (e - s0 < 2) continue;
      let dwell = 0;
      let ideal = 0;
      const id: number[] = [];
      for (let j = s0; j < e; j++) {
        if (j > s0) dwell += P[j] - A[j];
        const x =
          this.seg(sids[j], sids[j + 1]).len / vr +
          ((flags[j] & 1) + (flags[j + 1] & 1)) * (vr / (2 * a));
        id.push(x);
        ideal += x;
      }
      const R = A[e] - P[s0] - dwell;
      if (R <= 0 || ideal <= 0) continue;
      let t = P[s0];
      for (let j = s0; j < e; j++) {
        const dw = j + 1 < e ? P[j + 1] - A[j + 1] : 0;
        t += (id[j - s0] * R) / ideal;
        if (j + 1 < e) {
          A[j + 1] = t;
          t += dw;
          P[j + 1] = t;
        }
      }
    }
    return (trip._vt = { dep: P, arr: A });
  }

  passes(a: string, b: string, dA: number, clock: ClockState, horizon = 3 * 3600, limit = 8): JplPass[] {
    const L = this.seg(a, b).len;
    const out: JplPass[] = [];
    for (const { d, t: now } of this.windows(clock)) {
      if (!d.segIdx) {
        d.segIdx = new Map();
        for (const trip of d.trips) {
          for (let i = 0; i < trip.sids.length - 1; i++) {
            const x = trip.sids[i];
            const y = trip.sids[i + 1];
            const k = x < y ? x + '>' + y : y + '>' + x;
            let list = d.segIdx.get(k);
            if (!list) {
              list = [];
              d.segIdx.set(k, list);
            }
            list.push([trip, i]);
          }
        }
      }
      const entries = d.segIdx.get(a < b ? a + '>' + b : b + '>' + a) || [];
      for (const [trip, i] of entries) {
        if (trip.end < now - 60 || trip.start > now + horizon || !this.shown(trip)) continue;
        const fwd = trip.sids[i] === a;
        const dist = Math.max(0, Math.min(L, fwd ? dA : L - dA));
        const V = this.vtimes(trip);
        const m = this.segMotion(trip, i);
        let lo = 0;
        let hi = m.T;
        for (let k = 0; k < 32; k++) {
          const mid = (lo + hi) / 2;
          if (moveAt(m, mid).s < dist) lo = mid;
          else hi = mid;
        }
        const tp = V.dep[i] + hi;
        if (tp < now - 60 || tp > now + horizon) continue;
        out.push({ trip, at: tp, dt: tp - now, v: moveAt(m, hi).v, toward: fwd ? b : a });
      }
    }
    return out.sort((x, y) => x.dt - y.dt).slice(0, limit);
  }

  accelOf(trip: Trip): number {
    if (trip._a) return trip._a;
    const l = this.lines.get(trip.line);
    return (trip._a = l?.id === 'kcic-f' ? ACCEL.regional : (l ? ACCEL[l.sys] : 0.4) || 0.4);
  }

  segMotion(trip: Trip, i: number): MotionProfile {
    const c = trip._m || (trip._m = []);
    if (c[i]) return c[i];
    const pl = this.seg(trip.sids[i], trip.sids[i + 1]);
    const V = this.vtimes(trip);
    return (c[i] = motion(pl.len, V.arr[i + 1] - V.dep[i], this.accelOf(trip), trip.flags[i] & 1, trip.flags[i + 1] & 1));
  }

  speedProfile(trip: Trip, samples = 200): SpeedProfile {
    if (trip._sp) return trip._sp;
    const n = trip.sids.length;
    const legs: SpeedLeg[] = [];
    let D = 0;
    let vmax = 0;
    let run = 0;
    for (let i = 0; i < n - 1; i++) {
      const m = this.segMotion(trip, i);
      D += m.D;
      run += m.T;
      vmax = Math.max(vmax, m.vc);
      const segKey = trip.sids[i] < trip.sids[i + 1] ? trip.sids[i] + '>' + trip.sids[i + 1] : trip.sids[i + 1] + '>' + trip.sids[i];
      legs.push({
        i,
        D: m.D,
        T: m.T,
        avg: m.T > 0 ? m.D / m.T : 0,
        vmax: m.vc,
        straight: !this.segs[segKey],
      });
    }
    const V = this.vtimes(trip);
    const T0 = V.dep[0];
    const T1 = V.arr[n - 1];
    const pts: [number, number][] = [];
    for (let k = 0; k <= samples; k++) {
      const t = T0 + ((T1 - T0) * k) / samples;
      let lo = 0;
      let hi = n - 1;
      while (lo < hi) {
        const m = (lo + hi + 1) >> 1;
        if (V.dep[m] <= t) lo = m;
        else hi = m - 1;
      }
      const v = lo >= n - 1 || t >= V.arr[lo + 1] ? 0 : moveAt(this.segMotion(trip, lo), t - V.dep[lo]).v;
      pts.push([t, v]);
    }
    return (trip._sp = {
      D,
      T: T1 - T0,
      run,
      avg: T1 > T0 ? D / (T1 - T0) : 0,
      runAvg: run ? D / run : 0,
      vmax,
      legs,
      pts,
    });
  }

  nextStopIdx(trip: Trip, i: number): number {
    for (let k = i; k < trip.sids.length; k++) {
      if (trip.flags[k] & 1) return k;
    }
    return trip.sids.length - 1;
  }

  pos(sid: string): [number, number] {
    const s = this.st.get(sid);
    return s ? [s.lng, s.lat] : [106.83, -6.24];
  }

  active(clock: ClockState): { trip: Trip; off: number }[] {
    const out: { trip: Trip; off: number }[] = [];
    for (const { d, t } of this.windows(clock)) {
      for (const trip of d.trips) {
        if (trip.start - 120 > t) break;
        if (trip.end + 5 >= t) out.push({ trip, off: t - clock.sec });
      }
    }
    return out;
  }

  running(clock: ClockState, act = this.active(clock)): RunningTrain[] {
    const out: RunningTrain[] = [];
    for (const a of act) {
      const t = clock.sec + a.off;
      const s = this.state(a.trip, t);
      if (s) out.push({ trip: a.trip, s, t });
    }
    return out;
  }

  find(id: string, clock: ClockState, date?: string): { trip: Trip; t: number } | null {
    if (date) {
      const d = this.day(date);
      const trip = d.byId.get(id);
      if (trip) {
        return {
          trip,
          t: clock.sec + Math.round((Date.parse(clock.date) - Date.parse(date)) / 864e5) * 86400,
        };
      }
    }
    for (const { d, t } of this.windows(clock)) {
      const trip = d.byId.get(id);
      if (trip && trip.end >= t - 1800) return { trip, t };
    }
    const trip = this.day(clock.date).byId.get(id);
    return trip ? { trip, t: clock.sec } : null;
  }

  departures(sid: string, clock: ClockState, limit = 40, horizon = 6 * 3600): DepartureItem[] {
    const out: DepartureItem[] = [];
    for (const { d, t } of this.windows(clock)) {
      for (const [trip, i] of d.byStation.get(sid) || []) {
        if (i === trip.sids.length - 1 || !this.shown(trip)) continue;
        const dep = trip.dep[i];
        if (dep >= t - 30 && dep <= t + horizon) out.push({ trip, i, dep, wait: dep - t });
      }
    }
    out.sort((a, b) => a.wait - b.wait);
    return out.slice(0, limit);
  }

  stationDay(sid: string, date: string): { rows: StationDayRow[]; groups: [string, StationDayRow[]][] } {
    const d = this.day(date);
    const rows: StationDayRow[] = [];
    for (const [trip, i] of d.byStation.get(sid) || []) {
      if (!this.shown(trip)) continue;
      const last = i === trip.sids.length - 1;
      rows.push({ trip, i, dep: trip.dep[i], arr: trip.arr[i], terminates: last, origin: i === 0 });
    }
    rows.sort((a, b) => a.dep - b.dep);
    const groups = new Map<string, StationDayRow[]>();
    for (const r of rows) {
      const k = r.terminates ? 'Tiba (stasiun akhir)' : r.trip.head;
      let list = groups.get(k);
      if (!list) {
        list = [];
        groups.set(k, list);
      }
      list.push(r);
    }
    return { rows, groups: [...groups.entries()].sort((a, b) => b[1].length - a[1].length) };
  }

  lineGrid(lineId: string, date: string, dir = 0): { trips: Trip[]; rows: LineGridRow[] } {
    const l = this.lines.get(lineId);
    if (!l) return { trips: [], rows: [] };
    const order = [...l.stations];
    for (const b of l.branches || []) {
      const rest = b.filter((s) => !order.includes(s));
      if (!rest.length) continue;
      const firstNew = b.indexOf(rest[0]);
      const jIn = firstNew > 0 ? b[firstNew - 1] : b.find((s) => order.includes(s));
      const at = jIn ? order.indexOf(jIn) : -1;
      const seq = firstNew > 0 ? rest : rest.slice().reverse();
      if (at >= 0) order.splice(at + 1, 0, ...seq);
      else order.push(...seq);
    }
    const idx = new Map(order.map((s, i) => [s, i]));
    const trips = this.day(date)
      .trips.filter((t) => t.line === lineId)
      .filter((t) => {
        const first = t.sids.find((s) => idx.has(s));
        let last: string | undefined;
        for (let k = t.sids.length - 1; k >= 0; k--) {
          if (idx.has(t.sids[k])) {
            last = t.sids[k];
            break;
          }
        }
        const a = first !== undefined ? idx.get(first) : undefined;
        const b = last !== undefined ? idx.get(last) : undefined;
        return a === undefined || b === undefined ? false : dir === 0 ? b >= a : b < a;
      });
    trips.sort((a, b) => a.start - b.start);
    const rows: LineGridRow[] = (dir === 0 ? order : [...order].reverse()).map((s) => ({ sid: s, cells: [] }));
    const rIdx = new Map(rows.map((r, i) => [r.sid, i]));
    trips.forEach((t, c) => {
      t.sids.forEach((s, i) => {
        const r = rIdx.get(s);
        if (r === undefined) return;
        rows[r].cells[c] = t.flags[i] & 1 ? t.dep[i] : -1;
      });
    });
    return { trips, rows: rows.filter((r) => r.cells.some((x) => x !== undefined)) };
  }

  lineSpan(lineId: string, date: string): { first: number; last: number; count: number } | null {
    const d = this.day(date);
    let a = Infinity;
    let b = -Infinity;
    let n = 0;
    for (const t of d.trips) {
      if (t.line === lineId) {
        n++;
        a = Math.min(a, t.start);
        b = Math.max(b, t.start);
      }
    }
    return n ? { first: a, last: b, count: n } : null;
  }

  /* ---------------- Journey Planner: Connection Scan Algorithm ---------------- */

  stationIndex() {
    if (this._sidx) return this._sidx;
    const ids = this.net.stations.map((s) => s.id);
    const idx = new Map(ids.map((s, i) => [s, i]));
    const foot: [number, number][][] = ids.map(() => []);
    for (const s of this.net.stations) {
      for (const x of s.xfer || []) {
        const o = this.st.get(x);
        const xi = idx.get(x);
        const si = idx.get(s.id);
        if (!o || xi === undefined || si === undefined) continue;
        const w = Math.round(120 + (haversine([s.lng, s.lat], [o.lng, o.lat]) * 1.4) / WALK_SPEED);
        foot[si].push([xi, w]);
      }
    }
    return (this._sidx = { ids, idx, foot });
  }

  connections(date: string): Connection[] {
    const k = date + (this.kai ? '+k' : '') + (this.fr ? '+f' : '');
    const cached = this.connCache.get(k);
    if (cached) return cached;
    const { idx } = this.stationIndex();
    const out: Connection[] = [];
    for (const [d, off] of [
      [this.day(addDays(date, -1)), -86400],
      [this.day(date), 0],
      [this.day(addDays(date, 1)), 86400],
    ] as [DayBundle, number][]) {
      for (const t of d.trips) {
        if (t.freight) continue;
        let prev = -1;
        for (let i = 0; i < t.sids.length; i++) {
          if (!(t.flags[i] & 1)) continue;
          if (prev >= 0) {
            const a = idx.get(t.sids[prev]);
            const b = idx.get(t.sids[i]);
            if (a !== undefined && b !== undefined) {
              out.push({ dep: t.dep[prev] + off, arr: t.arr[i] + off, a, b, trip: t, i: prev, j: i, off });
            }
          }
          prev = i;
        }
      }
    }
    out.sort((x, y) => x.dep - y.dep || x.arr - y.arr);
    this.connCache.set(k, out);
    if (this.connCache.size > 3) {
      const firstKey = this.connCache.keys().next().value;
      if (firstKey !== undefined) this.connCache.delete(firstKey);
    }
    return out;
  }

  plan1(from: string, to: string, date: string, t0: number, maxTransfers = 5): Journey | null {
    const { ids, idx, foot } = this.stationIndex();
    const A = idx.get(from);
    const B = idx.get(to);
    if (A === undefined || B === undefined || A === B) return null;
    const C = this.connections(date);
    const n = idx.size;
    const INF = 1e12;
    const ready = new Float64Array(n).fill(INF);
    const arrive = new Float64Array(n).fill(INF);
    const via: Array<{ enter?: number; exit?: number; walk?: number; w?: number } | undefined> = new Array(n);
    const legs = new Int8Array(n);
    const tripEnter = new Map<string, number>();
    const tripLegs = new Map<string, number>();
    ready[A] = t0;
    arrive[A] = t0;
    for (const [x, w] of foot[A]) {
      if (t0 + w < ready[x]) {
        ready[x] = t0 + w;
        arrive[x] = t0 + w;
        via[x] = { walk: A, w };
      }
    }
    let lo = 0;
    let hi = C.length;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (C[m].dep < t0) lo = m + 1;
      else hi = m;
    }
    for (let c = lo; c < C.length; c++) {
      const k = C[c];
      if (k.dep >= arrive[B]) break;
      if (k.dep > t0 + 36 * 3600) break;
      const key = k.trip.key;
      let entered = tripEnter.has(key);
      if (!entered && ready[k.a] <= k.dep) {
        const nl = legs[k.a] + 1;
        if (nl > maxTransfers + 1) continue;
        tripEnter.set(key, c);
        tripLegs.set(key, nl);
        entered = true;
      }
      if (!entered) continue;
      if (k.arr < arrive[k.b]) {
        arrive[k.b] = k.arr;
        ready[k.b] = Math.min(ready[k.b], k.arr + CHANGE);
        via[k.b] = { enter: tripEnter.get(key), exit: c };
        legs[k.b] = tripLegs.get(key) ?? 0;
        for (const [x, w] of foot[k.b]) {
          if (k.arr + w < ready[x]) {
            ready[x] = k.arr + w;
            if (k.arr + w < arrive[x]) {
              arrive[x] = k.arr + w;
              via[x] = { walk: k.b, w };
              legs[x] = legs[k.b];
            }
          }
        }
      }
    }
    if (arrive[B] >= INF) return null;
    const out: JourneyLeg[] = [];
    let s = B;
    let guard = 0;
    while (s !== A && guard++ < 50) {
      const v = via[s];
      if (!v) return null;
      if (v.walk !== undefined && v.w !== undefined) {
        out.push({ walk: true, from: ids[v.walk], to: ids[s], dep: 0, arr: 0, dur: v.w });
        s = v.walk;
        continue;
      }
      if (v.enter === undefined || v.exit === undefined) return null;
      const e = C[v.enter];
      const x = C[v.exit];
      out.push({
        trip: e.trip,
        i: e.i,
        j: x.j,
        dep: e.dep,
        arr: x.arr,
        off: e.off,
        from: ids[e.a],
        to: ids[x.b],
      });
      s = e.a;
    }
    out.reverse();
    let t = t0;
    for (const l of out) {
      if (l.walk && l.dur !== undefined) {
        l.dep = t;
        l.arr = t + l.dur;
        t = l.arr;
      } else {
        t = l.arr;
      }
    }
    for (let i = 0; i < out.length; i++) {
      const cur = out[i];
      const nx = out[i + 1];
      if (cur.walk && cur.dur !== undefined && nx && !nx.walk) {
        cur.arr = Math.min(cur.arr, nx.dep);
        cur.dep = cur.arr - cur.dur;
      }
    }
    const rides = out.filter((l) => !l.walk);
    if (!rides.length) return null;
    return {
      legs: out,
      dep: rides[0].dep,
      arr: rides[rides.length - 1].arr,
      transfers: rides.length - 1,
      date,
    };
  }

  plan(from: string, to: string, date: string, t0: number, n = 5): Journey[] {
    const res: Journey[] = [];
    let t = t0;
    const seen = new Set<string>();
    for (let k = 0; k < 30 && res.length < n * 2; k++) {
      const j = this.plan1(from, to, date, t);
      if (!j) break;
      const sig = j.legs
        .filter((l) => !l.walk && l.trip)
        .map((l) => `${l.trip!.key}${l.i}-${l.j}`)
        .join(',');
      if (!seen.has(sig)) {
        seen.add(sig);
        if (!res.some((r) => r.arr <= j.arr && r.dep >= j.dep)) res.push(j);
      }
      t = j.dep + 60;
    }
    return res
      .filter((r) => !res.some((o) => o !== r && o.dep >= r.dep && o.arr <= r.arr && (o.dep > r.dep || o.arr < r.arr)))
      .slice(0, n);
  }
}
