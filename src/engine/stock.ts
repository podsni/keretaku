import type { GeoJsonFeature, Line } from './types';
import type { TrailResult } from './sched';

interface Livery {
  b: string;
  s1: string;
  s2: string;
  cab?: string;
  nose?: number;
  nw?: number;
}

interface CarSpec {
  len: number;
  liv: string;
  cab?: 'f' | 'r' | '';
  loco?: boolean;
}

export interface StockSpec {
  name: string;
  model: string;
  note: string;
  freight?: boolean;
  cars: CarSpec[];
  len: number;
}

const C: Record<string, Livery> = {
  krl: { b: '#D5D9DF', s1: '#E30A16', s2: '#FFC20E', cab: '#E30A16', nose: 1.6, nw: 0.9 },
  mrt: { b: '#D3D8DE', s1: '#0B3A82', s2: '#3FA9F5', cab: '#0B3A82', nose: 1.8, nw: 0.88 },
  lrtj: { b: '#FFFFFF', s1: '#E8412C', s2: '#F7A21B', cab: '#E8412C', nose: 1.6, nw: 0.85 },
  jbdb: { b: '#F2F4F7', s1: '#20409A', s2: '#E30A16', cab: '#20409A', nose: 2, nw: 0.85 },
  whoosh: { b: '#FFFFFF', s1: '#D7192D', s2: '#8E99A4', cab: '#FFFFFF', nose: 11, nw: 0.5 },
  ea203: { b: '#E6E9ED', s1: '#002B5C', s2: '#F39200', cab: '#002B5C', nose: 1.8, nw: 0.88 },
  sky: { b: '#FFFFFF', s1: '#1E88E5', s2: '#90CAF9', cab: '#1E88E5', nose: 1.5, nw: 0.8 },
  cc206: { b: '#F4F5F7', s1: '#24398F', s2: '#F7941D', cab: '#24398F', nose: 1.2, nw: 0.92 },
  cc201: { b: '#24398F', s1: '#F7941D', s2: '#F4F5F7', cab: '#F7941D', nose: 1.2, nw: 0.92 },
  argo: { b: '#C7CCD3', s1: '#5E6670', s2: '#E87722' },
  argoP: { b: '#A3AAB3', s1: '#5E6670', s2: '#E87722' },
  coach: { b: '#F4F5F7', s1: '#24398F', s2: '#F7941D' },
  coachP: { b: '#C9CDD3', s1: '#24398F', s2: '#F7941D' },
  lokal: { b: '#F4F5F7', s1: '#F7941D', s2: '#24398F' },
  ketel: { b: '#D6DADF', s1: '#F3F4F6', s2: '#D7192D' },
  ketelB: { b: '#D6DADF', s1: '#F3F4F6', s2: '#0067B1' },
  ctrA: { b: '#1F5FA8', s1: '#1A528F', s2: '#123B66' },
  ctrB: { b: '#D9631E', s1: '#BF5519', s2: '#8C3D10' },
  ctrC: { b: '#2E7D4F', s1: '#266B43', s2: '#1A4A2E' },
  ctrD: { b: '#E4E6E9', s1: '#C9CDD2', s2: '#9AA0A7' },
  flat: { b: '#3B3E44', s1: '#55595F', s2: '#2A2C30' },
  bagasi: { b: '#E9EBEE', s1: '#24398F', s2: '#F7941D' },
  tertutup: { b: '#7A6A58', s1: '#6A5B4B', s2: '#55493C' },
  hopper: { b: '#8C9198', s1: '#6F747B', s2: '#A9AEB4' },
};

const emu = (n: number, len: number, liv: string, endLen = len): CarSpec[] =>
  Array.from({ length: n }, (_, i) => ({
    len: i === 0 || i === n - 1 ? endLen : len,
    liv,
    cab: i === 0 ? 'f' : i === n - 1 ? 'r' : '',
  }));

const hauled = (loco: string, locoLen: number, coaches: string[]): CarSpec[] => [
  { len: locoLen, liv: loco, cab: 'f', loco: true },
  ...coaches.map((liv) => ({ len: 20.9, liv })),
];

