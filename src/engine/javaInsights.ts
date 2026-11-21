import type { Engine } from './sched';
import { haversine } from './sched';
import { jplParseRow } from './constants';
import type {
  ClockState,
  Journey,
  JplData,
  JplItem,
  Line,
  Station,
  StationsExtraData,
  Trip,
} from './types';

/* ── 1. Station & Departure Wheelchair Accessibility ────────────────────────── */

export type StationAccessTier = 'full' | 'assisted' | 'limited';

export interface StationAccessibilityProfile {
  tier: StationAccessTier;
  tierLabel: string;
  summary: string;
  wheelchairAvailable: boolean;
  stepFreeAccess: boolean;
  features: {
    id: string;
    label: string;
    available: boolean;
  }[];
  guidance: string;
}

export type DepartureAccessLevel = 'level_boarding' | 'ramp_assist' | 'none';

export interface DepartureWheelchairInfo {
  accessible: boolean;
  level: DepartureAccessLevel;
  shortLabel: string;
  detailLabel: string;
}

const MAJOR_ACCESSIBLE_STATIONS = new Set([
  // Jabodetabek & Daop 1
  'MRI', 'GMR', 'PSE', 'JAKK', 'THB', 'SUD', 'SUDB', 'BNI', 'DU', 'BKS', 'CKR', 'BOO', 'DP', 'JNG', 'KPB', 'SRP', 'RK', 'TNG', 'HLM', 'KRW',
  // Bandung & Daop 2
  'BD', 'KAC', 'PDL', 'TGLR', 'CMI', 'GRT', 'TSM', 'BJR',
  // Cirebon & Daop 3
  'CN', 'CNP', 'JTB', 'BBK',
  // Semarang & Daop 4
  'SMT', 'SMC', 'PK', 'TG', 'CP', 'BB',
  // Purwokerto & Daop 5
  'PWT', 'KTA', 'KYA', 'KM', 'GB',
  // Yogyakarta–Solo & Daop 6
  'YK', 'LPN', 'SLO', 'PWS', 'SK', 'YIA', 'SMO', 'KT', 'WT', 'WNS',
  // Madiun & Daop 7
  'MN', 'KD', 'BL', 'TA', 'JG', 'KTS', 'NJ',
  // Surabaya–Malang & Daop 8
  'SGU', 'SBI', 'SB', 'WO', 'SDA', 'ML', 'MLK', 'MR', 'LMG', 'BJ', 'BG',
  // Jember–Banyuwangi & Daop 9
  'JR', 'KTG', 'PB', 'RBP', 'KSL',
]);

const BARRIER_FREE_SYSTEMS = new Set(['mrt', 'lrtj', 'jbdb', 'whoosh', 'bandara']);

/**
 * Clean stations_x.json km entries (which are `[kmNumber, corridorStations[]][]` tuples,
 * or occasionally strings/numbers) into a concise primary KM marker (e.g. "167+081").
 */
export function formatStationKm(rawKm: unknown): string | null {
  if (rawKm === null || rawKm === undefined) return null;
  if (typeof rawKm === 'number' && Number.isFinite(rawKm)) {
    const whole = Math.floor(rawKm);
    const meters = Math.round((rawKm - whole) * 1000);
    return `${whole}+${String(meters).padStart(3, '0')}`;
  }
  if (Array.isArray(rawKm)) {
    if (rawKm.length === 0) return null;
    const first = rawKm[0];
    if (Array.isArray(first) && typeof first[0] === 'number' && Number.isFinite(first[0])) {
      return formatStationKm(first[0]);
    }
    if (typeof first === 'number' || typeof first === 'string') {
      return formatStationKm(first);
    }
    return null;
  }
  if (typeof rawKm === 'string') {
    const trimmed = rawKm.trim();
    if (!trimmed) return null;
    if (trimmed.length <= 16) return trimmed;
    const m = trimmed.match(/^([0-9]+[+.,][0-9]+)/);
    return m ? m[1] : trimmed.slice(0, 14);
  }
  return null;
}

