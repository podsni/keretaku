import type { Engine } from './sched';
import { haversine } from './sched';
import { STOCK, stockKey } from './stock';
import type { ClockState, Line, Trip } from './types';

export interface LiveGpsFix {
  lng: number;
  lat: number;
  accuracy: number; // meters
  speedMps: number | null;
  heading: number | null;
  timestamp: number;
}

export interface GpsTrackMatch {
  snappedCoord: [number, number];
  offTrackMeters: number;
  onCorridor: boolean; // within 2,500 m of the train's rail corridor
  segIndex: number;
  fromStationId: string;
  toStationId: string;
  nextStopIndex: number;
  nextStopStationId: string;
  distToNextStopMeters: number;
  progress: number; // 0..1 along total trip track length
  expectedSecAtPosition: number;
  scheduleDeltaSec: number; // positive = behind GAPEKA (late), negative = ahead (early)
  gpsKmh: number | null;
}

export interface ConsistCarItem {
  index: number;
  code: string;
  role: string;
  lengthM: number;
  bodyColor: string;
  stripePrimary: string;
  stripeSecondary: string;
  isLoco: boolean;
  isCabFront: boolean;
  isCabRear: boolean;
}

export interface ConsistSummary {
  stockId: string;
  name: string;
  model: string;
  formationLabel: string;
  totalCars: number;
  totalLengthM: number;
  isFreight: boolean;
  cars: ConsistCarItem[];
}

const LIVERY_COLORS: Record<string, [string, string, string]> = {
  krl: ['#D5D9DF', '#E30A16', '#FFC20E'],
  mrt: ['#D3D8DE', '#0B3A82', '#3FA9F5'],
  lrtj: ['#FFFFFF', '#E8412C', '#F7A21B'],
  jbdb: ['#F2F4F7', '#20409A', '#E30A16'],
  whoosh: ['#FFFFFF', '#D7192D', '#8E99A4'],
  ea203: ['#E6E9ED', '#002B5C', '#F39200'],
  sky: ['#FFFFFF', '#1E88E5', '#90CAF9'],
  cc206: ['#F4F5F7', '#24398F', '#F7941D'],
  cc201: ['#24398F', '#F7941D', '#F4F5F7'],
  argo: ['#C7CCD3', '#5E6670', '#E87722'],
  argoP: ['#A3AAB3', '#5E6670', '#E87722'],
  coach: ['#F4F5F7', '#24398F', '#F7941D'],
  coachP: ['#C9CDD3', '#24398F', '#F7941D'],
  lokal: ['#F4F5F7', '#F7941D', '#24398F'],
  ketel: ['#D6DADF', '#F3F4F6', '#D7192D'],
  ketelB: ['#D6DADF', '#F3F4F6', '#0067B1'],
  ctrA: ['#1F5FA8', '#1A528F', '#123B66'],
  ctrB: ['#D9631E', '#BF5519', '#8C3D10'],
  ctrC: ['#2E7D4F', '#266B43', '#1A4A2E'],
  ctrD: ['#E4E6E9', '#C9CDD2', '#9AA0A7'],
  flat: ['#3B3E44', '#55595F', '#2A2C30'],
  bagasi: ['#E9EBEE', '#24398F', '#F7941D'],
  tertutup: ['#7A6A58', '#6A5B4B', '#55493C'],
  hopper: ['#8C9198', '#6F747B', '#A9AEB4'],
};