const wagons = (loco: string, locoLen: number, livs: string[], n: number, len: number): CarSpec[] => [
  { len: locoLen, liv: loco, cab: 'f', loco: true },
  ...Array.from({ length: n }, (_, i) => ({ len, liv: livs[i % livs.length] })),
];

const RAW_STOCK: Record<string, Omit<StockSpec, 'len'>> = {
  krl12: { name: 'KRL Commuter Line', model: 'JR 205 / CLI-125', note: '12 kereta', cars: emu(12, 20, 'krl') },
  krl10: { name: 'KRL Commuter Line', model: 'JR 205 / CLI-125', note: '10 kereta', cars: emu(10, 20, 'krl') },
  krl8: { name: 'KRL Commuter Line', model: 'JR 205 / CLI-125', note: '8 kereta', cars: emu(8, 20, 'krl') },
  mrt: { name: 'MRT Jakarta', model: 'Nippon Sharyo', note: '6 kereta', cars: emu(6, 20, 'mrt') },
  lrtj: { name: 'LRT Jakarta', model: 'Hyundai Rotem LRV', note: '2 kereta', cars: emu(2, 14.5, 'lrtj') },
  jbdb: { name: 'LRT Jabodebek', model: 'INKA, tanpa masinis', note: '6 kereta', cars: emu(6, 17.5, 'jbdb') },
  whoosh: { name: 'Whoosh', model: 'KCIC400AF', note: '8 kereta', cars: emu(8, 25, 'whoosh', 27.5) },
  ea203: { name: 'KA Bandara Soekarno-Hatta', model: 'EA203', note: '6 kereta', cars: emu(6, 20, 'ea203') },
  sky: { name: 'Skytrain Kalayang', model: 'Woojin / LEN', note: '2 kereta', cars: emu(2, 11.5, 'sky') },
  argo: {
    name: 'KA Argo (eksekutif)',
    model: 'CC 206 + stainless steel',
    note: 'lok + 9 kereta',
    cars: hauled('cc206', 15.8, ['argoP', 'argo', 'argo', 'argo', 'argo', 'argo', 'argo', 'argo', 'argo']),
  },
  ka: {
    name: 'KA antarkota',
    model: 'CC 206 + kereta eksekutif/ekonomi',
    note: 'lok + 9 kereta',
    cars: hauled('cc206', 15.8, ['coachP', 'coach', 'coach', 'coach', 'coach', 'coach', 'coach', 'coach', 'coach']),
  },
  lokal: {
    name: 'KA lokal / commuter daerah',
    model: 'CC 201 + kereta ekonomi',
    note: 'lok + 5 kereta',
    cars: hauled('cc201', 14.1, ['coachP', 'lokal', 'lokal', 'lokal', 'lokal']),
  },
  fcargo: {
    name: 'KA barang peti kemas (Cargo)',
    model: 'CC 206 + gerbong datar peti kemas',
    note: 'lok + ±20 gerbong',
    freight: true,
    cars: wagons('cc206', 15.8, ['ctrA', 'ctrB', 'ctrD', 'ctrC', 'flat'], 20, 14),
  },
  ftanker: {
    name: 'KA ketel (Tanker)',
    model: 'CC 201 + gerbong ketel',
    note: 'lok + ±20 ketel',
    freight: true,
    cars: wagons('cc201', 14.1, ['ketel', 'ketel', 'ketelB'], 20, 12),
  },
  fparcel: {
    name: 'KA Parcel',
    model: 'CC 206 + kereta bagasi',
    note: 'lok + ±8 kereta bagasi',
    freight: true,
    cars: wagons('cc206', 15.8, ['bagasi'], 8, 20.9),
  },
  fservice: {
    name: 'KA barang lain (Service)',
    model: 'CC 201 + gerbong tertutup / hopper',
    note: 'lok + ±16 gerbong',
    freight: true,
    cars: wagons('cc201', 14.1, ['tertutup', 'tertutup', 'hopper'], 16, 13),
  },
  ftrans: {
    name: 'KA barang lain (Trans)',
    model: 'CC 201 + gerbong barang',
    note: 'lok + ±16 gerbong',
    freight: true,
    cars: wagons('cc201', 14.1, ['hopper', 'tertutup'], 16, 13),
  },
};

