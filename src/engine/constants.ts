import type { StyleSpecification } from 'maplibre-gl';
import type {
  FreightCategory,
  JplData,
  JplItem,
  JplRawRow,
  LayerState,
  Line,
  MapBasemapId,
  RegionPreset,
  SystemFilterId,
  SystemId,
  Trip,
} from './types';
import { dayType, VMAX } from './sched';

export const MAP_STYLES = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
} as const;

export const BASEMAP_OPTIONS: {
  id: MapBasemapId;
  label: string;
  desc: string;
}[] = [
  { id: 'light', label: 'Peta Terang', desc: 'Vektor terang & bersih' },
  { id: 'satellite', label: 'Satelit', desc: 'Foto udara Esri' },
  { id: 'hybrid', label: 'Hibrida', desc: 'Satelit + nama jalan' },
  { id: 'dark', label: 'Gelap', desc: 'Mode malam kontras' },
];

export function isDarkBasemap(id: MapBasemapId): boolean {
  return id === 'dark' || id === 'satellite' || id === 'hybrid';
}

export function buildMapStyle(id: MapBasemapId): string | StyleSpecification {
  if (id === 'light') return MAP_STYLES.light;
  if (id === 'dark') return MAP_STYLES.dark;

  const sources: StyleSpecification['sources'] = {
    'esri-sat': {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      maxzoom: 17,
      attribution: 'Foto udara © Esri, Maxar, Earthstar Geographics',
    },
  };

  const layers: StyleSpecification['layers'] = [
    {
      id: 'sat-bg',
      type: 'background',
      paint: { 'background-color': '#0b1220' },
    },
    {
      id: 'esri-sat-layer',
      type: 'raster',
      source: 'esri-sat',
      minzoom: 0,
      maxzoom: 22,
    },
  ];

  if (id === 'hybrid') {
    sources['esri-roads'] = {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      maxzoom: 17,
    };
    sources['esri-labels'] = {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      maxzoom: 17,
      attribution: 'Label & jalan © Esri',
    };
    layers.push(
      {
        id: 'esri-roads-layer',
        type: 'raster',
        source: 'esri-roads',
        minzoom: 0,
        maxzoom: 22,
        paint: { 'raster-opacity': 0.72 },
      },
      {
        id: 'esri-labels-layer',
        type: 'raster',
        source: 'esri-labels',
        minzoom: 0,
        maxzoom: 22,
        paint: { 'raster-opacity': 0.96 },
      },
    );
  }

  return {
    version: 8,
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources,
    layers,
  };
}


export const CARZ = 14;
export const LWS: [number, number][] = [
  [14, 5],
  [16, 12],
  [18, 30],
  [20, 96],
];

export const SYS_LABEL: Record<SystemId, string> = {
  krl: 'KRL Commuter Line',
  mrt: 'MRT Jakarta',
  lrtj: 'LRT Jakarta',
  jbdb: 'LRT Jabodebek',
  bandara: 'KA Bandara & Skytrain',
  whoosh: 'Whoosh',
  regional: 'Commuter Daerah',
  kai: 'KA Antarkota',
  barang: 'KA Barang',
};

export const SYS_SHORT: Record<SystemId, string> = {
  krl: 'KRL',
  mrt: 'MRT',
  lrtj: 'LRTJ',
  jbdb: 'Jabodebek',
  bandara: 'Bandara',
  whoosh: 'Whoosh',
  regional: 'Lokal',
  kai: 'Antarkota',
  barang: 'Barang',
};

export const SYS_COLOR: Record<SystemId, string> = {
  krl: '#E30A16',
  mrt: '#0B3A82',
  lrtj: '#E8412C',
  jbdb: '#20409A',
  bandara: '#005A9C',
  whoosh: '#D7192D',
  regional: '#EA580C',
  kai: '#6A2C91',
  barang: '#B45309',
};

export const CHIP_SYS: [SystemFilterId, string][] = [
  ['all', 'Semua'],
  ['krl', 'KRL'],
  ['mrt', 'MRT'],
  ['lrt', 'LRT'],
  ['bandara', 'Bandara'],
  ['whoosh', 'Whoosh'],
  ['kai', 'Antarkota'],
  ['barang', 'Barang'],
];

export function chipOf(sys: SystemId): SystemFilterId {
  if (sys === 'lrtj' || sys === 'jbdb') return 'lrt';
  if (sys === 'regional') return 'kai';
  return sys;
}

export const FCAT: Record<FreightCategory, [string, string, string]> = {
  cargo: ['Cargo', 'Barang umum & peti kemas', '#D9631E'],
  tanker: ['Tanker', 'KA ketel BBM / semen', '#C8102E'],
  parcel: ['Parcel', 'Paket & kiriman', '#0F7C8C'],
  service: ['Service', 'KA barang dinas / lainnya', '#6B5B4B'],
  trans: ['Trans', 'KA barang angkutan khusus', '#5A7D2A'],
};

