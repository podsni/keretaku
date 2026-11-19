import { memo, useMemo, useState } from 'react';
import {
  ArrowRight,
  Box,
  Compass,
  Gauge,
  GitBranch,
  Loader2,
  LocateFixed,
  MapPin,
  Navigation,
  Radio,
  Satellite,
  Star,
  TrainFront,
} from 'lucide-react';
import type { Engine } from '../engine/sched';
import type { NetworkSummary } from '../engine/analytics';
import {
  BASEMAP_OPTIONS,
  CHIP_SYS,
  REGION_PRESETS,
  SYS_COLOR,
  formatDistanceKm,
  formatWait,
  trainDisplayInfo,
} from '../engine/constants';
import {
  type NearbyCategoryFilter,
  findNearbyLiveTrains,
  findNearestStations,
} from '../engine/nearby';
import { fmt } from '../engine/sched';
import type {
  ClockState,
  MapBasemapId,
  RegionPreset,
  RunningTrain,
  SystemFilterId,
} from '../engine/types';

interface HomePanelProps {
  engine: Engine;
  clock: ClockState;
  running: RunningTrain[];
  summary: NetworkSummary;
  systemFilter: SystemFilterId;
  basemap: MapBasemapId;
  userLocation: [number, number] | null;
  mapCenter: [number, number];
  locating: boolean;
  locationAccuracy: number | null;
  locationError: string | null;
  favoriteStationId: string | null;
  recentStations: string[];
  kaiLoaded: boolean;
  freightLoaded: boolean;
  onSelectFilter: (id: SystemFilterId) => void;
  onSelectBasemap: (id: MapBasemapId) => void;
  onLocateMe: () => void;
  onOpenTrain: (id: string, date: string) => void;
  onOpenTrain3D: (id: string, date: string) => void;
  onOpenStation: (id: string) => void;
  onPlanFromStation: (id: string) => void;
  onJumpRegion: (preset: RegionPreset) => void;
  onOpenRoutePlanner: () => void;
  onOpenLinesTab: () => void;
  onOpenStationsTab: () => void;
}

const NEARBY_TABS: { id: NearbyCategoryFilter; label: string }[] = [
  { id: 'all', label: 'Semua' },
  { id: 'commuter', label: 'Komuter' },
  { id: 'intercity', label: 'Antarkota' },
  { id: 'freight', label: 'Barang' },
];

