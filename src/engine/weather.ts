export type WeatherIconKind =
  | 'sun'
  | 'moon'
  | 'partly-cloudy'
  | 'cloudy'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'storm';

export type WeatherTone = 'clear' | 'cloudy' | 'rain' | 'storm';

export interface HourlyWeatherPoint {
  timeIso: string;
  hourLabel: string;
  tempC: number;
  precipProb: number;
  weatherCode: number;
  icon: WeatherIconKind;
}

export interface StationWeather {
  tempC: number;
  apparentTempC: number;
  humidityPct: number;
  windSpeedKmh: number;
  windDirectionDeg: number;
  windCompass: string;
  precipitationMm: number;
  cloudCoverPct: number;
  weatherCode: number;
  isDay: boolean;
  label: string;
  icon: WeatherIconKind;
  tone: WeatherTone;
  travelTip: string;
  hourly: HourlyWeatherPoint[];
  observedTime: string;
  fetchedAtMs: number;
}

export interface WeatherDescriptor {
  label: string;
  icon: WeatherIconKind;
  tone: WeatherTone;
}

/**
 * Maps WMO weather interpretation codes (Open-Meteo standard) into Indonesian
 * labels, semantic icon categories, and visual tones.
 */
export function describeWmoWeather(code: number, isDay = true): WeatherDescriptor {
  if (code === 0) {
    return {
      label: isDay ? 'Cerah' : 'Cerah Malam',
      icon: isDay ? 'sun' : 'moon',
      tone: 'clear',
    };
  }
  if (code === 1) {
    return {
      label: 'Sebagian Cerah',
      icon: isDay ? 'partly-cloudy' : 'moon',
      tone: 'clear',
    };
  }
  if (code === 2) {
    return {
      label: 'Cerah Berawan',
      icon: 'partly-cloudy',
      tone: 'cloudy',
    };
  }
  if (code === 3) {
    return {
      label: 'Berawan Tebal',
      icon: 'cloudy',
      tone: 'cloudy',
    };
  }
  if (code === 45 || code === 48) {
    return {
      label: 'Berkabut',
      icon: 'fog',
      tone: 'cloudy',
    };
  }
  if (code === 51 || code === 53 || code === 55 || code === 56 || code === 57) {
    return {
      label: code >= 55 ? 'Gerimis Lebat' : 'Gerimis Ringan',
      icon: 'drizzle',
      tone: 'rain',
    };
  }
  if (code === 61 || code === 80) {
    return {
      label: 'Hujan Ringan',
      icon: 'rain',
      tone: 'rain',
    };
  }
  if (code === 63 || code === 81 || code === 66) {
    return {
      label: 'Hujan Sedang',
      icon: 'rain',
      tone: 'rain',
    };
  }
  if (code === 65 || code === 67 || code === 82) {
    return {
      label: 'Hujan Lebat',
      icon: 'rain',
      tone: 'storm',
    };
  }
  if (code === 95 || code === 96 || code === 99) {
    return {
      label: code === 95 ? 'Hujan Petir' : 'Badai Petir',
      icon: 'storm',
      tone: 'storm',
    };
  }
  return {
    label: 'Berawan',
    icon: 'cloudy',
    tone: 'cloudy',
  };
}

const WIND_SECTORS = [
  'Utara',
  'Timur Laut',
  'Timur',
  'Tenggara',
  'Selatan',
  'Barat Daya',
  'Barat',
  'Barat Laut',
] as const;

export function formatWindCompass(deg: number): string {
  if (!Number.isFinite(deg)) return 'Utara';
  const norm = ((deg % 360) + 360) % 360;
  return WIND_SECTORS[Math.round(norm / 45) % 8];
}

export function buildWeatherApiUrl(lat: number, lng: number): string {
  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lng.toFixed(4),
    current: [
      'temperature_2m',
      'relative_humidity_2m',
      'apparent_temperature',
      'is_day',
      'precipitation',
      'weather_code',
      'cloud_cover',
      'wind_speed_10m',
      'wind_direction_10m',
    ].join(','),
    hourly: ['temperature_2m', 'precipitation_probability', 'weather_code'].join(','),
    forecast_hours: '4',
    timezone: 'Asia/Jakarta',
  });
  return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
}

export function buildTravelWeatherTip(w: Pick<
  StationWeather,
  'tone' | 'precipitationMm' | 'apparentTempC' | 'windSpeedKmh' | 'hourly' | 'isDay'
>): string {
  const maxNextProb = w.hourly.reduce((m, h) => Math.max(m, h.precipProb), 0);

  if (w.tone === 'storm') {
    return 'Waspada hujan lebat/petir di area stasiun. Gunakan peron beratap, siapkan jas hujan, dan beri waktu ekstra menuju stasiun.';
  }
  if (w.tone === 'rain' || w.precipitationMm >= 0.4) {
    return 'Sedang turun hujan di sekitar stasiun. Siapkan payung/jas hujan dan hati-hati permukaan peron serta jalur akses yang licin.';
  }
  if (maxNextProb >= 55) {
    return `Potensi hujan ${maxNextProb}% dalam 3 jam ke depan. Sebaiknya bawa payung lipat untuk perjalanan keluar-masuk stasiun.`;
  }
  if (w.windSpeedKmh >= 28) {
    return 'Angin cukup kencang di sekitar lintasan. Jaga barang bawaan ringan dan berdiri di belakang garis kuning peron.';
  }
  if (w.isDay && w.apparentTempC >= 34) {
    return 'Udara cukup terik dan gerah di area stasiun. Siapkan air minum dan pilih ruang tunggu berpendingin sebelum boarding.';
  }
  if (!w.isDay) {
    return 'Cuaca malam kondusif untuk perjalanan. Siapkan jaket ringan untuk kenyamanan di dalam kereta ber-AC.';
  }
  return 'Cuaca sekitar stasiun relatif cerah dan nyaman untuk berangkat maupun transit antarmoda.';
}