export function getStationAccessibility(
  station: Station,
  linesServing: Line[],
  extra?: StationsExtraData | null,
): StationAccessibilityProfile {
  const passengerSystems = (station.sys || []).filter((s) => s !== 'barang');
  const passengerLines = linesServing.filter((l) => l.sys !== 'barang');
  const hasPassengerService = passengerLines.length > 0 || passengerSystems.length > 0;
  const hasModernUrban =
    passengerLines.some((l) => BARRIER_FREE_SYSTEMS.has(l.sys)) ||
    passengerSystems.some((s) => BARRIER_FREE_SYSTEMS.has(s));
  const hasKrl =
    passengerLines.some((l) => l.sys === 'krl') || passengerSystems.includes('krl');
  const isMajorHub = MAJOR_ACCESSIBLE_STATIONS.has(station.id);
  const stExtra = extra?.s?.[station.id];
  const hasMajorDaopMeta = Boolean(stExtra?.daop && Math.max(passengerLines.length, passengerSystems.length) >= 4);

  if (!hasPassengerService) {
    return {
      tier: 'limited',
      tierLabel: 'Non-Penumpang / Terbatas',
      summary: 'Stasiun operasional atau angkutan barang; tidak melayani naik-turun penumpang reguler.',
      wheelchairAvailable: false,
      stepFreeAccess: false,
      features: [
        { id: 'wheelchair', label: 'Kursi Roda Stasiun', available: false },
        { id: 'ramp', label: 'Jalur Landai (Ramp)', available: false },
        { id: 'lift', label: 'Lift / Eskalator', available: false },
        { id: 'toilet', label: 'Toilet Disabilitas', available: false },
      ],
      guidance: 'Pilih stasiun penumpang terdekat yang memiliki fasilitas ramah kursi roda.',
    };
  }

  if (hasModernUrban || isMajorHub || hasMajorDaopMeta) {
    const levelBoarding = hasModernUrban;
    return {
      tier: 'full',
      tierLabel: levelBoarding ? 'Ramah Kursi Roda Penuh (Peron Rata)' : 'Ramah Kursi Roda (Hub Utama)',
      summary: levelBoarding
        ? 'Akses bebas hambatan penuh dari pintu masuk hingga ke dalam kereta dengan peron sejajar lantai.'
        : 'Dilengkapi kursi roda gratis di posko stasiun, jalur landai, toilet disabilitas, serta petugas pendamping naik kereta.',
      wheelchairAvailable: true,
      stepFreeAccess: true,
      features: [
        { id: 'wheelchair', label: 'Kursi Roda Gratis', available: true },
        { id: 'ramp', label: levelBoarding ? 'Peron Sejajar Pintu' : 'Jalur Landai & Ramp Portabel', available: true },
        { id: 'lift', label: 'Lift / Eskalator', available: hasModernUrban || isMajorHub },
        { id: 'toilet', label: 'Toilet Disabilitas', available: true },
        { id: 'guiding', label: 'Guiding Block', available: true },
      ],
      guidance: levelBoarding
        ? 'Gunakan pintu prioritas bertanda kursi roda; petugas peron siap membantu bila diperlukan.'
        : 'Laporkan ke Posko Customer Service / KAI 121 minimal 30 menit sebelum berangkat untuk pendampingan kursi roda.',
    };
  }

  return {
    tier: 'assisted',
    tierLabel: hasKrl ? 'Tersedia Ramp & Bantuan Petugas' : 'Kursi Roda dengan Bantuan Petugas',
    summary: hasKrl
      ? 'Tersedia jalur landai, ruang tunggu prioritas, serta ramp portabel dari petugas pengamanan peron (PKD).'
      : 'Tersedia layanan kursi roda stasiun dan bantuan naik-turun kereta oleh petugas stasiun KAI.',
    wheelchairAvailable: true,
    stepFreeAccess: hasKrl,
    features: [
      { id: 'wheelchair', label: 'Kursi Roda via Petugas', available: true },
      { id: 'ramp', label: 'Ramp Portabel', available: true },
      { id: 'lift', label: 'Lift / Eskalator', available: false },
      { id: 'toilet', label: 'Toilet Prioritas', available: true },
      { id: 'guiding', label: 'Guiding Block', available: hasKrl },
    ],
    guidance: hasKrl
      ? 'Hubungi petugas PKD di gerbang tiket agar disiapkan ramp portabel di kereta pertama atau terakhir.'
      : 'Hubungi petugas stasiun atau Contact Center KAI 121 sebelum keberangkatan untuk layanan kursi roda.',
  };
}

export function isDepartureWheelchairFriendly(
  trip: Trip,
  line: Line | undefined,
): DepartureWheelchairInfo {
  if (!line || trip.freight || line.sys === 'barang') {
    return {
      accessible: false,
      level: 'none',
      shortLabel: 'KA Barang',
      detailLabel: 'Kereta angkutan barang, bukan layanan penumpang',
    };
  }

  if (BARRIER_FREE_SYSTEMS.has(line.sys)) {
    return {
      accessible: true,
      level: 'level_boarding',
      shortLabel: 'Akses kursi roda (peron rata)',
      detailLabel: 'Ruang khusus kursi roda tersedia dengan celah peron rata',
    };
  }

  if (line.sys === 'krl') {
    return {
      accessible: true,
      level: 'ramp_assist',
      shortLabel: 'Ramah kursi roda · ramp petugas',
      detailLabel: 'Area prioritas kursi roda tersedia dengan ramp portabel petugas KRL',
    };
  }

  return {
    accessible: true,
    level: 'ramp_assist',
    shortLabel: 'Kursi roda tersedia (KAI)',
    detailLabel: 'Tersedia layanan kursi roda & bantuan naik-turun petugas KAI',
  };
}

/* ── 2. Major Java Intermodal Hub Cards ───────────────────────────────────── */

export interface HubInterchangeInfo {
  hubTitle: string;
  role: string;
  modes: string[];
  transferTip: string;
  connectedStationIds: string[];
}