export const STOCK: Record<string, StockSpec> = Object.fromEntries(
  Object.entries(RAW_STOCK).map(([k, v]) => [k, { ...v, len: v.cars.reduce((a, c) => a + c.len, 0) }]),
);

export function stockKey(l: Line): string {
  if (l.sys === 'barang') return 'f' + (l.cat || 'service');
  if (l.id === 'krl-lm') return 'lokal';
  if (l.sys === 'krl' || l.id === 'g-commuter-line-yogyakarta') {
    return l.id === 'krl-tp' || l.id === 'g-commuter-line-yogyakarta' ? 'krl8' : l.id === 'krl-t' ? 'krl10' : 'krl12';
  }
  if (l.sys === 'mrt' || l.sys === 'lrtj' || l.sys === 'jbdb') return l.sys;
  if (l.id === 'kcic') return 'whoosh';
  if (l.id === 'ka-bst') return 'ea203';
  if (l.id === 'apcgk') return 'sky';
  if (l.sys === 'kai') return /^Argo /.test(l.name) ? 'argo' : 'ka';
  return 'lokal';
}

const SPRITE_CARS: Record<string, number> = {
  krl12: 4,
  krl10: 4,
  krl8: 4,
  mrt: 4,
  lrtj: 2,
  jbdb: 3,
  whoosh: 4,
  ea203: 3,
  sky: 2,
  argo: 4,
  ka: 4,
  lokal: 3,
  fcargo: 5,
  ftanker: 5,
  fparcel: 4,
  fservice: 5,
  ftrans: 5,
};

function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  if (g.roundRect) g.roundRect(x, y, w, h, r);
  else g.rect(x, y, w, h);
}

export function spriteCanvas(key: string, px = 2) {
  const st = STOCK[key];
  const n = SPRITE_CARS[key] || 3;
  const W = 11;
  const CL = key === 'lrtj' || key === 'sky' ? 10 : 11;
  const G = 1.4;
  const cars = st.cars.slice(0, n - 1).concat([st.cars[st.cars.length - 1]]).slice(0, n);
  if (n === 2 && st.cars.length === 2) cars.splice(0, cars.length, ...st.cars);
  const nose = key === 'whoosh' ? 7 : 0;
  const H = n * CL + (n - 1) * G + nose + 4;
  const Wt = W + 4;
  const c = document.createElement('canvas');
  c.width = Math.ceil(Wt * px);
  c.height = Math.ceil(H * px);
  const g = c.getContext('2d')!;
  g.scale(px, px);
  g.lineJoin = 'round';
  let y = 2;
  cars.forEach((car, i) => {
    const v = C[car.liv];
    const first = i === 0;
    const last = i === n - 1;
    const top = y;
    const len = CL + (first ? nose : 0);
    g.save();
    g.fillStyle = '#1d1d22';
    if (first && nose) {
      g.beginPath();
      g.moveTo(2 + W / 2, top - 0.8);
      g.bezierCurveTo(2 + W + 0.8, top + nose * 0.55, 2 + W + 0.8, top + nose, 2 + W + 0.8, top + len + 0.8);
      g.lineTo(1.2, top + len + 0.8);
      g.bezierCurveTo(1.2, top + nose, 1.2, top + nose * 0.55, 2 + W / 2, top - 0.8);
      g.fill();
      g.fillStyle = v.b;
      g.beginPath();
      g.moveTo(2 + W / 2, top);
      g.bezierCurveTo(2 + W, top + nose * 0.55, 2 + W, top + nose, 2 + W, top + len);
      g.lineTo(2, top + len);
      g.bezierCurveTo(2, top + nose, 2, top + nose * 0.55, 2 + W / 2, top);
      g.fill();
    } else {
      const tank = /^ketel/.test(car.liv);
      rr(g, 1.2, top - 0.8, W + 1.6, len + 1.6, car.cab === 'f' || car.cab === 'r' ? 3.2 : tank ? 4.5 : 1.4);
      g.fill();
      g.fillStyle = v.b;
      rr(g, 2, top, W, len, car.cab ? 2.6 : tank ? 4 : 1);
      g.fill();
    }
    const y0 = top + (first && nose ? nose * 0.7 : first && car.cab ? 2.2 : 0.6);
    const y1 = top + len - (last && car.cab === 'r' ? 2.2 : 0.6);
    g.fillStyle = v.s1;
    g.fillRect(2 + W * 0.28, y0, W * 0.44, y1 - y0);
    g.fillStyle = v.s2;
    g.fillRect(2 + W * 0.44, y0, W * 0.12, y1 - y0);
    if (car.loco) {
      g.fillStyle = 'rgba(0,0,0,.35)';
      g.fillRect(2 + W * 0.2, top + len * 0.45, W * 0.6, 1.2);
    }
    if (car.cab === 'f') {
      const wy = top + (nose ? nose * 0.42 : 0.7);
      g.fillStyle = v.cab === '#FFFFFF' ? '#1d1d22' : v.cab || '#1d1d22';
      rr(g, 2 + W * 0.18, wy, W * 0.64, nose ? 2.4 : 2, 0.8);
      g.fill();
      g.fillStyle = '#1d1d22';
      rr(g, 2 + W * 0.26, wy + 0.4, W * 0.48, 1.1, 0.4);
      g.fill();
      g.fillStyle = '#FFF6B0';
      g.beginPath();
      g.arc(2 + W / 2, top + (nose ? 1.6 : 0.7), 1.25, 0, Math.PI * 2);
      g.fill();
    }
    if (last) {
      g.fillStyle = '#E0161E';
      g.fillRect(2 + 1.2, top + len - 1.4, 2, 1);
      g.fillRect(2 + W - 3.2, top + len - 1.4, 2, 1);
    }
    g.restore();
    y += len + G;
  });
  return { canvas: c, w: Wt, h: H, px };
}