/** Build a structured visual consist / stamformasi breakdown for a train line. */
export function buildConsistSummary(line: Line): ConsistSummary {
  const key = stockKey(line);
  const spec = STOCK[key] || STOCK.ka;
  let coachNum = 0;

  const cars: ConsistCarItem[] = spec.cars.map((car, idx) => {
    const [bodyColor, stripePrimary, stripeSecondary] = LIVERY_COLORS[car.liv] || ['#E2E8F0', line.color, '#94A3B8'];
    let code = String(idx + 1);
    let role = 'Kereta Penumpang';

    if (car.loco) {
      code = car.liv === 'cc201' ? 'CC201' : 'CC206';
      role = `Lokomotif ${code}`;
    } else if (car.liv === 'argoP' || car.liv === 'coachP') {
      code = 'P';
      role = 'Kereta Pembangkit (P)';
    } else if (car.liv === 'argo') {
      coachNum++;
      if (coachNum === 5) {
        code = 'M1';
        role = 'Kereta Makan (M1)';
      } else {
        code = `K1-${coachNum > 5 ? coachNum - 1 : coachNum}`;
        role = `Eksekutif Stainless (${code})`;
      }
    } else if (car.liv === 'coach') {
      coachNum++;
      if (coachNum === 5) {
        code = 'M';
        role = 'Kereta Makan (M)';
      } else {
        code = `K${coachNum > 5 ? coachNum - 1 : coachNum}`;
        role = `Kereta Penumpang (${code})`;
      }
    } else if (car.liv === 'lokal') {
      coachNum++;
      code = `K3-${coachNum}`;
      role = `Ekonomi Lokal (${code})`;
    } else if (car.liv === 'whoosh') {
      code = `0${idx + 1}`;
      role = idx === 0 || idx === spec.cars.length - 1 ? `First / Business (${code})` : `Premium Economy (${code})`;
    } else if (car.liv === 'krl' || car.liv === 'mrt' || car.liv === 'lrtj' || car.liv === 'jbdb' || car.liv === 'ea203' || car.liv === 'sky') {
      code = `K${idx + 1}`;
      role =
        car.cab === 'f'
          ? `Kereta Kabin Depan (${code})`
          : car.cab === 'r'
            ? `Kereta Kabin Belakang (${code})`
            : `Kereta Penumpang (${code})`;
    } else if (car.liv.startsWith('ketel')) {
      code = `GK${idx}`;
      role = 'Gerbong Ketel (BBM/Cair)';
    } else if (car.liv.startsWith('ctr') || car.liv === 'flat') {
      code = `GD${idx}`;
      role = 'Gerbong Datar Peti Kemas';
    } else if (car.liv === 'bagasi') {
      code = `B${idx}`;
      role = 'Kereta Bagasi Parcel';
    } else {
      code = `GB${idx}`;
      role = 'Gerbong Barang';
    }

    return {
      index: idx,
      code,
      role,
      lengthM: car.len,
      bodyColor,
      stripePrimary,
      stripeSecondary,
      isLoco: Boolean(car.loco),
      isCabFront: car.cab === 'f',
      isCabRear: car.cab === 'r',
    };
  });

  return {
    stockId: key,
    name: spec.name,
    model: spec.model,
    formationLabel: spec.note,
    totalCars: spec.cars.length,
    totalLengthM: Math.round(spec.len),
    isFreight: Boolean(spec.freight),
    cars,
  };
}

/** Project a point [lng, lat] onto segment a->b in local equirectangular coordinates. */
export function projectPointOnSegment(
  p: [number, number],
  a: [number, number],
  b: [number, number],
): { point: [number, number]; t: number; distMeters: number } {
  const cosLat = Math.cos(((a[1] + b[1]) * 0.5 * Math.PI) / 180);
  const ax = a[0] * cosLat;
  const ay = a[1];
  const bx = b[0] * cosLat;
  const by = b[1];
  const px = p[0] * cosLat;
  const py = p[1];

  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  let t = 0;
  if (lenSq > 1e-14) {
    t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  }
  const point: [number, number] = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  return { point, t, distMeters: haversine(p, point) };
}