const HUB_INTERCHANGE_MAP: Record<string, HubInterchangeInfo> = {
  MRI: {
    hubTitle: 'Stasiun Sentral Transit Jabodetabek',
    role: 'Persimpangan utama KRL Bogor, KRL Cikarang, dan KA Bandara Soekarno-Hatta',
    modes: ['KRL Bogor (Lt. 2)', 'KRL Cikarang (Lt. Dasar)', 'KA Bandara Soetta', 'TransJakarta'],
    transferTip: 'Perpindahan antar-peron tersedia melalui eskalator dan lift khusus disabilitas di area concourse lantai 1.',
    connectedStationIds: ['SUD', 'THB', 'GMR'],
  },
  SUD: {
    hubTitle: 'Kawasan TOD Dukuh Atas',
    role: 'Simpul integrasi 5 moda transportasi rel & bus di pusat Jakarta',
    modes: ['KRL Cikarang', 'MRT Dukuh Atas BNI', 'LRT Jabodebek Dukuh Atas', 'KA Bandara BNI City', 'TransJakarta'],
    transferTip: 'Terhubung langsung melalui Jembatan Penyeberangan Multiguna (JPM) dan Terowongan Kendal (3–6 menit jalan kaki).',
    connectedStationIds: ['BNI', 'SUDB', 'MRI', 'THB'],
  },
  BNI: {
    hubTitle: 'Hub TOD Dukuh Atas — BNI City',
    role: 'Gerbang utama KA Bandara Soekarno-Hatta terintegrasi MRT & LRT',
    modes: ['KA Bandara Soetta', 'KRL Cikarang', 'MRT Dukuh Atas', 'LRT Jabodebek'],
    transferTip: 'Tersedia akses landai dan lift langsung menuju stasiun MRT Dukuh Atas dan JPM LRT Jabodebek.',
    connectedStationIds: ['SUD', 'SUDB', 'MRI'],
  },
  THB: {
    hubTitle: 'Hub KRL Rangkasbitung & Cikarang',
    role: 'Transit padat koridor barat Banten–Tangerang Selatan menuju pusat Jakarta',
    modes: ['KRL Rangkasbitung', 'KRL Cikarang', 'TransJakarta / JakLingko'],
    transferTip: 'Gunakan gedung baru hall timur dengan eskalator & lift untuk pindah jalur lebih leluasa.',
    connectedStationIds: ['SUD', 'DU', 'MRI'],
  },
  PDL: {
    hubTitle: 'Hub Integrasi Whoosh ↔ KA Feeder Bandung',
    role: 'Titik pindah utama Kereta Cepat Jakarta–Bandung menuju pusat Kota Bandung',
    modes: ['Whoosh (350 km/j)', 'KA Feeder Padalarang–Bandung', 'Commuter Line Bandung Raya'],
    transferTip: 'Jadwal KA Feeder disinkronkan dengan kedatangan Whoosh (waktu pindah ±5–8 menit via skybridge).',
    connectedStationIds: ['BD', 'CMI', 'HLM'],
  },
  HLM: {
    hubTitle: 'Stasiun Whoosh Halim',
    role: 'Terminal Kereta Cepat Jakarta–Bandung terhubung langsung LRT Jabodebek',
    modes: ['Whoosh (350 km/j)', 'LRT Jabodebek Bekasi', 'TransJakarta 7W', 'Shuttle Bandara HLP'],
    transferTip: 'Skybridge ber-AC menghubungkan langsung lantai concourse Whoosh ke Stasiun LRT Halim.',
    connectedStationIds: ['PDL', 'KRW', 'TGLR'],
  },
  YK: {
    hubTitle: 'Stasiun Yogyakarta (Tugu)',
    role: 'Gerbang utama KA Antarkota Selatan, KRL Jogja–Solo, Prameks & KA Bandara YIA',
    modes: ['KA Antarkota Eksekutif', 'KRL Yogyakarta–Palur', 'KA Bandara YIA', 'Prameks Kutoarjo', 'TransJogja'],
    transferTip: 'Pintu selatan (Jl. Pasar Kembang) dekat akses KA Bandara YIA; pintu timur menghadap Malioboro.',
    connectedStationIds: ['LPN', 'YIA', 'SLO'],
  },
  SLO: {
    hubTitle: 'Stasiun Solo Balapan',
    role: 'Hub utama Jawa Tengah & penghubung langsung Terminal Tirtonadi + KA Bandara BIAS',
    modes: ['KA Antarkota', 'KRL Jogja–Solo', 'KA Bandara Adi Soemarmo (BIAS)', 'Skybridge Tirtonadi', 'BST'],
    transferTip: 'Skybridge langsung menghubungkan stasiun ke Terminal Bus Tirtonadi (±6 menit jalan kaki).',
    connectedStationIds: ['PWS', 'SK', 'SMO', 'YK'],
  },
  SGU: {
    hubTitle: 'Stasiun Surabaya Gubeng',
    role: 'Hub kereta terbesar Jawa Timur — koridor selatan, timur, dan Commuter Line Gerbangkertosusila',
    modes: ['KA Antarkota Jawa–Banyuwangi', 'Commuter Line Dhoho/Penataran/Supas', 'Suroboyo Bus'],
    transferTip: 'Sisi Gubeng Baru (timur) melayani mayoritas KA jarak jauh & akses kursi roda landai; sisi Lama (barat) untuk komuter.',
    connectedStationIds: ['SBI', 'SB', 'WO', 'SDA'],
  },
  GMR: {
    hubTitle: 'Stasiun Gambir',
    role: 'Terminal utama KA Eksekutif & Luxury koridor Jakarta–Bandung–Yogyakarta–Surabaya',
    modes: ['KA Eksekutif / Argo / Suite Class', 'DAMRI Bandara Soetta', 'TransJakarta'],
    transferTip: 'Tersedia fasilitas Skybridge, ruang tunggu eksekutif, eskalator/lift peron atas, dan kursi roda gratis.',
    connectedStationIds: ['JAKK', 'PSE', 'MRI'],
  },
  BD: {
    hubTitle: 'Stasiun Bandung',
    role: 'Hub utama Parahyangan — KA Antarkota, KA Feeder Whoosh, dan Commuter Line Bandung Raya',
    modes: ['KA Antarkota (Argo Wilis, Parahyangan)', 'KA Feeder Whoosh', 'CL Bandung Raya & Garut'],
    transferTip: 'Pintu Utara (Jl. Kebon Kawung) untuk KA Antarkota & Feeder Whoosh; Pintu Selatan (Jl. Stasiun Timur) untuk Commuter Line.',
    connectedStationIds: ['PDL', 'KAC', 'CMI'],
  },
};

