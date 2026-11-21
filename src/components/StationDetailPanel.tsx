import { useEffect, useMemo, useState } from 'react';
import {
  Accessibility,
  ArrowLeft,
  Building2,
  Check,
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSun,
  Droplets,
  Monitor,
  Moon,
  Navigation,
  RefreshCw,
  Star,
  Sun,
  TrainFront,
  Umbrella,
  Wind,
  X,
} from 'lucide-react';
import type { Engine } from '../engine/sched';
import { fmt } from '../engine/sched';
import {
  SYS_SHORT,
  dayLabel,
  formatWait,
  trainDisplayInfo,
} from '../engine/constants';
import {
  formatStationKm,
  getHubInterchangeInfo,
  getStationAccessibility,
  isDepartureWheelchairFriendly,
} from '../engine/javaInsights';
import {
  fetchStationWeather,
  type StationWeather,
  type WeatherIconKind,
} from '../engine/weather';
import type { ClockState, Line, StationsExtraData } from '../engine/types';
import { ShareButton } from './ShareButton';

function WeatherGlyph({ kind, className = 'w-5 h-5' }: { kind: WeatherIconKind; className?: string }) {
  switch (kind) {
    case 'sun':
      return <Sun className={className} aria-hidden="true" />;
    case 'moon':
      return <Moon className={className} aria-hidden="true" />;
    case 'partly-cloudy':
      return <CloudSun className={className} aria-hidden="true" />;
    case 'cloudy':
      return <Cloud className={className} aria-hidden="true" />;
    case 'fog':
      return <CloudFog className={className} aria-hidden="true" />;
    case 'drizzle':
      return <CloudDrizzle className={className} aria-hidden="true" />;
    case 'rain':
      return <CloudRain className={className} aria-hidden="true" />;
    case 'storm':
      return <CloudLightning className={className} aria-hidden="true" />;
  }
}

interface StationDetailPanelProps {
  engine: Engine;
  stationId: string;
  clock: ClockState;
  stationsExtra: StationsExtraData | null;
  isFavorite: boolean;
  onBack: () => void;
  onShare: () => void;
  onToggleFavorite: (id: string) => void;
  onOpenTrain: (id: string, date: string) => void;
  onOpenLine: (id: string) => void;
  onOpenStation?: (id: string) => void;
  onPlanFrom: (id: string) => void;
  onPlanTo: (id: string) => void;
}