export const JCAT: Record<string, [string, string]> = {
  jaga: ['Dijaga petugas', '#16A34A'],
  oto: ['Berpalang otomatis', '#0D9488'],
  palang: ['Berpalang · penjagaan belum terdata', '#65A30D'],
  sinyal: ['Tidak dijaga · ada lampu/bel', '#D97706'],
  tdk: ['Tidak dijaga · tanpa palang & sinyal', '#DC2626'],
  liar: ['Liar (tidak resmi)', '#991B1B'],
  tutup: ['Ditutup', '#475569'],
  ped: ['Pejalan kaki', '#2563EB'],
  unk: ['Pengaman belum terdata', '#64748B'],
  fly: ['Flyover (jalan di atas rel)', '#7C3AED'],
  under: ['Underpass (jalan di bawah rel)', '#A16207'],
};

export const GSEP = new Set(['fly', 'under']);

export const CONF: Record<number, [string, string]> = {
  3: ['Tinggi', 'Status dan nama jalan terdata di OpenStreetMap'],
  2: ['Sedang', 'Sebagian atribut terdata di OpenStreetMap'],
  1: ['Rendah', 'Baru lokasi & jalan; pengaman belum terdata'],
};

export const BARRIER: Record<string, string> = {
  full: 'Palang penuh',
  half: 'Palang setengah',
  double_half: 'Palang setengah ganda',
  yes: 'Ada palang',
  gate: 'Pintu geser',
  chain: 'Rantai',
  no: 'Tidak ada',
};

export const HW: Record<string, string> = {
  motorway: 'jalan tol',
  trunk: 'jalan nasional',
  primary: 'jalan utama',
  secondary: 'jalan sekunder',
  tertiary: 'jalan penghubung',
  unclassified: 'jalan lokal',
  residential: 'jalan permukiman',
  service: 'jalan layanan',
  track: 'jalan tanah',
  footway: 'jalan setapak',
  path: 'jalan setapak',
  pedestrian: 'jalur pejalan kaki',
  living_street: 'jalan lingkungan',
  cycleway: 'jalur sepeda',
  steps: 'tangga',
  road: 'jalan',
  motorway_link: 'akses tol',
  trunk_link: 'jalan nasional',
  primary_link: 'jalan utama',
  secondary_link: 'jalan sekunder',
  tertiary_link: 'jalan penghubung',
};

export const DEFAULT_LAYERS: LayerState = {
  krl: true,
  mrt: true,
  lrtj: true,
  jbdb: true,
  bandara: true,
  whoosh: true,
  regional: true,
  kai: true,
  barang: true,
  jpl: false,
  terminals: false,
  stations: true,
  net: true,
  labels: true,
};

export const REGION_PRESETS: RegionPreset[] = [
  { id: 'jabodetabek', label: 'Jabodetabek', lng: 106.835, lat: -6.235, zoom: 10.6 },
  { id: 'bandung', label: 'Bandung & Whoosh', lng: 107.48, lat: -6.87, zoom: 9.8 },
  { id: 'cirebon', label: 'Cirebon–Semarang', lng: 109.5, lat: -6.92, zoom: 8.6 },
  { id: 'jogja', label: 'Yogyakarta–Solo', lng: 110.58, lat: -7.68, zoom: 9.8 },
  { id: 'surabaya', label: 'Surabaya–Malang', lng: 112.73, lat: -7.52, zoom: 9.6 },
  { id: 'jember', label: 'Jember–Banyuwangi', lng: 113.95, lat: -8.15, zoom: 9.4 },
  { id: 'jawa', label: 'Seluruh Jalur', lng: 109.9, lat: -7.15, zoom: 6.7 },
];

export const TIME_PRESETS = [
  { label: '06:30', title: 'Pagi sibuk', sec: 6 * 3600 + 30 * 60 },
  { label: '08:00', title: 'Jam kantor', sec: 8 * 3600 },
  { label: '12:00', title: 'Siang', sec: 12 * 3600 },
  { label: '17:30', title: 'Sore sibuk', sec: 17 * 3600 + 30 * 60 },
  { label: '21:30', title: 'KA malam', sec: 21 * 3600 + 30 * 60 },
];

export const SPEED_OPTIONS = [1, 10, 30, 60, 180, 300];

export function fleetKey(l: Line | undefined): string {
  if (!l) return 'ka';
  if (l.sys === 'barang') return 'f' + (l.cat || 'service');
  if (l.id === 'krl-lm') return 'lokal';
  if (l.sys === 'krl' || l.id === 'g-commuter-line-yogyakarta') return 'krl';
  if (l.sys === 'mrt' || l.sys === 'lrtj' || l.sys === 'jbdb') return l.sys;
  if (l.id === 'kcic') return 'whoosh';
  if (l.id === 'ka-bst') return 'ea203';
  if (l.id === 'apcgk') return 'sky';
  if (l.sys === 'kai') return /^Argo /.test(l.name) ? 'argo' : 'ka';
  return 'lokal';
}