export function getHubInterchangeInfo(stationId: string, engine: Engine): HubInterchangeInfo | null {
  const base = HUB_INTERCHANGE_MAP[stationId];
  if (!base) return null;
  return {
    ...base,
    connectedStationIds: base.connectedStationIds.filter((id) => engine.st.has(id)),
  };
}

/* ── 3. Java Special Classes (Panoramic / Suite Class / SSNG) & Fares ─────── */

export interface SpecialServiceMeta {
  classLabel: string;
  specialCar: 'panoramic' | 'suite' | 'ssng' | null;
  specialBadge: string | null;
  fareMinIdr: number;
  fareMaxIdr: number;
  fareText: string;
  highlights: string[];
}

const SUITE_CLASS_RE = /\b(bima|argo semeru|argo bromo anggrek|sangkuriang)\b/i;
const PANORAMIC_RE = /\b(argo wilis|turangga|parahyangan|papandayan|pangandaran)\b/i;
const SSNG_RE = /\b(argo lawu|argo dwipangga|taksaka|lodaya|majapahit|jayabaya|progo|bogowonto|mataram|fajar utama|senja utama|gaya baru)\b/i;

export function formatIdrShort(amount: number): string {
  if (amount >= 1_000_000) {
    const jt = amount / 1_000_000;
    return `Rp${jt % 1 === 0 ? jt.toFixed(0) : jt.toFixed(1).replace('.', ',')} jt`;
  }
  if (amount >= 1000) {
    return `Rp${Math.round(amount / 1000)} rb`;
  }
  return `Rp${amount}`;
}