export const HomePanel = memo(function HomePanel({
  engine,
  clock,
  running,
  summary,
  systemFilter,
  basemap,
  userLocation,
  mapCenter,
  locating,
  locationAccuracy,
  locationError,
  favoriteStationId,
  recentStations,
  kaiLoaded,
  freightLoaded,
  onSelectFilter,
  onSelectBasemap,
  onLocateMe,
  onOpenTrain,
  onOpenTrain3D,
  onOpenStation,
  onPlanFromStation,
  onJumpRegion,
  onOpenRoutePlanner,
  onOpenLinesTab,
  onOpenStationsTab,
}: HomePanelProps) {
  const [nearbyCat, setNearbyCat] = useState<NearbyCategoryFilter>('all');

  const anchorCoord = userLocation ?? mapCenter;
  const usingGps = userLocation !== null;

  const nearestStations = useMemo(
    () => findNearestStations(engine, anchorCoord, clock, 3),
    [engine, anchorCoord[0], anchorCoord[1], clock.date, Math.floor(clock.sec / 30)],
  );
  const nearestPrimary = nearestStations[0] ?? null;

  const nearbyTrains = useMemo(
    () =>
      findNearbyLiveTrains(engine, running, anchorCoord, {
        category: nearbyCat,
        limit: 8,
      }),
    [engine, running, anchorCoord[0], anchorCoord[1], nearbyCat],
  );

  const favStation = favoriteStationId ? engine.st.get(favoriteStationId) : null;
  const favDeps = useMemo(
    () => (favStation ? engine.departures(favStation.id, clock, 6, 4 * 3600) : []),
    [engine, favStation, clock.date, Math.floor(clock.sec / 30)],
  );
  const stationCount = useMemo(() => engine.allStations().length, [engine]);
  const lineCount = useMemo(() => engine.allLines().length, [engine]);

  return (
    <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800/80">
      {/* Live Network Snapshot */}
      <section className="p-4 flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-2">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-emerald-500 shrink-0" aria-hidden="true" />
              <span>Posisi kereta live (GAPEKA &amp; GPS)</span>
            </p>
            <div className="flex items-baseline gap-2.5 mt-0.5">
              <span
                data-testid="active-train-count"
                className="font-mono tabular-nums text-3xl font-bold text-slate-900 dark:text-white tracking-tight"
              >
                {summary.total}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                {summary.moving} berjalan · {summary.dwelling} di stasiun
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenRoutePlanner}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
          >
            Cari Rute
          </button>
        </div>

        {/* Quick Basemap Mode Switcher */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Satellite className="w-3 h-3" aria-hidden="true" />
              Mode Tampilan Peta
            </span>
          </div>
          <div
            role="group"
            aria-label="Pilih mode peta"
            className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800"
          >
            {BASEMAP_OPTIONS.map((opt) => {
              const active = basemap === opt.id;
              const shortLabel = opt.id === 'light' ? 'Terang' : opt.label;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onSelectBasemap(opt.id)}
                  aria-pressed={active}
                  data-testid={`home-basemap-${opt.id}`}
                  className={`py-1.5 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {shortLabel}
                </button>
              );
            })}
          </div>
        </div>

        {(!kaiLoaded || !freightLoaded) && (
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Memuat jadwal GAPEKA 2026 (KA antarkota &amp; KA barang)…
          </p>
        )}
      </section>

      {/* Current Location Detection & Nearest Station */}
      <section className="p-4 flex flex-col gap-2.5" data-testid="nearby-location-card">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <span className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Navigation className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" aria-hidden="true" />
              <span className="truncate">
                {usingGps ? 'Lokasi Saat Ini & Stasiun Terdekat' : 'Deteksi Lokasimu'}
              </span>
            </span>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {usingGps
                ? `GPS aktif${locationAccuracy ? ` · akurasi ±${locationAccuracy} m` : ''}`
                : 'Aktifkan lokasi untuk radar kereta & stasiun di sekitarmu'}
            </p>
          </div>
          <button
            type="button"
            onClick={onLocateMe}
            disabled={locating}
            data-testid="detect-location-btn"
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
              usingGps
                ? 'border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            } disabled:opacity-65`}
          >
            {locating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <LocateFixed className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            <span>{locating ? 'Mencari…' : usingGps ? 'Perbarui' : 'Deteksi Lokasi'}</span>
          </button>
        </div>

        {locationError && (
          <p className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-lg px-2.5 py-1.5">
            {locationError}
          </p>
        )}

        {nearestPrimary && (
          <div className="p-3 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 rounded">
                    {usingGps ? 'Terdekat darimu' : 'Sekitar peta'}
                  </span>
                  <span className="font-mono tabular-nums text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    {nearestPrimary.compass.arrow} {formatDistanceKm(nearestPrimary.distanceMeters)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenStation(nearestPrimary.station.id)}
                  className="mt-1 text-sm font-bold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors text-left block truncate"
                >
                  Stasiun {nearestPrimary.station.name}
                  <span className="ml-1.5 font-mono text-[11px] font-medium text-slate-400">
                    {nearestPrimary.station.id}
                  </span>
                </button>
              </div>
            </div>

            {nearestPrimary.nextDeparture && (
              <div className="text-[11px] text-slate-600 dark:text-slate-300 flex items-center justify-between gap-2 pt-1.5 border-t border-slate-200/70 dark:border-slate-700/60">
                <span className="truncate">
                  Berikutnya: <strong className="font-semibold">{nearestPrimary.nextDeparture.trip.head}</strong>
                </span>
                <span className="font-mono tabular-nums font-semibold text-blue-600 dark:text-blue-400 shrink-0">
                  {fmt(nearestPrimary.nextDeparture.dep)} · {formatWait(nearestPrimary.nextDeparture.wait)}
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-1.5 pt-0.5">
              <button
                type="button"
                onClick={() => onOpenStation(nearestPrimary.station.id)}
                className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Papan Stasiun
              </button>
              <button
                type="button"
                onClick={() => onPlanFromStation(nearestPrimary.station.id)}
                className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-blue-200 dark:border-blue-800/80 bg-blue-50/70 dark:bg-blue-950/40 text-blue-800 dark:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-950/70 transition-colors"
              >
                Rute dari sini
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Nearby Live Running Trains Radar */}
      <section className="p-4 flex flex-col gap-2.5" data-testid="nearby-live-trains">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <TrainFront className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
              <span className="truncate">Kereta Terdekat Berjalan Live</span>
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {usingGps
                ? 'Diurutkan dari lokasi GPS saat ini'
                : 'Diurutkan dari pusat peta · aktifkan GPS untuk lokasimu'}
            </p>
          </div>
          <span className="font-mono tabular-nums text-[11px] font-semibold text-slate-500 dark:text-slate-400 shrink-0">
            {nearbyTrains.length} KA
          </span>
        </div>

        {/* Category filter bar */}
        <div
          role="group"
          aria-label="Filter kategori kereta terdekat"
          className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800"
        >
          {NEARBY_TABS.map((t) => {
            const active = nearbyCat === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setNearbyCat(t.id)}
                aria-pressed={active}
                className={`py-1 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {nearbyTrains.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400 py-3 text-center">
            Belum ada kereta kategori ini yang berjalan saat ini.
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800/70">
            {nearbyTrains.map((item) => {
              const info = trainDisplayInfo(item.train.trip, item.line);
              const subStatus = item.moving
                ? item.nextStationName
                  ? `→ ${item.nextStationName}${item.nextArrivalSec !== null ? ` · ${fmt(item.nextArrivalSec)}` : ''}`
                  : `→ ${item.train.trip.head}`
                : item.currentStationName
                  ? `Di Stasiun ${item.currentStationName}`
                  : 'Berhenti di stasiun';

              return (
                <div
                  key={item.train.trip.key}
                  className="py-2 flex items-center justify-between gap-2 group"
                >
                  <button
                    type="button"
                    onClick={() => onOpenTrain(item.train.trip.id, item.train.trip.date)}
                    className="flex-1 min-w-0 flex items-center gap-2.5 text-left rounded-lg px-1.5 py-1 -ml-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                  >
                    <span
                      className="w-1.5 h-9 rounded-full shrink-0"
                      style={{ backgroundColor: item.line.color }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {info.name}
                        </span>
                        <span className="font-mono text-[10px] font-semibold text-slate-400 dark:text-slate-500 shrink-0">
                          {info.num}
                        </span>
                        {item.approaching && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60 shrink-0">
                            Mendekat
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {subStatus}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] font-mono tabular-nums">
                        <span className="font-semibold text-blue-700 dark:text-blue-400">
                          {item.compass.arrow} {formatDistanceKm(item.distanceMeters)}
                        </span>
                        <span className="text-slate-300 dark:text-slate-700">·</span>
                        <span
                          className={
                            item.moving
                              ? 'text-slate-700 dark:text-slate-200 font-semibold'
                              : 'text-slate-400 dark:text-slate-500'
                          }
                        >
                          {item.moving ? `${item.speedKmh} km/j` : 'Berhenti'}
                        </span>
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenTrain3D(item.train.trip.id, item.train.trip.date)}
                    aria-label={`Lihat ${info.name} ${info.num} dalam tampilan 3D`}
                    title="Lihat kereta 3D langsung"
                    className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-900 hover:text-white dark:hover:bg-blue-600 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0 transition-colors"
                  >
                    <Box className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* System Breakdown Interactive Grid */}
      <section className="p-4 flex flex-col gap-2">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          Sebaran Kereta per Layanan
        </span>
        <div className="grid grid-cols-2 gap-1.5">
          {CHIP_SYS.filter(([id]) => id !== 'all').map(([id, label]) => {
            const count = summary.byChip[id] ?? 0;
            const active = systemFilter === id;
            const dotColor =
              id === 'lrt' ? SYS_COLOR.jbdb : SYS_COLOR[id as keyof typeof SYS_COLOR] || '#64748b';
            return (
              <button
                key={id}
                type="button"
                onClick={() => onSelectFilter(active ? 'all' : id)}
                aria-pressed={active}
                className={`flex items-center justify-between px-2.5 py-2 rounded-lg border text-xs transition-colors ${
                  id === 'barang' ? 'col-span-2' : ''
                } ${
                  active
                    ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 font-semibold'
                    : 'border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: dotColor }}
                  />
                  <span className="truncate">
                    {id === 'barang' ? 'KA Barang (Cargo · Tanker · Parcel)' : label}
                  </span>
                </span>
                <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Fastest Running Train Spotlight */}
      {summary.fastest && (
        <section className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5" aria-hidden="true" />
              Tercepat saat ini · klik untuk rangkaian &amp; jadwal
            </span>
            <span className="font-mono tabular-nums text-xs font-bold text-slate-900 dark:text-white">
              {summary.fastest.kmh} km/j
            </span>
          </div>
          <button
            type="button"
            onClick={() =>
              onOpenTrain(summary.fastest!.train.trip.id, summary.fastest!.train.trip.date)
            }
            className="w-full text-left flex items-center justify-between gap-3 p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors group"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: summary.fastest.line.color }}
                />
                <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                  {trainDisplayInfo(summary.fastest.train.trip, summary.fastest.line).name}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                KA {trainDisplayInfo(summary.fastest.train.trip, summary.fastest.line).num} · tujuan{' '}
                {summary.fastest.train.trip.head}
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white shrink-0 transition-colors" />
          </button>
        </section>
      )}

      {/* Network Explorer Quick Access ("Seluruh Jalur & Stasiun") */}
      <section className="p-4 flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Jelajah seluruh jalur &amp; stasiun
          </span>
          <span className="font-mono tabular-nums text-[11px] text-slate-400">Daop 1–9</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={onOpenStationsTab}
            className="p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition-colors"
          >
            <div className="flex items-center gap-1.5 text-slate-900 dark:text-white">
              <MapPin className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
              <span className="font-mono tabular-nums text-sm font-bold">{stationCount}</span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Semua stasiun
            </div>
          </button>
          <button
            type="button"
            onClick={onOpenLinesTab}
            className="p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition-colors"
          >
            <div className="flex items-center gap-1.5 text-slate-900 dark:text-white">
              <GitBranch className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
              <span className="font-mono tabular-nums text-sm font-bold">{lineCount}</span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Lintas &amp; layanan KA
            </div>
          </button>
        </div>
      </section>

      {/* Favorite Station Live Board (Stasiunku) */}
      <section className="p-4 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" aria-hidden="true" />
            Stasiunku
          </span>
          {favStation && (
            <button
              type="button"
              onClick={() => onOpenStation(favStation.id)}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              Lihat papan penuh
            </button>
          )}
        </div>

        {favStation ? (
          <div>
            <button
              type="button"
              onClick={() => onOpenStation(favStation.id)}
              className="text-sm font-bold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              Stasiun {favStation.name}
            </button>
            <div className="mt-2 divide-y divide-slate-100 dark:divide-slate-800/70">
              {favDeps.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 py-2">
                  Belum ada keberangkatan dalam 4 jam ke depan.
                </p>
              ) : (
                favDeps.map((d) => {
                  const line = engine.lines.get(d.trip.line);
                  const info = trainDisplayInfo(d.trip, line);
                  return (
                    <button
                      key={`${d.trip.key}-${d.i}`}
                      type="button"
                      onClick={() => onOpenTrain(d.trip.id, d.trip.date)}
                      className="w-full py-2 flex items-center justify-between gap-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded px-1 -mx-1 transition-colors"
                    >
                      <div className="min-w-0 flex items-center gap-2">
                        <span
                          className="w-1.5 h-6 rounded-full shrink-0"
                          style={{ backgroundColor: line?.color || '#64748b' }}
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {d.trip.head}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {info.name} · KA {info.num}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-mono tabular-nums text-xs font-bold text-slate-900 dark:text-white">
                          {fmt(d.dep)}
                        </div>
                        <div className="font-mono tabular-nums text-[11px] text-blue-600 dark:text-blue-400">
                          {formatWait(d.wait)}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Pilih stasiun favoritmu (misalnya Manggarai, Gambir, atau Bandung) lalu tekan bintang untuk memantau keberangkatan langsung di sini.
          </p>
        )}
      </section>

      {/* Quick Corridor Jump */}
      <section className="p-4 flex flex-col gap-2">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
          <Compass className="w-3.5 h-3.5" aria-hidden="true" />
          Lompat ke Koridor Rel
        </span>
        <div className="grid grid-cols-2 gap-1.5">
          {REGION_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => onJumpRegion(preset)}
              className={`px-2.5 py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-200 rounded-lg border border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors truncate ${
                preset.id === 'jawa' ? 'col-span-2 font-semibold text-center' : ''
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </section>

      {/* Recent or Popular Stations */}
      <section className="p-4 flex flex-col gap-2">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
          <TrainFront className="w-3.5 h-3.5" aria-hidden="true" />
          {recentStations.length > 0 ? 'Stasiun terakhir dilihat' : 'Stasiun utama Indonesia'}
        </span>
        <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800/70">
          {(recentStations.length > 0
            ? recentStations
            : ['MRI', 'GMR', 'THB', 'BOO', 'BD', 'YK', 'SBI']
          ).map((sid) => {
            const st = engine.st.get(sid);
            if (!st) return null;
            return (
              <button
                key={sid}
                type="button"
                onClick={() => onOpenStation(sid)}
                className="py-2 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded px-1.5 -mx-1.5 transition-colors"
              >
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                  {st.name}
                </span>
                <span className="font-mono tabular-nums text-[11px] text-slate-400 dark:text-slate-500">
                  {st.id}
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
});
