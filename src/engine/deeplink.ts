import type { SystemFilterId } from './types';

export interface MapCameraView {
  lat: number;
  lng: number;
  zoom: number;
}

export interface DeepLinkState {
  train?: { id: string; date?: string };
  station?: string;
  line?: string;
  route?: { from: string; to: string; date?: string; sec?: number };
  jplIndex?: number | null;
  jplEnabled?: boolean;
  sys?: SystemFilterId;
  date?: string;
  sec?: number;
  camera?: MapCameraView | null;
}

export interface ParsedDeepLink {
  trainId: string | null;
  trainDate: string | null;
  stationId: string | null;
  lineId: string | null;
  routeFrom: string | null;
  routeTo: string | null;
  jplIndex: number | null;
  jplEnabled: boolean;
  sys: SystemFilterId | null;
  timeSec: number | null;
  camera: MapCameraView | null;
  hasTarget: boolean;
}

const VALID_SYS_FILTERS = new Set<SystemFilterId>([
  'all',
  'krl',
  'mrt',
  'lrt',
  'bandara',
  'whoosh',
  'kai',
  'barang',
]);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function safeDecode(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export function serializeDeepLinkHash(state: DeepLinkState): string {
  const parts: string[] = [];
  let emittedDate = false;

  if (state.train?.id) {
    parts.push(`train=${encodeURIComponent(state.train.id)}`);
    if (state.train.date && DATE_RE.test(state.train.date)) {
      parts.push(`td=${state.train.date}`);
      emittedDate = true;
    }
  } else if (state.station) {
    parts.push(`station=${encodeURIComponent(state.station)}`);
  } else if (state.line) {
    parts.push(`line=${encodeURIComponent(state.line)}`);
  } else if (state.route?.from && state.route?.to) {
    parts.push(`from=${encodeURIComponent(state.route.from)}`);
    parts.push(`to=${encodeURIComponent(state.route.to)}`);
    if (state.route.date && DATE_RE.test(state.route.date)) {
      parts.push(`td=${state.route.date}`);
      emittedDate = true;
    }
    if (
      state.route.sec !== undefined &&
      Number.isFinite(state.route.sec) &&
      state.route.sec >= 0 &&
      state.route.sec < 86400
    ) {
      parts.push(`t=${Math.floor(state.route.sec)}`);
    }
  }

  const hasJplIdx =
    state.jplIndex !== null &&
    state.jplIndex !== undefined &&
    Number.isInteger(state.jplIndex) &&
    state.jplIndex >= 0;

  if (hasJplIdx) {
    parts.push(`jplIdx=${state.jplIndex}`);
  }

  if (
    !state.route &&
    state.sec !== undefined &&
    Number.isFinite(state.sec) &&
    state.sec >= 0 &&
    state.sec < 86400
  ) {
    if (!emittedDate && state.date && DATE_RE.test(state.date)) {
      parts.push(`td=${state.date}`);
      emittedDate = true;
    }
    parts.push(`t=${Math.floor(state.sec)}`);
  } else if (!emittedDate && state.date && DATE_RE.test(state.date)) {
    parts.push(`td=${state.date}`);
  }

  if (state.jplEnabled || hasJplIdx) {
    parts.push('jpl=1');
  }

  if (state.sys && state.sys !== 'all' && VALID_SYS_FILTERS.has(state.sys)) {
    parts.push(`sys=${state.sys}`);
  }

  if (
    state.camera &&
    Number.isFinite(state.camera.lat) &&
    Number.isFinite(state.camera.lng) &&
    Number.isFinite(state.camera.zoom)
  ) {
    const lat = Math.max(-90, Math.min(90, state.camera.lat)).toFixed(5);
    const lng = Math.max(-180, Math.min(180, state.camera.lng)).toFixed(5);
    const zoom = Math.max(2, Math.min(22, state.camera.zoom)).toFixed(1);
    parts.push(`@${lat},${lng},${zoom}`);
  }

  return parts.length ? `#${parts.join('&')}` : '';
}

export function buildShareUrl(baseHref: string, state: DeepLinkState): string {
  const base = baseHref.split('#')[0];
  return base + serializeDeepLinkHash(state);
}

export function parseDeepLinkHash(hash: string): ParsedDeepLink {
  const result: ParsedDeepLink = {
    trainId: null,
    trainDate: null,
    stationId: null,
    lineId: null,
    routeFrom: null,
    routeTo: null,
    jplIndex: null,
    jplEnabled: false,
    sys: null,
    timeSec: null,
    camera: null,
    hasTarget: false,
  };

  if (!hash) return result;
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!raw.trim()) return result;

  for (const part of raw.split('&')) {
    if (!part) continue;
    if (part.startsWith('@')) {
      const segs = part.slice(1).split(',');
      if (segs.length === 3) {
        const lat = Number(segs[0]);
        const lng = Number(segs[1]);
        const zoom = Number(segs[2]);
        if (
          Number.isFinite(lat) &&
          Number.isFinite(lng) &&
          Number.isFinite(zoom) &&
          lat >= -90 &&
          lat <= 90 &&
          lng >= -180 &&
          lng <= 180 &&
          zoom >= 2 &&
          zoom <= 22
        ) {
          result.camera = { lat, lng, zoom };
        }
      }
      continue;
    }

    const eq = part.indexOf('=');
    if (eq <= 0) continue;
    const key = part.slice(0, eq);
    const val = safeDecode(part.slice(eq + 1)).trim();
    if (!val) continue;

    if (key === 'train') {
      result.trainId = val;
    } else if (key === 'td' && DATE_RE.test(val)) {
      result.trainDate = val;
    } else if (key === 'station') {
      result.stationId = val;
    } else if (key === 'line') {
      result.lineId = val;
    } else if (key === 'from') {
      result.routeFrom = val;
    } else if (key === 'to') {
      result.routeTo = val;
    } else if (key === 'jplIdx') {
      const idx = Number(val);
      if (Number.isInteger(idx) && idx >= 0) {
        result.jplIndex = idx;
        result.jplEnabled = true;
      }
    } else if (key === 'jpl') {
      result.jplEnabled = val === '1' || val === 'true';
    } else if (key === 'sys' && VALID_SYS_FILTERS.has(val as SystemFilterId)) {
      result.sys = val as SystemFilterId;
    } else if (key === 't') {
      const sec = Number(val);
      if (Number.isFinite(sec) && sec >= 0 && sec < 86400) {
        result.timeSec = Math.floor(sec);
      }
    }
  }

  result.hasTarget = Boolean(
    result.trainId ||
      result.stationId ||
      result.lineId ||
      (result.routeFrom && result.routeTo) ||
      result.jplIndex !== null ||
      result.camera ||
      result.jplEnabled ||
      result.sys ||
      result.timeSec !== null,
  );

  return result;
}

export function describeShareTarget(state: DeepLinkState): string {
  if (state.train?.id) return 'Tautan kereta disalin ke papan klip';
  if (state.station) return 'Tautan stasiun disalin ke papan klip';
  if (state.line) return 'Tautan jalur disalin ke papan klip';
  if (state.route?.from && state.route?.to) return 'Tautan rute perjalanan disalin ke papan klip';
  if (state.jplIndex !== null && state.jplIndex !== undefined) {
    return 'Tautan titik perlintasan (JPL) disalin ke papan klip';
  }
  return 'Tautan tampilan peta disalin ke papan klip';
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback below when iframe permission policy blocks navigator.clipboard
    }
  }

  if (typeof document === 'undefined') return false;

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.left = '-9999px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);
    return copied;
  } catch {
    return false;
  }
}