export function getSpecialServiceMeta(line: Line | undefined): SpecialServiceMeta | null {
  if (!line) return null;
  const name = line.name || '';

  if (line.sys === 'barang') {
    return {
      classLabel: 'Angkutan Barang KAI Logistik',
      specialCar: null,
      specialBadge: null,
      fareMinIdr: 0,
      fareMaxIdr: 0,
      fareText: 'Non-penumpang',
      highlights: ['Kargo & Logistik', 'Prioritas Jalur Barang'],
    };
  }

  if (line.sys === 'whoosh') {
    return {
      classLabel: 'Kereta Cepat Whoosh (First · Business · Premium Economy)',
      specialCar: null,
      specialBadge: '350 km/j High-Speed',
      fareMinIdr: 175_000,
      fareMaxIdr: 600_000,
      fareText: 'Rp175 rb – Rp600 rb',
      highlights: ['Peron Rata Disabilitas', 'Gratis KA Feeder Padalarang–Bandung'],
    };
  }

  if (line.sys === 'mrt') {
    return {
      classLabel: 'MRT Jakarta (Ratangga)',
      specialCar: null,
      specialBadge: null,
      fareMinIdr: 3_000,
      fareMaxIdr: 14_000,
      fareText: 'Rp3 rb – Rp14 rb',
      highlights: ['Akses Kursi Roda Penuh', 'Interval 5–10 mnt'],
    };
  }

  if (line.sys === 'lrtj' || line.sys === 'jbdb') {
    return {
      classLabel: line.sys === 'jbdb' ? 'LRT Jabodebek (Otomatis GoA-3)' : 'LRT Jakarta',
      specialCar: null,
      specialBadge: null,
      fareMinIdr: 5_000,
      fareMaxIdr: 20_000,
      fareText: line.sys === 'lrtj' ? 'Rp5 rb tarif flat' : 'Rp5 rb – Rp20 rb',
      highlights: ['Peron Rata', 'Kereta Tanpa Masinis'],
    };
  }

  if (line.sys === 'bandara') {
    const isYia = /yia/i.test(name);
    const isBias = /bias|soemarmo/i.test(name);
    const min = isBias ? 7_000 : isYia ? 20_000 : 30_000;
    const max = isBias ? 40_000 : isYia ? 50_000 : 70_000;
    return {
      classLabel: 'Kereta Bandara Ekspres',
      specialCar: null,
      specialBadge: null,
      fareMinIdr: min,
      fareMaxIdr: max,
      fareText: `${formatIdrShort(min)} – ${formatIdrShort(max)}`,
      highlights: ['Rak Bagasi Besar', 'Peron Rata Ramah Kursi Roda'],
    };
  }

  if (line.sys === 'krl') {
    const isYogya = /yogya|solo|palur/i.test(name);
    return {
      classLabel: isYogya ? 'Commuter Line Yogyakarta–Solo' : 'KRL Commuter Line Jabodetabek',
      specialCar: null,
      specialBadge: null,
      fareMinIdr: isYogya ? 8_000 : 3_000,
      fareMaxIdr: isYogya ? 8_000 : 13_000,
      fareText: isYogya ? 'Rp8 rb tarif flat' : 'Rp3 rb – Rp13 rb',
      highlights: ['Kartu Multi Trip / QRIS', 'Ruang Prioritas'],
    };
  }

  if (SUITE_CLASS_RE.test(name)) {
    return {
      classLabel: 'Eksekutif SSNG · Suite Class Compartment',
      specialCar: 'suite',
      specialBadge: 'Suite Class Compartment',
      fareMinIdr: 450_000,
      fareMaxIdr: 2_100_000,
      fareText: 'Rp450 rb – Rp2,1 jt',
      highlights: ['Kabin Privat 180° Recline', 'Layanan Makan & Minum', 'SS New Generation'],
    };
  }

  if (PANORAMIC_RE.test(name)) {
    return {
      classLabel: 'Eksekutif · Kereta Panoramic (Atap Kaca)',
      specialCar: 'panoramic',
      specialBadge: 'Kereta Panoramic',
      fareMinIdr: 220_000,
      fareMaxIdr: 1_300_000,
      fareText: 'Rp220 rb – Rp1,3 jt',
      highlights: ['Sunroof & Jendela Panorama', 'Free WiFi & Snack', 'Kursi Putar'],
    };
  }

  if (SSNG_RE.test(name)) {
    return {
      classLabel: 'Stainless Steel New Generation (SSNG)',
      specialCar: 'ssng',
      specialBadge: 'SS New Generation',
      fareMinIdr: 180_000,
      fareMaxIdr: 720_000,
      fareText: 'Rp180 rb – Rp720 rb',
      highlights: ['Pintu Geser Elektrik', 'Kursi Captain / Ergonomis', 'PIDS Modern'],
    };
  }

  if (/commuter|lokal|prameks|dhoho|penataran|supas|jenggala|bandung raya|garut|walahar|jatiluhur|merak|blorasura|arjonegoro|kedung sepur|kaligung|bathara|feeder/i.test(name)) {
    return {
      classLabel: 'KA Lokal / Commuter Line Wilayah',
      specialCar: null,
      specialBadge: null,
      fareMinIdr: 4_000,
      fareMaxIdr: 15_000,
      fareText: 'Rp4 rb – Rp15 rb',
      highlights: ['Tarif Subsidi PSO', 'Pesan via Access by KAI'],
    };
  }

  if (/^argo\b/i.test(name)) {
    return {
      classLabel: 'KA Antarkota Eksekutif Argo',
      specialCar: null,
      specialBadge: null,
      fareMinIdr: 250_000,
      fareMaxIdr: 750_000,
      fareText: 'Rp250 rb – Rp750 rb',
      highlights: ['Kereta Eksekutif', 'Kereta Makan (Restorasi)'],
    };
  }

  return {
    classLabel: 'KA Antarkota (Eksekutif / Ekonomi)',
    specialCar: null,
    specialBadge: null,
    fareMinIdr: 95_000,
    fareMaxIdr: 480_000,
    fareText: 'Rp95 rb – Rp480 rb',
    highlights: ['Pemesanan Access by KAI', 'Layanan Kursi Roda KAI 121'],
  };
}

export interface JourneyEstimate {
  minIdr: number;
  maxIdr: number;
  fareText: string;
  badges: ('Tercepat' | 'Hemat' | 'Minim Transit')[];
}

export function estimateJourneyFare(
  engine: Engine,
  journey: Journey,
): { minIdr: number; maxIdr: number; fareText: string } {
  let minIdr = 0;
  let maxIdr = 0;
  for (const leg of journey.legs) {
    if (leg.walk || !leg.trip) continue;
    const line = engine.lines.get(leg.trip.line);
    const meta = getSpecialServiceMeta(line);
    if (!meta) continue;
    minIdr += meta.fareMinIdr;
    maxIdr += meta.fareMaxIdr;
  }
  const fareText =
    minIdr === 0
      ? 'Tarif tidak tersedia'
      : minIdr === maxIdr
        ? formatIdrShort(minIdr)
        : `${formatIdrShort(minIdr)} – ${formatIdrShort(maxIdr)}`;
  return { minIdr, maxIdr, fareText };
}