function formatIsoHourWib(iso: string): string {
  const m = iso.match(/T(\d{2}):(\d{2})/);
  if (!m) return iso;
  return `${m[1]}.${m[2]}`;
}

export function parseOpenMeteoResponse(raw: unknown, fetchedAtMs = Date.now()): StationWeather {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Respons cuaca tidak valid.');
  }
  const obj = raw as Record<string, unknown>;
  const cur = obj.current as Record<string, unknown> | undefined;
  if (!cur || typeof cur.temperature_2m !== 'number') {
    throw new Error('Data cuaca saat ini tidak tersedia.');
  }

  const tempC = Number(cur.temperature_2m);
  const apparentTempC =
    typeof cur.apparent_temperature === 'number' ? cur.apparent_temperature : tempC;
  const humidityPct =
    typeof cur.relative_humidity_2m === 'number' ? Math.round(cur.relative_humidity_2m) : 0;
  const windSpeedKmh =
    typeof cur.wind_speed_10m === 'number' ? Math.round(cur.wind_speed_10m) : 0;
  const windDirectionDeg =
    typeof cur.wind_direction_10m === 'number' ? cur.wind_direction_10m : 0;
  const precipitationMm =
    typeof cur.precipitation === 'number' ? Math.max(0, cur.precipitation) : 0;
  const cloudCoverPct =
    typeof cur.cloud_cover === 'number' ? Math.round(cur.cloud_cover) : 0;
  const weatherCode = typeof cur.weather_code === 'number' ? cur.weather_code : 0;
  const isDay = cur.is_day === undefined ? true : Boolean(cur.is_day);
  const observedTime = typeof cur.time === 'string' ? formatIsoHourWib(cur.time) : '';

  const desc = describeWmoWeather(weatherCode, isDay);

  const hourly: HourlyWeatherPoint[] = [];
  const hr = obj.hourly as Record<string, unknown> | undefined;
  if (
    hr &&
    Array.isArray(hr.time) &&
    Array.isArray(hr.temperature_2m) &&
    Array.isArray(hr.weather_code)
  ) {
    const probs = Array.isArray(hr.precipitation_probability) ? hr.precipitation_probability : [];
    // Skip index 0 if it mirrors the current hour, otherwise take up to 3 upcoming slots
    const startIdx = hr.time.length >= 4 ? 1 : 0;
    for (let i = startIdx; i < Math.min(hr.time.length, startIdx + 3); i++) {
      const tIso = String(hr.time[i] ?? '');
      const hTemp = Number(hr.temperature_2m[i]);
      const hCode = Number(hr.weather_code[i] ?? 0);
      const hProb = typeof probs[i] === 'number' ? Math.round(probs[i] as number) : 0;
      const hourNum = Number((tIso.match(/T(\d{2})/) || [])[1] ?? 12);
      const hIsDay = hourNum >= 6 && hourNum < 18;
      if (!Number.isFinite(hTemp)) continue;
      hourly.push({
        timeIso: tIso,
        hourLabel: formatIsoHourWib(tIso),
        tempC: Math.round(hTemp),
        precipProb: Math.max(0, Math.min(100, hProb)),
        weatherCode: hCode,
        icon: describeWmoWeather(hCode, hIsDay).icon,
      });
    }
  }

  const base = {
    tempC: Math.round(tempC),
    apparentTempC: Math.round(apparentTempC),
    humidityPct,
    windSpeedKmh,
    windDirectionDeg,
    windCompass: formatWindCompass(windDirectionDeg),
    precipitationMm: Math.round(precipitationMm * 10) / 10,
    cloudCoverPct,
    weatherCode,
    isDay,
    label: desc.label,
    icon: desc.icon,
    tone: desc.tone,
    hourly,
    observedTime,
    fetchedAtMs,
  };

  return {
    ...base,
    travelTip: buildTravelWeatherTip(base),
  };
}

const WEATHER_CACHE_TTL_MS = 10 * 60 * 1000;
const weatherCache = new Map<string, StationWeather>();

function cacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(3)},${lng.toFixed(3)}`;
}

export async function fetchStationWeather(
  lat: number,
  lng: number,
  options?: { forceRefresh?: boolean; signal?: AbortSignal },
): Promise<StationWeather> {
  const key = cacheKey(lat, lng);
  const now = Date.now();
  const cached = weatherCache.get(key);
  if (!options?.forceRefresh && cached && now - cached.fetchedAtMs < WEATHER_CACHE_TTL_MS) {
    return cached;
  }

  const url = buildWeatherApiUrl(lat, lng);
  const resp = await fetch(url, {
    signal: options?.signal,
    headers: { Accept: 'application/json' },
  });
  if (!resp.ok) {
    throw new Error(`Layanan cuaca merespons HTTP ${resp.status}`);
  }
  const json: unknown = await resp.json();
  const parsed = parseOpenMeteoResponse(json, now);
  weatherCache.set(key, parsed);
  return parsed;
}