export function trainDisplayInfo(trip: Trip, line: Line | undefined) {
  const num = trip.id.replace(/^[a-z]+-/, '').replace(/^KA\s+/i, '');
  const isIntercity = line && (line.sys === 'kai' || line.sys === 'regional' || line.sys === 'barang');
  let name = trip.line;
  if (line) {
    const prefix = SYS_SHORT[line.sys];
    const alreadyPrefixed =
      isIntercity ||
      line.name.toLowerCase().startsWith(prefix.toLowerCase()) ||
      /^(krl|mrt|lrt|ka |whoosh|skytrain)/i.test(line.name);
    name = alreadyPrefixed ? line.name : `${prefix} ${line.name}`;
  }
  const label = isIntercity ? `${line.svc || line.name} ${num}` : `${line?.short || ''} ${num}`.trim();
  return { name, num, label };
}

export function clampSpeedKmh(mps: number, line: Line | undefined): number {
  const raw = Math.round(mps * 3.6);
  const cap = line?.vmax ?? (line ? VMAX[line.sys] : 120) ?? 120;
  return Math.max(0, Math.min(cap, raw));
}

export function dayLabel(date: string, holidays: string[] = []): string {
  const dow = new Date(date + 'T00:00:00Z').getUTCDay();
  return dayType(date, holidays) === 'weekend'
    ? dow === 0 || dow === 6
      ? 'Akhir pekan'
      : 'Hari libur nasional'
    : 'Hari kerja';
}

export function jplParseRow(jpl: JplData, i: number): JplItem {
  const r: JplRawRow = jpl.x[i];
  const kmStr = r[12] !== null && r[12] !== undefined && String(r[12]).trim() !== '' ? String(r[12]).trim() : null;
  return {
    i,
    osm: r[0] !== null && r[0] !== undefined ? String(r[0]) : '',
    p: [r[1], r[2]],
    cat: r[3],
    light: Boolean(r[4] & 1),
    bell: Boolean(r[4] & 2),
    sup: Boolean(r[4] & 4),
    noLight: Boolean(r[4] & 8),
    noBell: Boolean(r[4] & 16),
    dInf: Boolean(r[4] & 32),
    barrier: r[5],
    road: r[6],
    ref: r[7],
    a: r[8],
    b: r[9],
    dA: r[10],
    L: r[11],
    km: kmStr,
    hw: r[13],
    name: r[14],
    daop: r[15],
    tracks: r[16],
    conf: r[17],
    src: r[18],
    ph: r[19] >= 0 ? jpl.photos[r[19]] : null,
    mly: r[20],
    nodes: r[21],
  };
}

export function jplOsmUrl(osm: string | number): string {
  const id = String(osm ?? '').trim();
  if (!id) return 'https://www.openstreetmap.org/';
  if (id.startsWith('w')) return `https://www.openstreetmap.org/way/${id.slice(1)}`;
  return `https://www.openstreetmap.org/node/${id.replace(/^n/, '')}`;
}

export function jplRoadLabel(x: JplItem): string {
  return x.road || (x.hw ? `${HW[x.hw] || 'jalan'} tanpa nama` : 'Jalan belum terdata');
}

export function jplTitleLabel(x: JplItem): string {
  if (GSEP.has(x.cat)) {
    return `${x.cat === 'fly' ? 'Flyover' : 'Underpass'} ${x.road || ''}`.trim();
  }
  return x.name || (x.ref ? `Perlintasan ${x.ref}` : x.road ? `Perlintasan ${x.road}` : 'Perlintasan sebidang');
}

export function formatWait(sec: number): string {
  if (sec <= 30) return 'Sekarang';
  const m = Math.round(sec / 60);
  if (m < 60) return `${m} mnt`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h} j ${rem} mnt` : `${h} jam`;
}

export function formatClockFull(sec: number): string {
  const s = ((Math.floor(sec) % 86400) + 86400) % 86400;
  const hh = String(Math.floor(s / 3600)).padStart(2, '0');
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

export function formatDistanceKm(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
}

export function sourceNoteText(l: Line): string {
  if (l.sys === 'barang') {
    return 'KA barang dari GAPEKA 2026 wilayah Jawa. Kategori diambil dari nama perjalanan; jenis muatan dan pemilik barang tidak tercantum di data terbuka. Tidak mengangkut penumpang.';
  }
  if (l.sched === 'frequency') {
    return 'Perkiraan dari pola frekuensi resmi operator dan kecepatan rata-rata. Nomor perjalanan dibuat oleh Sepur Live.';
  }
  if (l.sys === 'krl') {
    return 'Jadwal resmi KRL Commuter Line dari Open-KRL (CC BY 4.0). Posisi kereta dihitung dari jadwal di atas rel OpenStreetMap, bukan GPS.';
  }
  if (l.sys === 'mrt' || l.sys === 'lrtj' || l.sys === 'jbdb' || l.id === 'apcgk') {
    return 'Jadwal publik dari ShioriLabs commute (ODbL 1.0). Posisi kereta dihitung secara matematis dari jadwal, bukan GPS.';
  }
  return 'GAPEKA 2026 (grafik perjalanan resmi KAI wilayah Jawa). Posisi dihitung dari jadwal di atas rel OpenStreetMap; keterlambatan langsung tidak terlihat.';
}