export function tagJourneyHighlights(engine: Engine, journeys: Journey[]): JourneyEstimate[] {
  if (!journeys.length) return [];
  const fares = journeys.map((j) => estimateJourneyFare(engine, j));
  const minDur = Math.min(...journeys.map((j) => j.arr - j.dep));
  const minTransfers = Math.min(...journeys.map((j) => j.transfers));
  const positiveMins = fares.map((f) => f.minIdr).filter((v) => v > 0);
  const minFare = positiveMins.length ? Math.min(...positiveMins) : 0;

  return journeys.map((j, idx) => {
    const badges: ('Tercepat' | 'Hemat' | 'Minim Transit')[] = [];
    if (j.arr - j.dep === minDur) badges.push('Tercepat');
    if (minFare > 0 && fares[idx].minIdr === minFare && journeys.length > 1) {
      badges.push('Hemat');
    }
    if (j.transfers === minTransfers && minTransfers === 0 && !badges.includes('Tercepat')) {
      badges.push('Minim Transit');
    }
    return {
      ...fares[idx],
      badges,
    };
  });
}

/* ── 4. Marey GAPEKA Diagram Builder (LineDetailPanel) ────────────────────── */

export interface MareyPoint {
  stationIndex: number;
  stationId: string;
  timeSec: number;
}

export interface MareySeries {
  tripId: string;
  tripDate: string;
  dir: number;
  head: string;
  points: MareyPoint[];
  startSec: number;
  endSec: number;
}

export interface MareyDiagramData {
  lineId: string;
  lineColor: string;
  stations: { id: string; name: string; index: number }[];
  series: MareySeries[];
  minSec: number;
  maxSec: number;
}

export function buildMareyDiagram(
  engine: Engine,
  lineId: string,
  date: string,
  maxTrips = 120,
): MareyDiagramData | null {
  const line = engine.lines.get(lineId);
  if (!line) return null;

  const dayTrips = engine.day(date).trips.filter((t) => t.line === lineId);
  if (!dayTrips.length) return null;

  const canonicalIds = line.stations.length >= 2 ? [...line.stations] : [...dayTrips[0].sids];
  const stIndex = new Map<string, number>();
  canonicalIds.forEach((id, i) => stIndex.set(id, i));

  for (const t of dayTrips) {
    for (const sid of t.sids) {
      if (!stIndex.has(sid)) {
        stIndex.set(sid, canonicalIds.length);
        canonicalIds.push(sid);
      }
    }
  }

  const stations = canonicalIds.map((id, index) => ({
    id,
    name: engine.st.get(id)?.name || id,
    index,
  }));

  const sorted = [...dayTrips].sort((a, b) => a.start - b.start);
  const step = sorted.length > maxTrips ? sorted.length / maxTrips : 1;
  const picked: Trip[] = [];
  for (let i = 0; i < Math.min(sorted.length, maxTrips); i++) {
    picked.push(sorted[Math.min(sorted.length - 1, Math.floor(i * step))]);
  }

  let minSec = Infinity;
  let maxSec = -Infinity;
  const series: MareySeries[] = [];

  for (const t of picked) {
    const pts: MareyPoint[] = [];
    for (let i = 0; i < t.sids.length; i++) {
      const idx = stIndex.get(t.sids[i]);
      if (idx === undefined) continue;
      const arr = t.arr[i];
      const dep = t.dep[i];
      pts.push({ stationIndex: idx, stationId: t.sids[i], timeSec: arr });
      if (dep > arr + 30) {
        pts.push({ stationIndex: idx, stationId: t.sids[i], timeSec: dep });
      }
      if (arr < minSec) minSec = arr;
      if (dep > maxSec) maxSec = dep;
    }
    if (pts.length >= 2) {
      const dir = pts[0].stationIndex <= pts[pts.length - 1].stationIndex ? 0 : 1;
      series.push({
        tripId: t.id,
        tripDate: t.date,
        dir,
        head: t.head,
        points: pts,
        startSec: pts[0].timeSec,
        endSec: pts[pts.length - 1].timeSec,
      });
    }
  }

  if (!series.length) return null;
  const snappedMin = Math.max(0, Math.floor(minSec / 3600) * 3600);
  const snappedMax = Math.min(28 * 3600, Math.ceil(maxSec / 3600) * 3600);

  return {
    lineId,
    lineColor: line.color,
    stations,
    series,
    minSec: snappedMin,
    maxSec: Math.max(snappedMin + 3600, snappedMax),
  };
}

/* ── 5. Scheduled Meet (Persilangan) & Overtake (Penyusulan) Detection ────── */

export type TripInteractionKind = 'meet' | 'overtaken' | 'overtake';

export interface TripInteraction {
  kind: TripInteractionKind;
  stationId: string;
  stationName: string;
  timeSec: number;
  otherTrip: Trip;
  otherLine: Line | undefined;
  gapSec: number;
}