function cut(tr: TrailResult, a: number, b: number): [number, number][] {
  const { pts, cum } = tr;
  const out: [number, number][] = [];
  const at = (d: number): [number, [number, number]] => {
    let lo = 0;
    let hi = cum.length - 1;
    if (d <= 0) return [0, pts[0]];
    if (d >= cum[hi]) return [hi, pts[hi]];
    while (lo < hi - 1) {
      const m = (lo + hi) >> 1;
      if (cum[m] <= d) lo = m;
      else hi = m;
    }
    const t = (d - cum[lo]) / (cum[hi] - cum[lo] || 1);
    const p = pts[lo];
    const q = pts[hi];
    return [lo, [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]];
  };
  const [ia, pa] = at(a);
  const [ib, pb] = at(b);
  out.push(pa);
  for (let i = ia + 1; i <= ib; i++) out.push(pts[i]);
  out.push(pb);
  return out;
}

function nose(
  tr: TrailResult,
  e: number,
  f: number,
  dir: number,
  v: Livery,
  P: Record<string, unknown>,
  out: GeoJsonFeature[],
) {
  const seg = (x: number, y: number, props: Record<string, unknown>) => {
    const [p, q] = dir > 0 ? [e + x, e + y] : [e - y, e - x];
    const c = cut(tr, p, q);
    if (c.length > 1) {
      out.push({
        type: 'Feature',
        properties: { ...P, ...props },
        geometry: { type: 'LineString', coordinates: c.reverse() },
      });
    }
  };
  if (f > 5) {
    seg(f * 0.4, f + 0.4, { r: 'nose', nw: 0.84, c: v.cab });
    seg(0.2, f * 0.5, { r: 'nose', nw: v.nw, c: v.cab });
  }
}