export function StationDetailPanel({
  engine,
  stationId,
  clock,
  stationsExtra,
  isFavorite,
  onBack,
  onShare,
  onToggleFavorite,
  onOpenTrain,
  onOpenLine,
  onOpenStation,
  onPlanFrom,
  onPlanTo,
}: StationDetailPanelProps) {
  const [boardMode, setBoardMode] = useState<'live' | 'full'>('live');
  const [scheduleDate, setScheduleDate] = useState(clock.date);
  const [dirFilter, setDirFilter] = useState<string>('all');
  const [wheelchairOnly, setWheelchairOnly] = useState(false);
  const [fidsOpen, setFidsOpen] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const [weather, setWeather] = useState<StationWeather | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [weatherReloadSeq, setWeatherReloadSeq] = useState(0);

  const station = engine.st.get(stationId);
  const extra = stationsExtra?.s?.[stationId];
  const cleanKm = formatStationKm(extra?.km);

  useEffect(() => {
    setImgFailed(false);
  }, [stationId]);

  useEffect(() => {
    if (!station) {
      setWeather(null);
      setWeatherError(null);
      setWeatherLoading(false);
      return;
    }
    const ctrl = new AbortController();
    const forceRefresh = weatherReloadSeq > 0;
    setWeatherLoading(true);
    setWeatherError(null);

    fetchStationWeather(station.lat, station.lng, {
      forceRefresh,
      signal: ctrl.signal,
    })
      .then((data) => {
        if (!ctrl.signal.aborted) {
          setWeather(data);
          setWeatherLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (ctrl.signal.aborted) return;
        setWeather(null);
        setWeatherError(
          err instanceof Error ? err.message : 'Gagal memuat data cuaca stasiun.',
        );
        setWeatherLoading(false);
      });

    return () => ctrl.abort();
  }, [station?.id, station?.lat, station?.lng, weatherReloadSeq]);

  const lines = useMemo(
    () =>
      station
        ? (station.lines || [])
            .map((lid) => engine.lines.get(lid))
            .filter((l): l is Line => Boolean(l))
        : [],
    [engine, station],
  );

  const accessibility = useMemo(
    () => (station ? getStationAccessibility(station, lines, stationsExtra) : null),
    [station, lines, stationsExtra],
  );

  const hubInfo = useMemo(
    () => (station ? getHubInterchangeInfo(station.id, engine) : null),
    [station, engine],
  );

  const departures = useMemo(
    () => (station ? engine.departures(station.id, clock, 40, 8 * 3600) : []),
    [engine, station, clock.date, Math.floor(clock.sec / 30)],
  );

  const visibleDepartures = useMemo(() => {
    if (!wheelchairOnly) return departures;
    return departures.filter((d) =>
      isDepartureWheelchairFriendly(d.trip, engine.lines.get(d.trip.line)).accessible,
    );
  }, [departures, wheelchairOnly, engine]);

  const hiddenLiveCount = departures.length - visibleDepartures.length;

  const fullDay = useMemo(
    () => (station && boardMode === 'full' ? engine.stationDay(station.id, scheduleDate) : null),
    [engine, station, boardMode, scheduleDate],
  );

  const visibleFullRows = useMemo(() => {
    const base = (fullDay?.rows || []).filter(
      (r) => dirFilter === 'all' || (r.terminates ? 'Tiba (stasiun akhir)' : r.trip.head) === dirFilter,
    );
    if (!wheelchairOnly) return base;
    return base.filter((r) =>
      isDepartureWheelchairFriendly(r.trip, engine.lines.get(r.trip.line)).accessible,
    );
  }, [fullDay, dirFilter, wheelchairOnly, engine]);

  if (!station) {
    return (
      <div className="p-4">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-xs font-semibold">
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali</span>
        </button>
        <p className="text-sm text-slate-500 mt-3">Stasiun tidak ditemukan.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Top Bar */}
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali</span>
        </button>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setFidsOpen(true)}
            data-testid="open-fids-btn"
            title="Buka Mode Papan Layar Stasiun (FIDS)"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 min-h-[36px] rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
          >
            <Monitor className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Papan LED</span>
          </button>
          <button
            type="button"
            onClick={() => onToggleFavorite(station.id)}
            aria-pressed={isFavorite}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 min-h-[36px] rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
              isFavorite
                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Star className={`w-3.5 h-3.5 ${isFavorite ? 'fill-amber-500 text-amber-500' : ''}`} />
            <span>{isFavorite ? 'Stasiunku' : 'Simpan'}</span>
          </button>
          <ShareButton
            onClick={onShare}
            ariaLabel={`Bagikan tautan Stasiun ${station.name}`}
            title="Salin tautan stasiun ini"
          />
        </div>
      </div>

      {/* Station Header + Wikimedia Photo */}
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums flex-wrap">
            <span>{station.id}</span>
            {extra?.daop && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-sans">{extra.daop}</span>
              </>
            )}
            {cleanKm && (
              <>
                <span aria-hidden="true">·</span>
                <span>KM {cleanKm}</span>
              </>
            )}
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
            Stasiun {station.name}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {station.sys.map((s) => SYS_SHORT[s]).join(' · ')}
          </p>
        </div>

        {/* Station Photo */}
        {extra?.img?.t && !imgFailed ? (
          <figure className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800">
            <img
              src={extra.img.t}
              alt={`Foto Stasiun ${station.name}`}
              referrerPolicy="no-referrer"
              onError={() => setImgFailed(true)}
              className="w-full h-36 object-cover"
            />
            <figcaption className="px-2.5 py-1.5 text-[11px] text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 flex items-center justify-between gap-2">
              <span className="truncate">Foto: {extra.img.a}</span>
              <a
                href={extra.img.p}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline shrink-0"
              >
                {extra.img.l}
              </a>
            </figcaption>
          </figure>
        ) : (
          <div className="rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 px-3 py-2.5 flex items-center gap-2.5 text-xs text-slate-500 dark:text-slate-400">
            <Building2 className="w-4 h-4 shrink-0 text-slate-400" />
            <span>
              {station.lat.toFixed(4)}°, {station.lng.toFixed(4)}° ·{' '}
              {lines.length} layanan rel terhubung
            </span>
          </div>
        )}

        {/* Quick Route Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPlanFrom(station.id)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 dark:bg-blue-600 text-white hover:bg-slate-800 dark:hover:bg-blue-500 transition-colors"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>Berangkat dari sini</span>
          </button>
          <button
            type="button"
            onClick={() => onPlanTo(station.id)}
            className="flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            Tujuan ke sini
          </button>
        </div>

        {/* Real-Time Station Weather Card */}
        <div
          data-testid="station-weather-card"
          className={`rounded-xl border p-3 flex flex-col gap-2.5 ${
            weather?.tone === 'storm'
              ? 'border-violet-200/90 dark:border-violet-800/70 bg-violet-50/50 dark:bg-violet-950/25'
              : weather?.tone === 'rain'
                ? 'border-sky-200/90 dark:border-sky-800/70 bg-sky-50/50 dark:bg-sky-950/25'
                : weather?.tone === 'clear'
                  ? 'border-amber-200/80 dark:border-amber-800/60 bg-amber-50/40 dark:bg-amber-950/20'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-900 dark:text-white">
              Cuaca Stasiun Saat Ini
            </span>
            <button
              type="button"
              data-testid="station-weather-refresh"
              onClick={() => setWeatherReloadSeq((n) => n + 1)}
              disabled={weatherLoading}
              aria-label="Muat ulang cuaca stasiun"
              title="Muat ulang cuaca real-time"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-3 h-3 ${weatherLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
              <span>{weatherLoading ? 'Memuat…' : 'Perbarui'}</span>
            </button>
          </div>

          {weatherLoading && !weather ? (
            <div className="py-2 flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
              <span>Mengambil kondisi cuaca real-time di Stasiun {station.name}…</span>
            </div>
          ) : weatherError && !weather ? (
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-slate-600 dark:text-slate-300">
                Cuaca belum dapat dimuat ({weatherError}).
              </span>
              <button
                type="button"
                onClick={() => setWeatherReloadSeq((n) => n + 1)}
                className="shrink-0 px-2.5 py-1 rounded-md bg-slate-900 dark:bg-slate-700 text-white text-[11px] font-semibold hover:bg-slate-800"
              >
                Coba lagi
              </button>
            </div>
          ) : weather ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      weather.tone === 'storm'
                        ? 'bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300'
                        : weather.tone === 'rain'
                          ? 'bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300'
                          : weather.tone === 'clear'
                            ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-300'
                            : 'bg-slate-200/80 dark:bg-slate-700/70 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <WeatherGlyph kind={weather.icon} className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {weather.label}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      Terasa {weather.apparentTempC}°C
                      {weather.observedTime ? ` · ${weather.observedTime} WIB` : ''}
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono tabular-nums text-2xl font-extrabold leading-none text-slate-900 dark:text-white">
                    {weather.tempC}°C
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Open-Meteo
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                <div className="rounded-lg bg-white/80 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-700/60 px-2 py-1.5">
                  <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                    <Droplets className="w-3 h-3 text-sky-500 shrink-0" aria-hidden="true" />
                    <span className="truncate">Lembap</span>
                  </div>
                  <div className="font-mono tabular-nums text-xs font-bold text-slate-900 dark:text-white mt-0.5">
                    {weather.humidityPct}%
                  </div>
                </div>
                <div className="rounded-lg bg-white/80 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-700/60 px-2 py-1.5">
                  <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                    <Wind className="w-3 h-3 text-teal-500 shrink-0" aria-hidden="true" />
                    <span className="truncate">Angin</span>
                  </div>
                  <div className="font-mono tabular-nums text-xs font-bold text-slate-900 dark:text-white mt-0.5 truncate">
                    {weather.windSpeedKmh} km/j
                  </div>
                </div>
                <div className="rounded-lg bg-white/80 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-700/60 px-2 py-1.5">
                  <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                    <Umbrella className="w-3 h-3 text-blue-500 shrink-0" aria-hidden="true" />
                    <span className="truncate">Hujan</span>
                  </div>
                  <div className="font-mono tabular-nums text-xs font-bold text-slate-900 dark:text-white mt-0.5">
                    {weather.precipitationMm} mm
                  </div>
                </div>
              </div>

              {weather.hourly.length > 0 && (
                <div className="grid grid-cols-3 gap-1.5">
                  {weather.hourly.map((h) => (
                    <div
                      key={h.timeIso}
                      className="rounded-lg bg-white/60 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800 px-2 py-1 flex items-center justify-between gap-1 text-[11px]"
                    >
                      <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
                        {h.hourLabel}
                      </span>
                      <span className="flex items-center gap-1 font-mono tabular-nums font-semibold text-slate-800 dark:text-slate-100">
                        <span>{h.tempC}°</span>
                        <span
                          className={`text-[10px] ${
                            h.precipProb >= 45
                              ? 'text-sky-600 dark:text-sky-400 font-bold'
                              : 'text-slate-400 dark:text-slate-500'
                          }`}
                          title={`Peluang hujan ${h.precipProb}%`}
                        >
                          {h.precipProb}%
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug pt-1.5 border-t border-slate-200/70 dark:border-slate-700/60">
                {weather.travelTip}
              </p>
            </>
          ) : null}
        </div>

        {/* Station Accessibility & Wheelchair Support Card */}
        {accessibility && (
          <div
            data-testid="station-accessibility-card"
            className={`rounded-xl border p-3 flex flex-col gap-2 ${
              accessibility.tier === 'full'
                ? 'border-emerald-200/90 dark:border-emerald-800/70 bg-emerald-50/50 dark:bg-emerald-950/25'
                : accessibility.tier === 'assisted'
                  ? 'border-blue-200/90 dark:border-blue-800/70 bg-blue-50/50 dark:bg-blue-950/25'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <Accessibility
                  className={`w-4 h-4 shrink-0 ${
                    accessibility.tier === 'full'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : accessibility.tier === 'assisted'
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-slate-500'
                  }`}
                  aria-hidden="true"
                />
                <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  Aksesibilitas &amp; Kursi Roda
                </span>
              </div>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded shrink-0 ${
                  accessibility.tier === 'full'
                    ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200'
                    : accessibility.tier === 'assisted'
                      ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                {accessibility.wheelchairAvailable ? 'Kursi Roda Tersedia' : 'Terbatas'}
              </span>
            </div>

            <p className="text-[11px] font-semibold text-slate-800 dark:text-slate-100">
              {accessibility.tierLabel}
            </p>
            <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
              {accessibility.summary}
            </p>

            <div className="grid grid-cols-2 gap-1.5 pt-0.5">
              {accessibility.features.map((feat) => (
                <div
                  key={feat.id}
                  className={`flex items-center gap-1.5 text-[11px] ${
                    feat.available
                      ? 'text-slate-800 dark:text-slate-100 font-medium'
                      : 'text-slate-400 dark:text-slate-500 line-through'
                  }`}
                >
                  <Check
                    className={`w-3 h-3 shrink-0 ${
                      feat.available ? 'text-emerald-600 dark:text-emerald-400' : 'opacity-30'
                    }`}
                    aria-hidden="true"
                  />
                  <span className="truncate">{feat.label}</span>
                </div>
              ))}
            </div>

            <p className="text-[10px] text-slate-500 dark:text-slate-400 pt-1.5 border-t border-slate-200/70 dark:border-slate-700/60 leading-snug">
              {accessibility.guidance}
            </p>
          </div>
        )}

        {/* Major Java Intermodal Hub Card */}
        {hubInfo && (
          <div
            data-testid="station-hub-card"
            className="rounded-xl border border-indigo-200/80 dark:border-indigo-900/70 bg-indigo-50/40 dark:bg-indigo-950/25 p-3 flex flex-col gap-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200">
                Hub Transit Antarmoda
              </span>
              <span className="text-[10px] font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-100/80 dark:bg-indigo-900/60 px-2 py-0.5 rounded">
                {hubInfo.modes.length} Moda
              </span>
            </div>
            <p className="text-[11px] font-semibold text-slate-900 dark:text-white">
              {hubInfo.hubTitle}
            </p>
            <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
              {hubInfo.transferTip}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {hubInfo.modes.map((m) => (
                <span
                  key={m}
                  className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-white dark:bg-slate-900/80 border border-indigo-200/70 dark:border-indigo-800/60 text-slate-700 dark:text-slate-200"
                >
                  {m}
                </span>
              ))}
            </div>
            {hubInfo.connectedStationIds.length > 0 && onOpenStation && (
              <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-indigo-200/60 dark:border-indigo-900/60">
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                  Simpul terhubung:
                </span>
                {hubInfo.connectedStationIds.map((cid) => {
                  const cs = engine.st.get(cid);
                  if (!cs) return null;
                  return (
                    <button
                      key={cid}
                      type="button"
                      onClick={() => onOpenStation(cid)}
                      className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 hover:underline"
                    >
                      {cs.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Lines Serving Station */}
        {lines.length > 0 && (
          <div className="flex flex-wrap gap-x-3 gap-y-1.5 pt-1">
            {lines.slice(0, 10).map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => onOpenLine(l.id)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: l.color }} />
                <span>{l.svc || l.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Mode Switcher + Wheelchair Availability Filter */}
      <div className="px-4 pt-3 pb-2 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={boardMode === 'live'}
              onClick={() => setBoardMode('live')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                boardMode === 'live'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Papan langsung
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={boardMode === 'full'}
              onClick={() => setBoardMode('full')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                boardMode === 'full'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Jadwal sehari
            </button>
          </div>

          {boardMode === 'full' && (
            <input
              type="date"
              aria-label="Tanggal jadwal stasiun"
              value={scheduleDate}
              onChange={(e) => e.target.value && setScheduleDate(e.target.value)}
              className="text-xs font-mono tabular-nums bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-lg px-2 py-1"
            />
          )}
        </div>

        {/* Wheelchair Availability Filter Toggle */}
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            data-testid="wheelchair-filter-toggle"
            aria-pressed={wheelchairOnly}
            onClick={() => setWheelchairOnly((v) => !v)}
            className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors touch-manipulation ${
              wheelchairOnly
                ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-200'
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <span className="flex items-center gap-2 min-w-0">
              <Accessibility
                className={`w-4 h-4 shrink-0 ${
                  wheelchairOnly ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'
                }`}
                aria-hidden="true"
              />
              <span className="truncate">Ketersediaan Kursi Roda</span>
            </span>
            <span
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${
                wheelchairOnly
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
              }`}
            >
              {wheelchairOnly ? 'Aktif' : 'Semua'}
            </span>
          </button>
        </div>

        {wheelchairOnly && (
          <p className="text-[11px] text-emerald-700 dark:text-emerald-300 leading-snug">
            Menampilkan kereta penumpang dengan akses &amp; bantuan kursi roda
            {boardMode === 'live' && hiddenLiveCount > 0
              ? ` (${hiddenLiveCount} KA non-penumpang disembunyikan)`
              : '.'}
          </p>
        )}
      </div>

      {/* Live Departure Board */}
      {boardMode === 'live' ? (
        <div className="px-4 pb-4">
          {visibleDepartures.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 py-6 text-center">
              {wheelchairOnly
                ? 'Tidak ada keberangkatan penumpang ramah kursi roda dalam 8 jam ke depan.'
                : 'Tidak ada keberangkatan terjadwal dalam 8 jam ke depan.'}
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {visibleDepartures.map((d) => {
                const line = engine.lines.get(d.trip.line);
                const info = trainDisplayInfo(d.trip, line);
                const wc = isDepartureWheelchairFriendly(d.trip, line);
                return (
                  <button
                    key={`${d.trip.key}-${d.i}`}
                    type="button"
                    onClick={() => onOpenTrain(d.trip.id, d.trip.date)}
                    className="w-full py-2.5 flex items-center justify-between gap-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded px-1.5 -mx-1.5 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-1.5 h-8 rounded-full shrink-0"
                        style={{ backgroundColor: line?.color || '#64748b' }}
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {d.trip.head}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {info.name} · KA {info.num}
                          {d.trip.freight ? ' · KA barang' : ''}
                        </div>
                        {wc.accessible && (wheelchairOnly || wc.level === 'level_boarding') && (
                          <div className="inline-flex items-center gap-1 mt-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                            <Accessibility className="w-3 h-3 shrink-0" aria-hidden="true" />
                            <span className="truncate">{wc.shortLabel}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono tabular-nums text-xs font-bold text-slate-900 dark:text-white">
                        {fmt(d.dep)}
                      </div>
                      <div
                        className={`font-mono tabular-nums text-[11px] font-medium ${
                          d.wait <= 120
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-blue-600 dark:text-blue-400'
                        }`}
                      >
                        {formatWait(d.wait)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="px-4 pb-4 flex flex-col gap-3">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            {dayLabel(scheduleDate, engine.net.holidays)} · {visibleFullRows.length} perjalanan
            {wheelchairOnly ? ' ramah kursi roda' : ''}
          </div>
          {fullDay && fullDay.groups.length > 1 && (
            <select
              aria-label="Filter arah tujuan"
              value={dirFilter}
              onChange={(e) => setDirFilter(e.target.value)}
              className="w-full px-2.5 py-2 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
            >
              <option value="all">Semua arah ({fullDay.rows.length})</option>
              {fullDay.groups.map(([head, items]) => (
                <option key={head} value={head}>
                  Tujuan {head} ({items.length})
                </option>
              ))}
            </select>
          )}
          <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {visibleFullRows.slice(0, 120).map((r) => {
              const line = engine.lines.get(r.trip.line);
              const info = trainDisplayInfo(r.trip, line);
              const wc = isDepartureWheelchairFriendly(r.trip, line);
              return (
                <button
                  key={`${r.trip.key}-${r.i}`}
                  type="button"
                  onClick={() => onOpenTrain(r.trip.id, r.trip.date)}
                  className="w-full py-2 flex items-center justify-between gap-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded px-1 -mx-1"
                >
                  <div className="min-w-0 flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: line?.color || '#64748b' }}
                    />
                    <span className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                      {r.terminates ? `Tiba (${info.name})` : r.trip.head}
                    </span>
                    {wheelchairOnly && wc.accessible && (
                      <Accessibility
                        className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0"
                        aria-hidden="true"
                      />
                    )}
                  </div>
                  <div className="font-mono tabular-nums text-xs font-semibold text-slate-900 dark:text-white shrink-0">
                    {fmt(r.dep)}
                  </div>
                </button>
              );
            })}
            {visibleFullRows.length === 0 && (
              <p className="text-xs text-slate-500 dark:text-slate-400 py-6 text-center">
                Tidak ada perjalanan yang sesuai filter pada tanggal ini.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Full-Screen Station FIDS LED Departure Board Modal */}
      {fidsOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Papan Keberangkatan LED Stasiun ${station.name}`}
          data-testid="fids-board-modal"
          className="fixed inset-0 z-50 bg-slate-950/95 text-slate-100 flex flex-col p-4 md:p-6"
        >
          <div className="max-w-5xl w-full mx-auto flex flex-col h-full gap-4">
            {/* FIDS Header */}
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-400/30 flex items-center justify-center text-amber-400 shrink-0">
                  <TrainFront className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-mono uppercase tracking-widest text-amber-400">
                    Papan Informasi Keberangkatan (FIDS) · {station.id}
                  </div>
                  <h3 className="text-lg md:text-2xl font-extrabold text-white truncate">
                    Stasiun {station.name}
                  </h3>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right hidden sm:block">
                  <div className="font-mono tabular-nums text-xl font-bold text-amber-300">
                    {fmt(clock.sec)} WIB
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {wheelchairOnly ? 'Filter: Ramah Kursi Roda' : 'Semua Keberangkatan'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFidsOpen(false)}
                  aria-label="Tutup Papan LED Stasiun"
                  className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* FIDS Filter Bar */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="text-xs text-slate-400">
                Menampilkan {Math.min(18, visibleDepartures.length)} keberangkatan berikutnya dalam 8 jam ke depan
              </div>
              <button
                type="button"
                aria-pressed={wheelchairOnly}
                onClick={() => setWheelchairOnly((v) => !v)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  wheelchairOnly
                    ? 'bg-emerald-600 border-emerald-500 text-white'
                    : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Accessibility className="w-3.5 h-3.5" />
                <span>Ketersediaan Kursi Roda: {wheelchairOnly ? 'Aktif' : 'Semua'}</span>
              </button>
            </div>

            {/* FIDS Departure Rows */}
            <div className="flex-1 overflow-y-auto sepur-scroll rounded-2xl border border-slate-800 bg-slate-900/80 divide-y divide-slate-800/90">
              <div className="grid grid-cols-12 gap-2 px-4 py-2.5 text-[11px] font-mono uppercase tracking-wider text-slate-400 bg-slate-900 sticky top-0">
                <div className="col-span-2">Jam</div>
                <div className="col-span-5">Tujuan / Kereta</div>
                <div className="col-span-3 hidden sm:block">Aksesibilitas</div>
                <div className="col-span-5 sm:col-span-2 text-right">Status</div>
              </div>
              {visibleDepartures.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-400">
                  Tidak ada keberangkatan yang cocok pada jam ini.
                </div>
              ) : (
                visibleDepartures.slice(0, 18).map((d) => {
                  const line = engine.lines.get(d.trip.line);
                  const info = trainDisplayInfo(d.trip, line);
                  const wc = isDepartureWheelchairFriendly(d.trip, line);
                  const boarding = d.wait <= 180;
                  return (
                    <button
                      key={`fids-${d.trip.key}-${d.i}`}
                      type="button"
                      onClick={() => {
                        setFidsOpen(false);
                        onOpenTrain(d.trip.id, d.trip.date);
                      }}
                      className="w-full grid grid-cols-12 gap-2 items-center px-4 py-3 text-left hover:bg-slate-800/70 transition-colors"
                    >
                      <div className="col-span-2 font-mono tabular-nums text-base md:text-lg font-bold text-amber-300">
                        {fmt(d.dep)}
                      </div>
                      <div className="col-span-5 min-w-0 flex items-center gap-2.5">
                        <span
                          className="w-1.5 h-8 rounded-full shrink-0"
                          style={{ backgroundColor: line?.color || '#38bdf8' }}
                        />
                        <div className="min-w-0">
                          <div className="text-sm md:text-base font-bold text-white truncate">
                            {d.trip.head}
                          </div>
                          <div className="text-xs text-slate-400 truncate">
                            {info.name} · KA {info.num}
                          </div>
                        </div>
                      </div>
                      <div className="col-span-3 hidden sm:flex items-center gap-1.5 text-xs">
                        {wc.accessible ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400 font-medium truncate">
                            <Accessibility className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">
                              {wc.level === 'level_boarding' ? 'Peron Rata' : 'Kursi Roda'}
                            </span>
                          </span>
                        ) : (
                          <span className="text-slate-500">KA Barang</span>
                        )}
                      </div>
                      <div className="col-span-5 sm:col-span-2 text-right font-mono tabular-nums">
                        <span
                          className={`inline-block px-2 py-1 rounded-md text-xs font-bold ${
                            boarding
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : 'bg-slate-800 text-sky-300'
                          }`}
                        >
                          {boarding ? 'NAIK KERETA' : formatWait(d.wait)}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