export function detectTripMeetsAndOvertakes(
  engine: Engine,
  trip: Trip,
  limit = 10,
): TripInteraction[] {
  if (trip.sids.length < 2) return [];
  const day = engine.day(trip.date);
  const tripPos = new Map<string, number>();
  for (let i = 0; i < trip.sids.length; i++) {
    if (!tripPos.has(trip.sids[i])) tripPos.set(trip.sids[i], i);
  }

  const interactions: TripInteraction[] = [];
  const seenKey = new Set<string>();

  for (const other of day.trips) {
    if (other.id === trip.id) continue;
    if (other.end + 900 < trip.start || other.start - 900 > trip.end) continue;

    const shared: { sid: string; myIdx: number; otherIdx: number }[] = [];
    for (let oi = 0; oi < other.sids.length; oi++) {
      const mi = tripPos.get(other.sids[oi]);
      if (mi !== undefined) {
        shared.push({ sid: other.sids[oi], myIdx: mi, otherIdx: oi });
      }
    }
    if (shared.length === 0) continue;

    let sameDirVotes = 0;
    let oppDirVotes = 0;
    for (let k = 1; k < shared.length; k++) {
      const dm = shared[k].myIdx - shared[k - 1].myIdx;
      const doIdx = shared[k].otherIdx - shared[k - 1].otherIdx;
      if (dm * doIdx > 0) sameDirVotes++;
      else if (dm * doIdx < 0) oppDirVotes++;
    }

    if (sameDirVotes > oppDirVotes && shared.length >= 2) {
      shared.sort((a, b) => a.myIdx - b.myIdx);
      for (let k = 1; k < shared.length; k++) {
        const prev = shared[k - 1];
        const curr = shared[k];
        const myPrev = trip.dep[prev.myIdx];
        const otherPrev = other.dep[prev.otherIdx];
        const myCurr = trip.arr[curr.myIdx];
        const otherCurr = other.arr[curr.otherIdx];

        if (myPrev < otherPrev && myCurr > otherCurr && Math.abs(myCurr - otherCurr) <= 2400) {
          const stIdx = trip.dep[prev.myIdx] - trip.arr[prev.myIdx] >= 120 ? prev : curr;
          const sid = stIdx.sid;
          const dedup = `overtaken|${other.id}|${sid}`;
          if (!seenKey.has(dedup)) {
            seenKey.add(dedup);
            interactions.push({
              kind: 'overtaken',
              stationId: sid,
              stationName: engine.st.get(sid)?.name || sid,
              timeSec: other.arr[stIdx.otherIdx],
              otherTrip: other,
              otherLine: engine.lines.get(other.line),
              gapSec: Math.abs(trip.dep[stIdx.myIdx] - other.arr[stIdx.otherIdx]),
            });
          }
          break;
        } else if (otherPrev < myPrev && otherCurr > myCurr && Math.abs(myCurr - otherCurr) <= 2400) {
          const stIdx = other.dep[prev.otherIdx] - other.arr[prev.otherIdx] >= 120 ? prev : curr;
          const sid = stIdx.sid;
          const dedup = `overtake|${other.id}|${sid}`;
          if (!seenKey.has(dedup)) {
            seenKey.add(dedup);
            interactions.push({
              kind: 'overtake',
              stationId: sid,
              stationName: engine.st.get(sid)?.name || sid,
              timeSec: trip.arr[stIdx.myIdx],
              otherTrip: other,
              otherLine: engine.lines.get(other.line),
              gapSec: Math.abs(other.dep[stIdx.otherIdx] - trip.arr[stIdx.myIdx]),
            });
          }
          break;
        }
      }
      continue;
    }

    const isOpposite = oppDirVotes > sameDirVotes;
    if (!isOpposite) continue;

    let bestMeet: { sid: string; timeSec: number; gapSec: number } | null = null;
    for (const sh of shared) {
      const myA = trip.arr[sh.myIdx];
      const myD = trip.dep[sh.myIdx];
      const otA = other.arr[sh.otherIdx];
      const otD = other.dep[sh.otherIdx];
      const gap = Math.max(0, Math.max(myA, otA) - Math.min(myD, otD));
      if (gap <= 360) {
        if (!bestMeet || gap < bestMeet.gapSec) {
          bestMeet = {
            sid: sh.sid,
            timeSec: Math.round((Math.max(myA, otA) + Math.min(myD, otD)) / 2),
            gapSec: gap,
          };
        }
      }
    }

    if (bestMeet) {
      const dedup = `meet|${other.id}|${bestMeet.sid}`;
      if (!seenKey.has(dedup)) {
        seenKey.add(dedup);
        interactions.push({
          kind: 'meet',
          stationId: bestMeet.sid,
          stationName: engine.st.get(bestMeet.sid)?.name || bestMeet.sid,
          timeSec: bestMeet.timeSec,
          otherTrip: other,
          otherLine: engine.lines.get(other.line),
          gapSec: bestMeet.gapSec,
        });
      }
    }
  }

  interactions.sort((a, b) => a.timeSec - b.timeSec || a.gapSec - b.gapSec);
  return interactions.slice(0, limit);
}

/* ── 6. Nearby JPL Level Crossing Live Alert Radar ────────────────────────── */

export type JplAlertSeverity = 'imminent' | 'approaching' | 'clear';

export interface NearbyJplAlert {
  index: number;
  item: JplItem;
  distanceMeters: number;
  severity: JplAlertSeverity;
  nextPass: {
    trip: Trip;
    line: Line | undefined;
    waitSec: number;
    passSec: number;
  } | null;
}