export function carFeatures(
  key: string,
  tr: TrailResult,
  props: Record<string, unknown>,
  gap: number,
  out: GeoJsonFeature[],
): [number, number] {
  const st = STOCK[key];
  let off = 0;
  const n = st.cars.length;
  for (let i = 0; i < n; i++) {
    const car = st.cars[i];
    const v = C[car.liv];
    const a = off + (i ? gap / 2 : 0);
    const b = off + car.len - (i < n - 1 ? gap / 2 : 0);
    off += car.len;
    const front = car.cab === 'f' && (v.nose ?? 0) > 5 ? v.nose! : 0;
    const back = car.cab === 'r' && (v.nose ?? 0) > 5 ? v.nose! : 0;
    const P = { ...props, b: v.b, s1: v.s1, s2: v.s2 };
    const body = cut(tr, a + front, b - back);
    if (body.length > 1) {
      out.push({
        type: 'Feature',
        properties: { ...P, r: 'car' },
        geometry: { type: 'LineString', coordinates: body.reverse() },
      });
    }
    if (front) nose(tr, a, front, 1, v, P, out);
    if (back) nose(tr, b, back, -1, v, P, out);
  }
  const h = cut(tr, 0, 1.5);
  const t = cut(tr, off - 1.5, off);
  const brg = (a: [number, number], b: [number, number]) => {
    const v = (Math.atan2((a[0] - b[0]) * Math.cos((a[1] * Math.PI) / 180), a[1] - b[1]) * 180) / Math.PI;
    return Number.isFinite(v) ? v : 0;
  };
  const hb = brg(h[0], h[h.length - 1]);
  const tb = brg(t[t.length - 1], t[0]);
  out.push({
    type: 'Feature',
    properties: { ...props, r: 'cab', ci: 'cab-' + key, b: hb },
    geometry: { type: 'Point', coordinates: h[0] },
  });
  out.push({
    type: 'Feature',
    properties: { ...props, r: 'tail', ci: 'tail-' + key, b: tb },
    geometry: { type: 'Point', coordinates: t[t.length - 1] },
  });
  return cut(tr, off / 2, off / 2 + 0.1)[0];
}

export const CABW = 32;

export function cabCanvas(key: string, rear: boolean, px = 2) {
  const st = STOCK[key];
  const car = rear ? st.cars[st.cars.length - 1] : st.cars[0];
  const v = C[car.liv];
  const W = CABW;
  const H = key === 'whoosh' && !rear ? 14 : 18;
  const c = document.createElement('canvas');
  c.width = W * px;
  c.height = H * px;
  const g = c.getContext('2d')!;
  g.scale(px, px);
  const emuCab = !!car.cab && !car.loco;
  const flat = rear && !car.cab;
  const r = key === 'whoosh' ? 15 : flat ? 3 : car.loco ? 6 : 10;
  const shape = (inset: number) => {
    g.beginPath();
    g.moveTo(inset, H);
    g.lineTo(inset, r);
    g.arcTo(inset, inset, r, inset, r - inset);
    g.lineTo(W - r, inset);
    g.arcTo(W - inset, inset, W - inset, r, r - inset);
    g.lineTo(W - inset, H);
    g.closePath();
  };
  g.fillStyle = '#1d1d22';
  shape(0);
  g.fill();
  g.fillStyle = v.b;
  shape(1.6);
  g.fill();
  if (emuCab || car.loco) {
    g.fillStyle = v.cab || v.s1;
    g.save();
    shape(1.6);
    g.clip();
    g.fillRect(0, 0, W, rear ? 8 : 9);
    g.restore();
    g.fillStyle = '#26303B';
    g.beginPath();
    g.ellipse(W / 2, 6.5, W * 0.33, 3, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,.35)';
    g.fillRect(W * 0.3, 5.2, W * 0.16, 1);
  }
  const y0 = emuCab || car.loco ? 10 : 2;
  g.fillStyle = v.s1;
  g.fillRect(W * 0.29, y0, W * 0.42, H - y0);
  g.fillStyle = v.s2;
  g.fillRect(W * 0.44, y0, W * 0.12, H - y0);
  if (car.loco) {
    g.fillStyle = 'rgba(0,0,0,.3)';
    g.fillRect(W * 0.2, 13, W * 0.6, 1.4);
  }
  const lc = rear ? '#E0161E' : '#FFF3A0';
  for (const x of [W * 0.2, W * 0.8]) {
    g.fillStyle = lc;
    g.beginPath();
    g.arc(x, rear ? 3.4 : 3.2, 2, 0, Math.PI * 2);
    g.fill();
  }
  return { canvas: c, w: W, h: H, px };
}