/** Snap a live device GPS fix onto a trip's OpenStreetMap track polylines & compare with GAPEKA schedule. */
export function snapGpsToTrip(
  engine: Engine,
  trip: Trip,
  clock: ClockState,
  fix: LiveGpsFix,
): GpsTrackMatch | null {
  if (trip.sids.length < 2) return null;

  const p: [number, number] = [fix.lng, fix.lat];
  let bestDist = Infinity;
  let bestPoint: [number, number] = p;
  let bestSegIdx = 0;
  let bestSegOffsetM = 0;
  let bestCumDistM = 0;

  let runningCumM = 0;
  const segStartsM: number[] = [];
  const segLensM: number[] = [];

  for (let i = 0; i < trip.sids.length - 1; i++) {
    const pl = engine.seg(trip.sids[i], trip.sids[i + 1]);
    segStartsM.push(runningCumM);
    segLensM.push(pl.len);

    const coords = pl.coords;
    for (let j = 0; j < coords.length - 1; j++) {
      const proj = projectPointOnSegment(p, coords[j], coords[j + 1]);
      if (proj.distMeters < bestDist) {
        bestDist = proj.distMeters;
        bestPoint = proj.point;
        bestSegIdx = i;
        const subLen = pl.cum[j + 1] - pl.cum[j];
        bestSegOffsetM = pl.cum[j] + subLen * proj.t;
        bestCumDistM = runningCumM + bestSegOffsetM;
      }
    }
    runningCumM += pl.len;
  }

  const totalLenM = Math.max(1, runningCumM);
  const progress = Math.max(0, Math.min(1, bestCumDistM / totalLenM));

  // Find next stopping station ahead of snapped position
  let nextStopIndex = trip.sids.length - 1;
  for (let k = bestSegIdx + 1; k < trip.sids.length; k++) {
    if (trip.flags[k] & 1) {
      nextStopIndex = k;
      break;
    }
  }
  const nextStopCumM =
    nextStopIndex < segStartsM.length ? segStartsM[nextStopIndex] : totalLenM;
  const distToNextStopMeters = Math.max(0, nextStopCumM - bestCumDistM);

  // Expected GAPEKA time at the snapped position along bestSegIdx
  const segLen = Math.max(1, segLensM[bestSegIdx] || 1);
  const segFrac = Math.max(0, Math.min(1, bestSegOffsetM / segLen));
  const tStartSeg = trip.dep[bestSegIdx];
  const tEndSeg = trip.arr[bestSegIdx + 1];
  const expectedSecAtPosition = tStartSeg + (tEndSeg - tStartSeg) * segFrac;

  const currentTripClockSec = clock.sec + (trip.date === clock.date ? 0 : 86400);
  const scheduleDeltaSec = Math.round(currentTripClockSec - expectedSecAtPosition);

  const gpsKmh =
    fix.speedMps !== null && Number.isFinite(fix.speedMps) && fix.speedMps >= 0
      ? Math.round(fix.speedMps * 3.6)
      : null;

  return {
    snappedCoord: bestPoint,
    offTrackMeters: Math.round(bestDist),
    onCorridor: bestDist <= 2500,
    segIndex: bestSegIdx,
    fromStationId: trip.sids[bestSegIdx],
    toStationId: trip.sids[bestSegIdx + 1],
    nextStopIndex,
    nextStopStationId: trip.sids[nextStopIndex],
    distToNextStopMeters: Math.round(distToNextStopMeters),
    progress,
    expectedSecAtPosition,
    scheduleDeltaSec,
    gpsKmh,
  };
}

/** Format schedule delta in Indonesian ("Tepat waktu", "+4 mnt dari jadwal", "-2 mnt lebih awal"). */
export function formatScheduleDelta(deltaSec: number): {
  label: string;
  tone: 'ontime' | 'late' | 'early';
} {
  const mins = Math.round(deltaSec / 60);
  if (Math.abs(mins) <= 1) {
    return { label: 'Sesuai jadwal GAPEKA', tone: 'ontime' };
  }
  if (mins > 1) {
    return { label: `+${mins} mnt dari jadwal`, tone: 'late' };
  }
  return { label: `${Math.abs(mins)} mnt lebih awal`, tone: 'early' };
}