export function computeNearbyJplAlerts(
  engine: Engine,
  jplData: JplData | null,
  anchorCoord: [number, number],
  clock: ClockState,
  opts?: { limit?: number; maxRadiusMeters?: number },
): NearbyJplAlert[] {
  if (!jplData || !jplData.x.length) return [];
  const limit = opts?.limit ?? 4;
  const maxRadius = opts?.maxRadiusMeters ?? 15_000;

  const dDeg = maxRadius / 100_000;
  const candidates: { idx: number; dist: number; item: JplItem }[] = [];

  for (let i = 0; i < jplData.x.length; i++) {
    const row = jplData.x[i];
    const lng = row[1];
    const lat = row[2];
    if (Math.abs(lng - anchorCoord[0]) > dDeg || Math.abs(lat - anchorCoord[1]) > dDeg) continue;
    const cat = row[3];
    if (cat === 'fly' || cat === 'under' || cat === 'closed') continue;
    const d = haversine(anchorCoord, [lng, lat]);
    if (d <= maxRadius) {
      candidates.push({ idx: i, dist: d, item: jplParseRow(jplData, i) });
    }
  }

  candidates.sort((a, b) => a.dist - b.dist);
  const top = candidates.slice(0, Math.max(limit * 2, 6));

  const alerts: NearbyJplAlert[] = [];
  for (const c of top) {
    const passes = engine.passes(c.item.a, c.item.b, c.item.dA, clock, 1800, 2);
    const first = passes[0] ?? null;
    const waitSec = first ? Math.max(0, first.dt) : Infinity;
    const severity: JplAlertSeverity =
      waitSec <= 180 ? 'imminent' : waitSec <= 600 ? 'approaching' : 'clear';

    alerts.push({
      index: c.idx,
      item: c.item,
      distanceMeters: c.dist,
      severity,
      nextPass: first
        ? {
            trip: first.trip,
            line: engine.lines.get(first.trip.line),
            waitSec: Math.max(0, first.dt),
            passSec: first.at,
          }
        : null,
    });
  }

  const rank: Record<JplAlertSeverity, number> = { imminent: 0, approaching: 1, clear: 2 };
  alerts.sort((a, b) => rank[a.severity] - rank[b.severity] || a.distanceMeters - b.distanceMeters);
  return alerts.slice(0, limit);
}

/* ── 7. 3D Time-of-Day Atmospheric Lighting (WIB) ─────────────────────────── */

export type DaylightPhase = 'night' | 'dawn' | 'day' | 'dusk';

export interface DaylightLighting {
  phase: DaylightPhase;
  label: string;
  ambientColor: string;
  ambientIntensity: number;
  hemiSkyColor: string;
  hemiGroundColor: string;
  hemiIntensity: number;
  keyColor: string;
  keyIntensity: number;
  sunPos: [number, number, number];
  headlightBeamOpacity: number;
  windowGlow: number;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function getDaylightLighting(secOfDay: number): DaylightLighting {
  const s = ((secOfDay % 86400) + 86400) % 86400;
  const hr = s / 3600;

  if (hr >= 6.75 && hr <= 17.25) {
    const u = (hr - 6.75) / (17.25 - 6.75);
    const angle = u * Math.PI;
    const sx = Math.cos(angle) * 1.4;
    const sz = Math.max(0.55, Math.sin(angle) * 2.0);
    return {
      phase: 'day',
      label: 'Siang',
      ambientColor: '#FFFFFF',
      ambientIntensity: 1.05,
      hemiSkyColor: '#F0F9FF',
      hemiGroundColor: '#94A3B8',
      hemiIntensity: 0.78,
      keyColor: '#FFFDF5',
      keyIntensity: 1.55,
      sunPos: [sx, 0.85, sz],
      headlightBeamOpacity: 0,
      windowGlow: 0,
    };
  }

  if (hr >= 5.0 && hr < 6.75) {
    const t = clamp01((hr - 5.0) / 1.75);
    return {
      phase: 'dawn',
      label: 'Fajar',
      ambientColor: '#FDE68A',
      ambientIntensity: 0.65 + t * 0.35,
      hemiSkyColor: '#FED7AA',
      hemiGroundColor: '#475569',
      hemiIntensity: 0.45 + t * 0.3,
      keyColor: '#FB923C',
      keyIntensity: 0.8 + t * 0.7,
      sunPos: [1.6, 0.7, 0.55 + t * 0.5],
      headlightBeamOpacity: (1 - t) * 0.48,
      windowGlow: (1 - t) * 0.72,
    };
  }

  if (hr > 17.25 && hr <= 18.75) {
    const t = clamp01((hr - 17.25) / 1.5);
    return {
      phase: 'dusk',
      label: 'Senja',
      ambientColor: '#FDBA74',
      ambientIntensity: 1.0 - t * 0.45,
      hemiSkyColor: '#FB923C',
      hemiGroundColor: '#334155',
      hemiIntensity: 0.7 - t * 0.32,
      keyColor: '#F97316',
      keyIntensity: 1.4 - t * 0.8,
      sunPos: [-1.6, 0.7, 1.0 - t * 0.55],
      headlightBeamOpacity: 0.14 + t * 0.44,
      windowGlow: 0.25 + t * 0.65,
    };
  }

  return {
    phase: 'night',
    label: 'Malam',
    ambientColor: '#93C5FD',
    ambientIntensity: 0.55,
    hemiSkyColor: '#3B82F6',
    hemiGroundColor: '#0F172A',
    hemiIntensity: 0.42,
    keyColor: '#BFDBFE',
    keyIntensity: 0.68,
    sunPos: [-0.8, 0.9, 1.5],
    headlightBeamOpacity: 0.58,
    windowGlow: 0.92,
  };
}
