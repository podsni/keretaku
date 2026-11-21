import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Compass,
  GitBranch,
  Home,
  MapPin,
  Pause,
  Play,
  Route,
  Search,
  X,
} from 'lucide-react';
import { Engine, addDays, jakartaClock } from './engine/sched';
import { summarizeNetwork, unifiedSearch } from './engine/analytics';
import { DEFAULT_LAYERS, FCAT, formatClockFull, jplParseRow } from './engine/constants';
import { findNearestStations } from './engine/nearby';
import {
  type DeepLinkState,
  type MapCameraView,
  type ParsedDeepLink,
  buildShareUrl,
  copyTextToClipboard,
  describeShareTarget,
  parseDeepLinkHash,
  serializeDeepLinkHash,
} from './engine/deeplink';
import type { Camera3DMode } from './engine/eta';
import type { LiveGpsFix } from './engine/gps';
import type {
  ClockState,
  DetailState,
  FleetMap,
  FreightCategory,
  FreightData,
  Journey,
  JplData,
  JplFilter,
  KaiData,
  LayerState,
  MapBasemapId,
  NetworkData,
  RegionPreset,
  RunningTrain,
  SidebarTab,
  StationsExtraData,
  SystemFilterId,
  TerminalsData,
  TripsData,
} from './engine/types';
import { MapCanvas, type MapCommand } from './components/MapCanvas';
import { TopMapControls } from './components/TopMapControls';
import { MapRightRail } from './components/MapRightRail';
import { TimeMachineDock } from './components/TimeMachineDock';
import { LayersPopover } from './components/LayersPopover';
import { JplLegendCard } from './components/JplLegendCard';
import { JplFloatingCard } from './components/JplFloatingCard';
import { HomePanel } from './components/HomePanel';
import { TrainDetailPanel } from './components/TrainDetailPanel';
import { Train3DHud } from './components/Train3DHud';
import { StationDetailPanel } from './components/StationDetailPanel';
import { LineDetailPanel } from './components/LineDetailPanel';
import { RoutePlannerPanel } from './components/RoutePlannerPanel';
import { LinesListPanel } from './components/LinesListPanel';
import { StationsListPanel } from './components/StationsListPanel';
import { JplDetailPanel } from './components/JplDetailPanel';
import { SearchResultsPanel } from './components/SearchResultsPanel';
import { AboutModal } from './components/AboutModal';

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Gagal memuat ${url} (${res.status})`);
  return res.json() as Promise<T>;
}

const STORAGE_PREFIX = 'sepur_live_v2_';

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  } catch {
    // ignore storage quota failures
  }
}

interface SimClockAnchor {
  isLive: boolean;
  date: string;
  sec: number;
  wallMs: number;
  speed: number;
  paused: boolean;
}

type MobileSheetSnap = 'peek' | 'half' | 'full';

export default function App() {
  // Core engine & progressive data bundles
  const [engine, setEngine] = useState<Engine | null>(null);
  const [dataVersion, setDataVersion] = useState(0);
  const [bootError, setBootError] = useState<string | null>(null);
  const [bootProgress, setBootProgress] = useState(15);
  const [kaiLoaded, setKaiLoaded] = useState(false);
  const [freightLoaded, setFreightLoaded] = useState(false);

  const [fleet, setFleet] = useState<FleetMap | null>(null);
  const [stationsExtra, setStationsExtra] = useState<StationsExtraData | null>(null);
  const [jplData, setJplData] = useState<JplData | null>(null);
  const [jplLoading, setJplLoading] = useState(false);
  const [terminalsData, setTerminalsData] = useState<TerminalsData | null>(null);

  // Theme & Switchable Basemap (Light / Dark / Satellite / Hybrid)
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    readStorage<'light' | 'dark'>('theme', 'light'),
  );
  const [basemap, setBasemap] = useState<MapBasemapId>(() => {
    const saved = readStorage<MapBasemapId | null>('basemap', null);
    if (saved === 'light' || saved === 'dark' || saved === 'satellite' || saved === 'hybrid') {
      return saved;
    }
    return readStorage<'light' | 'dark'>('theme', 'light');
  });
  const lastVectorBasemapRef = useRef<'light' | 'dark'>(theme);

  // Clock / Time Machine
  const clockAnchorRef = useRef<SimClockAnchor>({
    isLive: true,
    date: jakartaClock().date,
    sec: jakartaClock().sec,
    wallMs: performance.now(),
    speed: 1,
    paused: false,
  });
  const [uiClock, setUiClock] = useState<ClockState>(() => jakartaClock());
  const [isLive, setIsLive] = useState(true);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);

  // Compute exact current simulation clock
  const getClock = useCallback((): ClockState => {
    const a = clockAnchorRef.current;
    if (a.isLive && !a.paused && a.speed === 1) {
      return jakartaClock();
    }
    const dt = a.paused ? 0 : ((performance.now() - a.wallMs) / 1000) * a.speed;
    let sec = a.sec + dt;
    let date = a.date;
    while (sec >= 86400) {
      sec -= 86400;
      date = addDays(date, 1);
    }
    while (sec < 0) {
      sec += 86400;
      date = addDays(date, -1);
    }
    const dow = new Date(date + 'T00:00:00Z').getUTCDay();
    return { date, dow, sec };
  }, []);

  // Sync UI clock every 1s
  useEffect(() => {
    const timer = window.setInterval(() => {
      setUiClock(getClock());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [getClock]);

  // Apply dark mode class on <html> & persist basemap
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    writeStorage('theme', theme);
  }, [theme]);

  useEffect(() => {
    writeStorage('basemap', basemap);
    if (basemap === 'light' || basemap === 'dark') {
      lastVectorBasemapRef.current = basemap;
    }
  }, [basemap]);

  // UI Navigation & Panels
  const [tab, setTab] = useState<SidebarTab>('beranda');
  const [detail, setDetail] = useState<DetailState>(null);
  const [floatingJplIndex, setFloatingJplIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [mobileSheet, setMobileSheet] = useState<MobileSheetSnap>('peek');
  const [mobileTimeOpen, setMobileTimeOpen] = useState(false);
  const touchStartYRef = useRef<number | null>(null);
  const [layersOpen, setLayersOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToastMsg(null), 3200);
  }, []);

  // Map Layers & Filters
  const [layers, setLayers] = useState<LayerState>(() => ({
    ...DEFAULT_LAYERS,
    ...readStorage<Partial<LayerState>>('layers', {}),
  }));
  const [systemFilter, setSystemFilter] = useState<SystemFilterId>('all');
  const [freightCats, setFreightCats] = useState<FreightCategory[]>(() =>
    readStorage<FreightCategory[]>('fcats', Object.keys(FCAT) as FreightCategory[]),
  );
  const [jplFilter, setJplFilter] = useState<JplFilter>(() =>
    readStorage<JplFilter>('jpl_filter', { cats: [], daop: '' }),
  );
  const [threeD, setThreeD] = useState(false);
  const [camera3DMode, setCamera3DMode] = useState<Camera3DMode>('side');
  const [underground, setUnderground] = useState(false);
  const [followTrain, setFollowTrain] = useState(false);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([106.835, -6.235]);
  const [locating, setLocating] = useState(false);
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [gpsTracking, setGpsTracking] = useState(false);
  const [gpsFix, setGpsFix] = useState<LiveGpsFix | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const gpsWatchIdRef = useRef<number | null>(null);
  const [mapCommand, setMapCommand] = useState<MapCommand | null>(null);
  const mapViewRef = useRef<MapCameraView | null>(null);
  const [justShared, setJustShared] = useState(false);
  const justSharedTimerRef = useRef<number | null>(null);
  const [deepLinkHydrated, setDeepLinkHydrated] = useState(false);
  const pendingTrainRef = useRef<{ id: string; date: string; hasCamera: boolean } | null>(null);
  const pendingJplRef = useRef<{ index: number; hasCamera: boolean } | null>(null);
  const pendingRouteRef = useRef<{ from: string; to: string; date: string; sec: number; hasCamera: boolean } | null>(null);
  const [routeDate, setRouteDate] = useState<string | null>(null);
  const [routeSec, setRouteSec] = useState<number | null>(null);

  // Favorites & Recent
  const [favoriteStationId, setFavoriteStationId] = useState<string | null>(() =>
    readStorage<string | null>('fav_station', 'MRI'),
  );
  const [recentStations, setRecentStations] = useState<string[]>(() =>
    readStorage<string[]>('recent_stations', []),
  );

  // Route Planner State
  const [routeFrom, setRouteFrom] = useState<string | null>(null);
  const [routeTo, setRouteTo] = useState<string | null>(null);
  const [pickStationMode, setPickStationMode] = useState<'from' | 'to' | null>(null);
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [activeJourneyIdx, setActiveJourneyIdx] = useState(0);

  // Live running trains snapshot updated ~1Hz from map loop or fallback tick
  const [running, setRunning] = useState<RunningTrain[]>([]);

  // Boot: load network + trips + fleet first, then background KAI + Freight + station photos
  useEffect(() => {
    let cancelled = false;
    async function boot() {
      try {
        setBootProgress(25);
        const [net, trips, fleetJson] = await Promise.all([
          fetchJson<NetworkData>('/data/network.json'),
          fetchJson<TripsData>('/data/trips.json'),
          fetchJson<FleetMap>('/data/fleet.json').catch(() => null),
        ]);
        if (cancelled) return;
        setBootProgress(75);
        const eng = new Engine(net, trips);
        eng.freightOn = (line) =>
          Boolean(line && layers.barang && (!line.cat || freightCats.includes(line.cat)));
        setEngine(eng);
        setFleet(fleetJson);
        setRunning(eng.running(getClock()));
        setBootProgress(100);

        // Progressive background loading: KAI, Freight, Station Photos
        Promise.all([
          fetchJson<KaiData>('/data/kai.json').then((kai) => {
            if (cancelled) return;
            eng.addKai(kai);
            setKaiLoaded(true);
            setDataVersion((v) => v + 1);
          }),
          fetchJson<FreightData>('/data/freight.json').then((fr) => {
            if (cancelled) return;
            eng.addFreight(fr);
            setFreightLoaded(true);
            setDataVersion((v) => v + 1);
          }),
          fetchJson<StationsExtraData>('/data/stations_x.json')
            .then((sx) => {
              if (!cancelled) setStationsExtra(sx);
            })
            .catch(() => {}),
        ]).catch(() => {});
      } catch (err) {
        if (!cancelled) {
          setBootError(err instanceof Error ? err.message : 'Gagal memuat data jadwal.');
        }
      }
    }
    boot();
    return () => {
      cancelled = true;
    };
  }, []);

  // Keep engine freight visibility predicate synced
  useEffect(() => {
    if (!engine) return;
    engine.freightOn = (line) =>
      Boolean(line && layers.barang && (!line.cat || freightCats.includes(line.cat)));
    writeStorage('layers', layers);
    writeStorage('fcats', freightCats);
  }, [engine, layers, freightCats]);

  useEffect(() => {
    writeStorage('jpl_filter', jplFilter);
  }, [jplFilter]);

  // Lazy load JPL when enabled
  const ensureJplLoaded = useCallback(async () => {
    if (jplData || jplLoading) return;
    setJplLoading(true);
    try {
      const data = await fetchJson<JplData>('/data/jpl.json');
      setJplData(data);
      showToast(`Memuat ${data.x.length.toLocaleString('id-ID')} titik perlintasan sebidang (JPL)`);
    } catch {
      showToast('Data perlintasan gagal dimuat');
    } finally {
      setJplLoading(false);
    }
  }, [jplData, jplLoading, showToast]);

  // Lazy load Terminals when enabled
  const ensureTerminalsLoaded = useCallback(async () => {
    if (terminalsData) return;
    try {
      const data = await fetchJson<TerminalsData>('/data/terminals.json');
      setTerminalsData(data);
    } catch {
      // ignore
    }
  }, [terminalsData]);

  useEffect(() => {
    if (layers.jpl) ensureJplLoaded();
    else setFloatingJplIndex(null);
  }, [layers.jpl, ensureJplLoaded]);

  useEffect(() => {
    if (layers.terminals) ensureTerminalsLoaded();
  }, [layers.terminals, ensureTerminalsLoaded]);

  // Refresh running trains when KAI/freight bundles finish loading or date/pause changes
  useEffect(() => {
    if (!engine) return;
    setRunning(engine.running(getClock()));
  }, [engine, dataVersion, uiClock.date, paused, getClock]);

  // Live On-Board GPS tracking watcher (real browser geolocation)
  useEffect(() => {
    if (!gpsTracking) {
      if (gpsWatchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(gpsWatchIdRef.current);
        gpsWatchIdRef.current = null;
      }
      setGpsError(null);
      return;
    }
    if (!navigator.geolocation) {
      setGpsError('Browser tidak mendukung sensor GPS.');
      return;
    }
    setGpsError(null);
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const nextFix: LiveGpsFix = {
          lng: pos.coords.longitude,
          lat: pos.coords.latitude,
          accuracy: pos.coords.accuracy,
          speedMps: pos.coords.speed,
          heading: pos.coords.heading,
          timestamp: pos.timestamp,
        };
        setGpsFix(nextFix);
        setGpsError(null);
        setUserLocation([nextFix.lng, nextFix.lat]);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setGpsError('Izin akses GPS ditolak. Aktifkan izin lokasi browser untuk melacak.');
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setGpsError('Sinyal GPS belum tersedia di lokasi saat ini.');
        } else {
          setGpsError('Waktu pencarian GPS habis. Coba lagi di dekat jendela kereta.');
        }
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 12000 },
    );
    gpsWatchIdRef.current = id;
    return () => {
      navigator.geolocation.clearWatch(id);
      if (gpsWatchIdRef.current === id) gpsWatchIdRef.current = null;
    };
  }, [gpsTracking]);

  // Keyboard shortcut `/` to focus search & Escape to dismiss overlays
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        setDrawerOpen(true);
        if (window.innerWidth < 768) {
          setMobileSheet('full');
          mobileSearchInputRef.current?.focus();
        } else {
          searchInputRef.current?.focus();
        }
      } else if (e.key === 'Escape') {
        setLayersOpen(false);
        setAboutOpen(false);
        setFloatingJplIndex(null);
        setMobileTimeOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Time Machine Helpers
  const setSimulationClock = useCallback(
    (next: Partial<SimClockAnchor>) => {
      const cur = getClock();
      const prev = clockAnchorRef.current;
      const updated: SimClockAnchor = {
        isLive: next.isLive ?? false,
        date: next.date ?? cur.date,
        sec: next.sec ?? cur.sec,
        wallMs: performance.now(),
        speed: next.speed ?? prev.speed,
        paused: next.paused ?? prev.paused,
      };
      clockAnchorRef.current = updated;
      setIsLive(updated.isLive);
      setPaused(updated.paused);
      setSpeed(updated.speed);
      setUiClock(getClock());
    },
    [getClock],
  );

  const handleResetLive = useCallback(() => {
    const now = jakartaClock();
    clockAnchorRef.current = {
      isLive: true,
      date: now.date,
      sec: now.sec,
      wallMs: performance.now(),
      speed: 1,
      paused: false,
    };
    setIsLive(true);
    setPaused(false);
    setSpeed(1);
    setUiClock(now);
    showToast('Kembali ke waktu nyata WIB');
  }, [showToast]);

  // Camera Commands
  const flyTo = useCallback((lng: number, lat: number, zoom?: number) => {
    setMapCommand({ type: 'flyTo', lng, lat, zoom, nonce: Date.now() + Math.random() });
  }, []);

  const zoomIn = useCallback(() => {
    setMapCommand({ type: 'zoomIn', nonce: Date.now() + Math.random() });
  }, []);

  const zoomOut = useCallback(() => {
    setMapCommand({ type: 'zoomOut', nonce: Date.now() + Math.random() });
  }, []);

  const fitBounds = useCallback((coords: [number, number][]) => {
    if (!coords.length) return;
    let minLng = Infinity,
      maxLng = -Infinity,
      minLat = Infinity,
      maxLat = -Infinity;
    for (const [lng, lat] of coords) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
    setMapCommand({
      type: 'fitBounds',
      bounds: [
        [minLng, minLat],
        [maxLng, maxLat],
      ],
      nonce: Date.now() + Math.random(),
    });
  }, []);

  // Navigation Handlers
  const openStation = useCallback(
    (id: string) => {
      if (!engine) return;
      if (pickStationMode) {
        if (pickStationMode === 'from') setRouteFrom(id);
        else setRouteTo(id);
        setPickStationMode(null);
        setTab('rute');
        setDetail(null);
        setMobileSheet('full');
        return;
      }
      const st = engine.st.get(id);
      if (!st) return;
      setSearchQuery('');
      setFollowTrain(false);
      setFloatingJplIndex(null);
      setDetail({ type: 'station', id });
      setDrawerOpen(true);
      setMobileSheet('half');
      setMobileTimeOpen(false);
      flyTo(st.lng, st.lat, 13.5);
      setRecentStations((prev) => {
        const next = [id, ...prev.filter((x) => x !== id)].slice(0, 6);
        writeStorage('recent_stations', next);
        return next;
      });
    },
    [engine, pickStationMode, flyTo],
  );

  const openTrain = useCallback(
    (id: string, date: string) => {
      if (!engine) return;
      setSearchQuery('');
      setDetail({ type: 'train', id, date });
      setDrawerOpen(true);
      setMobileSheet(threeD ? 'peek' : 'half');
      setMobileTimeOpen(false);
      if (threeD) {
        setCamera3DMode('side');
        return;
      }
      const found = engine.find(id, getClock(), date);
      if (found) {
        const st = engine.state(found.trip, found.t);
        if (st) flyTo(st.p[0], st.p[1], 13.6);
      }
    },
    [engine, getClock, flyTo, threeD],
  );

  const openTrain3D = useCallback(
    (id: string, date: string) => {
      if (!engine) return;
      setSearchQuery('');
      setFloatingJplIndex(null);
      setDetail({ type: 'train', id, date });
      setCamera3DMode('side');
      setThreeD(true);
      setDrawerOpen(true);
      setMobileTimeOpen(false);
      if (window.innerWidth < 768) {
        setMobileSheet('peek');
      }
    },
    [engine],
  );

  const openLine = useCallback(
    (id: string) => {
      if (!engine) return;
      const l = engine.lines.get(id);
      if (!l) return;
      setSearchQuery('');
      setFollowTrain(false);
      setFloatingJplIndex(null);
      setDetail({ type: 'line', id });
      setDrawerOpen(true);
      setMobileSheet('half');
      setMobileTimeOpen(false);
      const pts = l.stations
        .map((sid) => engine.st.get(sid))
        .filter(Boolean)
        .map((s) => [s!.lng, s!.lat] as [number, number]);
      fitBounds(pts);
    },
    [engine, fitBounds],
  );

  const openJpl = useCallback(
    (index: number) => {
      if (!jplData) return;
      const item = jplParseRow(jplData, index);
      setSearchQuery('');
      setFollowTrain(false);
      setLayers((prev) => (prev.jpl ? prev : { ...prev, jpl: true }));
      if (window.innerWidth >= 768) {
        // Desktop: open rich floating card over map without dismissing active train/line panel!
        setFloatingJplIndex(index);
      } else {
        // Mobile: open cleanly inside half-height bottom sheet
        setFloatingJplIndex(null);
        setDetail({ type: 'jpl', index });
        setMobileSheet('half');
        setMobileTimeOpen(false);
      }
      flyTo(item.p[0], item.p[1], 15.2);
    },
    [jplData, flyTo],
  );

  const handleJumpRegion = useCallback(
    (preset: RegionPreset) => {
      setFollowTrain(false);
      flyTo(preset.lng, preset.lat, preset.zoom);
      if (window.innerWidth < 768) {
        setMobileSheet('peek');
      }
    },
    [flyTo],
  );

  const handleToggleLayer = useCallback((key: keyof LayerState) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleToggleFreightCat = useCallback((cat: FreightCategory) => {
    setFreightCats((prev) =>
      prev.includes(cat)
        ? prev.length > 1
          ? prev.filter((c) => c !== cat)
          : prev
        : [...prev, cat],
    );
  }, []);

  const handleToggleFavorite = useCallback(
    (id: string) => {
      setFavoriteStationId((prev) => {
        const next = prev === id ? null : id;
        writeStorage('fav_station', next);
        showToast(next ? 'Disimpan sebagai Stasiunku' : 'Dihapus dari Stasiunku');
        return next;
      });
    },
    [showToast],
  );

  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation) {
      const msg = 'Browser tidak mendukung sensor geolokasi.';
      setLocationError(msg);
      showToast(msg);
      return;
    }

    setLocating(true);
    setLocationError(null);

    const onSuccess = (pos: GeolocationPosition) => {
      const coords: [number, number] = [pos.coords.longitude, pos.coords.latitude];
      const acc = Number.isFinite(pos.coords.accuracy) ? Math.round(pos.coords.accuracy) : null;
      setUserLocation(coords);
      setLocationAccuracy(acc);
      setLocationError(null);
      setLocating(false);
      flyTo(coords[0], coords[1], 13.2);

      if (engine) {
        const nearest = findNearestStations(engine, coords, getClock(), 1)[0];
        if (nearest) {
          showToast(
            `Lokasi terdeteksi · dekat Stasiun ${nearest.station.name}${acc ? ` (±${acc} m)` : ''}`,
          );
          return;
        }
      }
      showToast('Peta dipusatkan ke lokasimu saat ini');
    };

    const onFinalError = (err: GeolocationPositionError) => {
      setLocating(false);
      const msg =
        err.code === err.PERMISSION_DENIED
          ? 'Izin lokasi ditolak browser. Aktifkan izin lokasi untuk deteksi otomatis.'
          : err.code === err.POSITION_UNAVAILABLE
            ? 'Sinyal lokasi belum tersedia saat ini. Coba beberapa saat lagi.'
            : 'Waktu pencarian lokasi habis. Pastikan GPS/lokasi perangkat aktif.';
      setLocationError(msg);
      showToast(msg);
    };

    navigator.geolocation.getCurrentPosition(
      onSuccess,
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          onFinalError(err);
          return;
        }
        // Fallback to network/coarse location if high-accuracy GPS timed out or failed
        navigator.geolocation.getCurrentPosition(onSuccess, onFinalError, {
          enableHighAccuracy: false,
          timeout: 8000,
          maximumAge: 60000,
        });
      },
      { enableHighAccuracy: true, timeout: 7000, maximumAge: 30000 },
    );
  }, [engine, flyTo, getClock, showToast]);

  const handleToggleGpsTracking = useCallback(() => {
    setGpsTracking((prev) => {
      const next = !prev;
      showToast(next ? 'Live GPS perangkat diaktifkan' : 'Mode Live GPS dimatikan');
      return next;
    });
  }, [showToast]);

  const handleSelectBasemap = useCallback(
    (next: MapBasemapId) => {
      setBasemap(next);
      if (next === 'dark') setTheme('dark');
      else if (next === 'light') setTheme('light');
      const labels: Record<MapBasemapId, string> = {
        light: 'Mode Peta Terang',
        dark: 'Mode Peta Gelap',
        satellite: 'Mode Peta Satelit',
        hybrid: 'Mode Peta Hibrida (Satelit + Label)',
      };
      showToast(labels[next]);
    },
    [showToast],
  );

  const handleToggleSatellite = useCallback(() => {
    setBasemap((cur) => {
      const isSat = cur === 'satellite' || cur === 'hybrid';
      const next: MapBasemapId = isSat ? lastVectorBasemapRef.current : 'satellite';
      showToast(isSat ? 'Kembali ke peta vektor' : 'Mode Peta Satelit aktif');
      return next;
    });
  }, [showToast]);

  // Stable memoized UI handlers so React.memo panels skip unnecessary clock-tick re-renders
  const handleToggleJpl = useCallback(() => handleToggleLayer('jpl'), [handleToggleLayer]);
  const handleToggle3D = useCallback(() => {
    setThreeD((v) => {
      const next = !v;
      if (next) {
        setCamera3DMode('side');
        if (window.innerWidth < 768) setMobileSheet('peek');
      }
      return next;
    });
  }, []);
  const handleToggleUnderground = useCallback(() => setUnderground((v) => !v), []);
  const handleToggleTheme = useCallback(() => {
    setTheme((t) => {
      const next = t === 'dark' ? 'light' : 'dark';
      lastVectorBasemapRef.current = next;
      setBasemap((bm) => (bm === 'satellite' || bm === 'hybrid' ? bm : next));
      return next;
    });
  }, []);
  const handleToggleLayers = useCallback(() => setLayersOpen((v) => !v), []);
  const handleOpenAbout = useCallback(() => setAboutOpen(true), []);
  const handleViewChange = useCallback((view: MapCameraView) => {
    mapViewRef.current = view;
    setMapCenter((prev) => {
      if (Math.abs(prev[0] - view.lng) < 0.0008 && Math.abs(prev[1] - view.lat) < 0.0008) {
        return prev;
      }
      return [view.lng, view.lat];
    });
  }, []);
  const handlePlanFromStation = useCallback((sid: string) => {
    setRouteFrom(sid);
    setDetail(null);
    setTab('rute');
    setDrawerOpen(true);
    if (window.innerWidth < 768) setMobileSheet('full');
  }, []);
  const handleOpenRoutePlannerTab = useCallback(() => {
    setTab('rute');
    if (window.innerWidth < 768) setMobileSheet('full');
  }, []);
  const handleOpenLinesTab = useCallback(() => {
    setTab('jalur');
    if (window.innerWidth < 768) setMobileSheet('half');
  }, []);
  const handleOpenStationsTab = useCallback(() => {
    setTab('stasiun');
    if (window.innerWidth < 768) setMobileSheet('half');
  }, []);

  // Route Planner Search
  const handleRouteSearch = useCallback(
    (from: string, to: string, date: string, sec: number) => {
      if (!engine) return;
      setRouteDate(date);
      setRouteSec(sec);
      const results = engine.plan(from, to, date, sec, 5);
      setJourneys(results);
      setActiveJourneyIdx(0);
      if (results.length === 0) {
        showToast('Tidak ada rute kereta yang menghubungkan kedua stasiun pada jam tersebut');
        return;
      }
      const pts: [number, number][] = [];
      for (const leg of results[0].legs) {
        const a = engine.st.get(leg.from);
        const b = engine.st.get(leg.to);
        if (a) pts.push([a.lng, a.lat]);
        if (b) pts.push([b.lng, b.lat]);
      }
      fitBounds(pts);
    },
    [engine, fitBounds, showToast],
  );

  // Build deep-link payload representing the currently active view
  const buildCurrentDeepLinkState = useCallback(
    (includeCamera: boolean, override?: Partial<DeepLinkState>): DeepLinkState => {
      const clk = getClock();
      const nonLive = !isLive || paused;
      const base: DeepLinkState = {
        jplEnabled: layers.jpl,
        sys: systemFilter !== 'all' ? systemFilter : undefined,
        camera: includeCamera ? mapViewRef.current : undefined,
      };

      if (detail?.type === 'train') {
        base.train = { id: detail.id, date: detail.date };
        if (nonLive) {
          base.date = clk.date;
          base.sec = Math.floor(clk.sec);
        }
      } else if (detail?.type === 'station') {
        base.station = detail.id;
        if (nonLive) {
          base.date = clk.date;
          base.sec = Math.floor(clk.sec);
        }
      } else if (detail?.type === 'line') {
        base.line = detail.id;
      } else if (detail?.type === 'jpl') {
        base.jplIndex = detail.index;
        base.jplEnabled = true;
      } else if (tab === 'rute' && routeFrom && routeTo && routeFrom !== routeTo) {
        base.route = {
          from: routeFrom,
          to: routeTo,
          date: routeDate ?? clk.date,
          sec: routeSec ?? Math.floor(clk.sec),
        };
      } else if (nonLive) {
        base.date = clk.date;
        base.sec = Math.floor(clk.sec);
      }

      if (floatingJplIndex !== null) {
        base.jplIndex = floatingJplIndex;
        base.jplEnabled = true;
      }

      return { ...base, ...override };
    },
    [detail, floatingJplIndex, getClock, isLive, layers.jpl, paused, routeDate, routeFrom, routeSec, routeTo, systemFilter, tab],
  );

  const handleShare = useCallback(
    async (override?: Partial<DeepLinkState>) => {
      const state = buildCurrentDeepLinkState(true, override);
      const url = buildShareUrl(window.location.href, state);
      const nextHash = serializeDeepLinkHash(state);
      try {
        window.history.replaceState(null, '', nextHash || window.location.pathname + window.location.search);
      } catch {
        // ignore sandboxed history restrictions
      }
      const copied = await copyTextToClipboard(url);
      setJustShared(true);
      if (justSharedTimerRef.current !== null) window.clearTimeout(justSharedTimerRef.current);
      justSharedTimerRef.current = window.setTimeout(() => setJustShared(false), 2000);
      showToast(copied ? describeShareTarget(state) : 'Tautan diperbarui di bilah alamat');
    },
    [buildCurrentDeepLinkState, showToast],
  );

  const handleShareCurrent = useCallback(() => {
    void handleShare();
  }, [handleShare]);

  useEffect(() => {
    return () => {
      if (justSharedTimerRef.current !== null) window.clearTimeout(justSharedTimerRef.current);
    };
  }, []);

  // Hydrate app state from a parsed URL hash deep-link
  const applyDeepLink = useCallback(
    (parsed: ParsedDeepLink, eng: Engine) => {
      pendingTrainRef.current = null;
      pendingJplRef.current = null;
      pendingRouteRef.current = null;
      if (!parsed.hasTarget) return;

      if (parsed.sys) {
        setSystemFilter(parsed.sys);
      }
      if (parsed.jplEnabled) {
        setLayers((prev) => (prev.jpl ? prev : { ...prev, jpl: true }));
      }
      if (parsed.timeSec !== null) {
        setSimulationClock({
          isLive: false,
          date: parsed.trainDate ?? jakartaClock().date,
          sec: parsed.timeSec,
          paused: false,
        });
      }
      if (parsed.camera) {
        mapViewRef.current = parsed.camera;
        flyTo(parsed.camera.lng, parsed.camera.lat, parsed.camera.zoom);
      }

      const activeClock: ClockState =
        parsed.timeSec !== null
          ? {
              date: parsed.trainDate ?? jakartaClock().date,
              dow: new Date((parsed.trainDate ?? jakartaClock().date) + 'T00:00:00Z').getUTCDay(),
              sec: parsed.timeSec,
            }
          : getClock();

      if (parsed.trainId) {
        const targetDate = parsed.trainDate || activeClock.date;
        setSearchQuery('');
        setDetail({ type: 'train', id: parsed.trainId, date: targetDate });
        setDrawerOpen(true);
        if (window.innerWidth < 768) setMobileSheet('half');
        const found = eng.find(parsed.trainId, activeClock, targetDate);
        if (found) {
          if (!parsed.camera) {
            const st = eng.state(found.trip, found.t);
            if (st) flyTo(st.p[0], st.p[1], 13.6);
          }
        } else {
          pendingTrainRef.current = {
            id: parsed.trainId,
            date: targetDate,
            hasCamera: Boolean(parsed.camera),
          };
        }
      } else if (parsed.stationId) {
        const st = eng.st.get(parsed.stationId);
        if (st) {
          setSearchQuery('');
          setFollowTrain(false);
          setDetail({ type: 'station', id: parsed.stationId });
          setDrawerOpen(true);
          if (window.innerWidth < 768) setMobileSheet('half');
          if (!parsed.camera) flyTo(st.lng, st.lat, 13.5);
        }
      } else if (parsed.lineId) {
        const l = eng.lines.get(parsed.lineId);
        if (l) {
          setSearchQuery('');
          setFollowTrain(false);
          setDetail({ type: 'line', id: parsed.lineId });
          setDrawerOpen(true);
          if (window.innerWidth < 768) setMobileSheet('half');
          if (!parsed.camera) {
            const pts = l.stations
              .map((sid) => eng.st.get(sid))
              .filter(Boolean)
              .map((s) => [s!.lng, s!.lat] as [number, number]);
            fitBounds(pts);
          }
        }
      } else if (parsed.routeFrom && parsed.routeTo && parsed.routeFrom !== parsed.routeTo) {
        const rDate = parsed.trainDate || activeClock.date;
        const rSec = parsed.timeSec ?? Math.floor(activeClock.sec);
        setRouteDate(rDate);
        setRouteSec(rSec);
        setSearchQuery('');
        setDetail(null);
        setTab('rute');
        setRouteFrom(parsed.routeFrom);
        setRouteTo(parsed.routeTo);
        setDrawerOpen(true);
        if (window.innerWidth < 768) setMobileSheet('full');

        const results = eng.plan(parsed.routeFrom, parsed.routeTo, rDate, rSec, 5);
        if (results.length > 0) {
          setJourneys(results);
          setActiveJourneyIdx(0);
          if (!parsed.camera) {
            const pts: [number, number][] = [];
            for (const leg of results[0].legs) {
              const a = eng.st.get(leg.from);
              const b = eng.st.get(leg.to);
              if (a) pts.push([a.lng, a.lat]);
              if (b) pts.push([b.lng, b.lat]);
            }
            fitBounds(pts);
          }
        } else {
          pendingRouteRef.current = {
            from: parsed.routeFrom,
            to: parsed.routeTo,
            date: rDate,
            sec: rSec,
            hasCamera: Boolean(parsed.camera),
          };
        }
      }

      if (parsed.jplIndex !== null) {
        if (jplData && parsed.jplIndex < jplData.x.length) {
          const item = jplParseRow(jplData, parsed.jplIndex);
          if (window.innerWidth >= 768) {
            setFloatingJplIndex(parsed.jplIndex);
          } else if (!parsed.trainId && !parsed.stationId && !parsed.lineId) {
            setDetail({ type: 'jpl', index: parsed.jplIndex });
            setMobileSheet('half');
          }
          if (!parsed.camera) flyTo(item.p[0], item.p[1], 15.2);
        } else {
          pendingJplRef.current = {
            index: parsed.jplIndex,
            hasCamera: Boolean(parsed.camera),
          };
        }
      }
    },
    [fitBounds, flyTo, getClock, jplData, setSimulationClock],
  );

  // Hydrate initial URL hash once engine boots, and listen for manual hash navigation
  useEffect(() => {
    if (!engine) return;
    if (!deepLinkHydrated) {
      const parsed = parseDeepLinkHash(window.location.hash);
      if (parsed.hasTarget) {
        applyDeepLink(parsed, engine);
      }
      setDeepLinkHydrated(true);
    }
    const onHashChange = () => {
      const parsed = parseDeepLinkHash(window.location.hash);
      if (parsed.hasTarget) {
        applyDeepLink(parsed, engine);
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [engine, deepLinkHydrated, applyDeepLink]);

  // Retry pending KAI/Freight train or intercity route deep-link once background bundles load
  useEffect(() => {
    if (!engine || dataVersion === 0) return;
    const pTrain = pendingTrainRef.current;
    if (pTrain) {
      const found = engine.find(pTrain.id, getClock(), pTrain.date);
      if (found) {
        pendingTrainRef.current = null;
        if (!pTrain.hasCamera) {
          const st = engine.state(found.trip, found.t);
          if (st) flyTo(st.p[0], st.p[1], 13.6);
        }
      }
    }
    const pRoute = pendingRouteRef.current;
    if (pRoute) {
      const results = engine.plan(pRoute.from, pRoute.to, pRoute.date, pRoute.sec, 5);
      if (results.length > 0) {
        pendingRouteRef.current = null;
        setJourneys(results);
        setActiveJourneyIdx(0);
        if (!pRoute.hasCamera) {
          const pts: [number, number][] = [];
          for (const leg of results[0].legs) {
            const a = engine.st.get(leg.from);
            const b = engine.st.get(leg.to);
            if (a) pts.push([a.lng, a.lat]);
            if (b) pts.push([b.lng, b.lat]);
          }
          fitBounds(pts);
        }
      }
    }
  }, [engine, dataVersion, getClock, flyTo, fitBounds]);

  // Complete pending JPL deep-link once jpl.json finishes lazy loading
  useEffect(() => {
    if (!jplData || !pendingJplRef.current) return;
    const { index, hasCamera } = pendingJplRef.current;
    pendingJplRef.current = null;
    if (index < 0 || index >= jplData.x.length) return;
    const item = jplParseRow(jplData, index);
    if (window.innerWidth >= 768) {
      setFloatingJplIndex(index);
    } else {
      setDetail((prev) => prev ?? { type: 'jpl', index });
      setMobileSheet('half');
    }
    if (!hasCamera) flyTo(item.p[0], item.p[1], 15.2);
  }, [jplData, flyTo]);

  // Keep URL hash synced with the active view so copying the address bar also works as a deep-link
  useEffect(() => {
    if (!deepLinkHydrated) return;
    const nextHash = serializeDeepLinkHash(buildCurrentDeepLinkState(false));
    const currentHash = window.location.hash;
    if (nextHash === currentHash) return;
    try {
      window.history.replaceState(
        null,
        '',
        nextHash || window.location.pathname + window.location.search,
      );
    } catch {
      // ignore sandboxed history restrictions
    }
  }, [deepLinkHydrated, buildCurrentDeepLinkState]);

  const handleSimulateJourney = useCallback(
    (journey: Journey) => {
      const firstRide = journey.legs.find((l) => !l.walk && l.trip);
      if (!firstRide || !firstRide.trip) return;
      setSimulationClock({
        isLive: false,
        date: journey.date,
        sec: Math.max(0, journey.dep - 30),
        speed: 30,
        paused: false,
      });
      setFollowTrain(true);
      openTrain(firstRide.trip.id, firstRide.trip.date);
      showToast('Simulasi perjalanan 30× dimulai');
    },
    [setSimulationClock, openTrain, showToast],
  );

  // Mobile sheet swipe gestures
  const handleSheetTouchStart = (e: React.TouchEvent) => {
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleSheetTouchEnd = (e: React.TouchEvent) => {
    if (touchStartYRef.current === null) return;
    const dy = e.changedTouches[0].clientY - touchStartYRef.current;
    touchStartYRef.current = null;
    if (dy < -36) {
      setMobileSheet((prev) => (prev === 'peek' ? 'half' : 'full'));
    } else if (dy > 36) {
      setMobileSheet((prev) => (prev === 'full' ? 'half' : 'peek'));
    }
  };

  const cycleMobileSheet = () => {
    setMobileSheet((prev) => (prev === 'peek' ? 'half' : prev === 'half' ? 'full' : 'peek'));
  };

  // Derived analytics & search
  const networkSummary = useMemo(
    () =>
      engine
        ? summarizeNetwork(engine, running)
        : {
            total: 0,
            moving: 0,
            dwelling: 0,
            byChip: { all: 0, krl: 0, mrt: 0, lrt: 0, bandara: 0, whoosh: 0, kai: 0, barang: 0 },
            fastest: null,
          },
    [engine, running],
  );

  const searchResults = useMemo(
    () =>
      engine && searchQuery.trim()
        ? unifiedSearch(searchQuery, engine, running, jplData)
        : { stations: [], lines: [], trains: [], jpls: [] },
    [engine, searchQuery, running, jplData],
  );

  const activeJourney =
    tab === 'rute' && journeys[activeJourneyIdx] ? journeys[activeJourneyIdx] : null;
  const selectedJplIndex =
    floatingJplIndex !== null ? floatingJplIndex : detail?.type === 'jpl' ? detail.index : null;

  const mobileSheetHeightClass =
    mobileSheet === 'full'
      ? 'h-[85dvh] md:h-auto'
      : mobileSheet === 'half'
        ? 'h-[50dvh] md:h-auto'
        : 'h-auto md:h-auto';

  const mobileTabs: { id: SidebarTab; label: string; icon: typeof Home }[] = [
    { id: 'beranda', label: 'Beranda', icon: Home },
    { id: 'jalur', label: 'Jalur', icon: GitBranch },
    { id: 'rute', label: 'Rute', icon: Route },
    { id: 'stasiun', label: 'Stasiun', icon: MapPin },
  ];

  return (
    <div className="relative h-[100dvh] w-screen overflow-hidden bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 select-none">
      {/* Full-Bleed Map Viewport */}
      <main className="absolute inset-0">
        <MapCanvas
          engine={engine}
          getClock={getClock}
          theme={theme}
          basemap={basemap}
          layers={layers}
          systemFilter={systemFilter}
          freightCats={freightCats}
          jplData={jplData}
          jplFilter={jplFilter}
          selectedJplIndex={selectedJplIndex}
          terminalsData={terminalsData}
          detail={detail}
          activeJourney={activeJourney}
          followTrain={followTrain}
          threeD={threeD}
          camera3DMode={camera3DMode}
          underground={underground}
          pickStationMode={pickStationMode}
          userLocation={userLocation}
          command={mapCommand}
          onSelectTrain={openTrain}
          onSelectStation={openStation}
          onSelectLine={openLine}
          onSelectJpl={openJpl}
          onStopFollow={() => {
            setFollowTrain(false);
            showToast('Berhenti mengikuti kereta');
          }}
          onChangeCamera3DMode={setCamera3DMode}
          onFrameRunning={setRunning}
          onViewChange={handleViewChange}
        />
      </main>

      {/* Mobile Floating Top Bar (Compact Search + System Chips — Leaves Map Wide Open) */}
      <div className="md:hidden fixed top-2.5 left-2.5 right-2.5 z-20 pointer-events-none flex flex-col gap-1.5">
        <div className="pointer-events-auto flex items-center gap-2 px-2.5 py-1.5 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/90 dark:border-slate-800 shadow-md">
          <button
            type="button"
            onClick={() => {
              setDetail(null);
              setSearchQuery('');
              setTab('beranda');
              setMobileSheet('peek');
            }}
            aria-label="Beranda Sepur Live"
            className="w-8 h-8 rounded-xl overflow-hidden shrink-0 touch-manipulation shadow-2xs"
          >
            <img src="/icon.svg" alt="" className="w-full h-full" />
          </button>

          <div className="relative flex-1 min-w-0">
            <Search
              className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              ref={mobileSearchInputRef}
              type="search"
              aria-label="Cari stasiun, jalur, kereta, atau jalan perlintasan"
              placeholder="Cari stasiun, KA, jalur…"
              value={searchQuery}
              onFocus={() => setMobileSheet('full')}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (e.target.value.trim()) setMobileSheet('full');
              }}
              className="w-full pl-7 pr-6 py-1.5 rounded-xl text-xs bg-slate-100/80 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="Hapus pencarian"
                onClick={() => setSearchQuery('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <span className="font-mono tabular-nums text-[11px] font-bold text-slate-600 dark:text-slate-300 pr-1 whitespace-nowrap shrink-0">
            {networkSummary.total} KA
          </span>
        </div>

        {/* Single-row horizontally scrollable System Filters on Mobile */}
        <TopMapControls
          systemFilter={systemFilter}
          activeCounts={networkSummary.byChip}
          onSelectFilter={setSystemFilter}
          onJumpRegion={handleJumpRegion}
        />
      </div>

      {/* Desktop Top Controls (System Filter Bar + Quick Region Jumps) */}
      <div
        className={`hidden md:flex fixed top-3 right-16 z-20 pointer-events-none flex-col items-start gap-2 transition-all duration-200 ${
          drawerOpen ? 'left-[412px]' : 'left-3'
        }`}
      >
        <TopMapControls
          systemFilter={systemFilter}
          activeCounts={networkSummary.byChip}
          onSelectFilter={setSystemFilter}
          onJumpRegion={handleJumpRegion}
        />
      </div>

      {/* Right Vertical Map Control Rail (Desktop always visible; Mobile visible when map is open) */}
      <div
        className={`${
          mobileSheet === 'peek' ? 'flex' : 'hidden md:flex'
        } fixed right-2.5 md:right-3 top-[112px] md:top-1/2 md:-translate-y-1/2 z-20 pointer-events-none flex-col items-end gap-2`}
      >
        <MapRightRail
          jplEnabled={layers.jpl}
          threeD={threeD}
          underground={underground}
          theme={theme}
          basemap={basemap}
          locating={locating}
          hasUserLocation={userLocation !== null}
          layersOpen={layersOpen}
          justShared={justShared}
          onToggleJpl={handleToggleJpl}
          onToggle3D={handleToggle3D}
          onToggleSatellite={handleToggleSatellite}
          onToggleUnderground={handleToggleUnderground}
          onToggleTheme={handleToggleTheme}
          onToggleLayers={handleToggleLayers}
          onLocateMe={handleLocateMe}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onShare={handleShareCurrent}
          onOpenAbout={handleOpenAbout}
        />
      </div>

      {/* Layers Popover (Responsive modal/popover anchored cleanly next to Right Rail) */}
      {layersOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 z-25 bg-slate-950/30 backdrop-blur-[1px]"
            onClick={() => setLayersOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed z-30 top-[112px] right-3 left-3 md:left-auto md:top-16 md:right-16 flex justify-end pointer-events-none">
            <LayersPopover
              basemap={basemap}
              layers={layers}
              freightCats={freightCats}
              jplData={jplData}
              jplLoading={jplLoading}
              jplFilter={jplFilter}
              onSelectBasemap={handleSelectBasemap}
              onToggleLayer={handleToggleLayer}
              onToggleFreightCat={handleToggleFreightCat}
              onUpdateJplFilter={setJplFilter}
              onClose={() => setLayersOpen(false)}
            />
          </div>
        </>
      )}

      {/* Floating 3D Train Tracking HUD (Active when 3D Mode + Selected Train) */}
      {threeD && detail?.type === 'train' && engine && floatingJplIndex === null && (
        <div
          className={`fixed z-25 pointer-events-none flex justify-center transition-all duration-200
            top-[106px] left-2.5 right-14
            md:top-24 md:right-16 ${drawerOpen ? 'md:left-[412px]' : 'md:left-3'}`}
        >
          <Train3DHud
            engine={engine}
            trainId={detail.id}
            trainDate={detail.date}
            clock={uiClock}
            simSpeed={speed}
            simPaused={paused}
            gpsTracking={gpsTracking}
            gpsFix={gpsFix}
            cameraMode={camera3DMode}
            onSelectCameraMode={setCamera3DMode}
            onExit3D={() => setThreeD(false)}
          />
        </div>
      )}

      {/* Floating JPL Card on Desktop (Overlays map without dismissing active Train/Line panel) */}
      {floatingJplIndex !== null && engine && jplData && (
        <div
          className={`hidden md:flex fixed top-24 z-25 pointer-events-none justify-center right-16 transition-all duration-200 ${
            drawerOpen ? 'left-[412px]' : 'left-3'
          }`}
        >
          <JplFloatingCard
            engine={engine}
            jplData={jplData}
            index={floatingJplIndex}
            clock={uiClock}
            onClose={() => setFloatingJplIndex(null)}
            onShare={() => void handleShare({ jplIndex: floatingJplIndex, jplEnabled: true })}
            onOpenTrain={(tid, tdate) => openTrain(tid, tdate)}
            onOpenStation={(sid) => openStation(sid)}
            onOpenLine={(lid) => openLine(lid)}
          />
        </div>
      )}

      {/* Floating JPL Legend Card (Bottom-Left of Map when JPL layer is active) */}
      {layers.jpl && (
        <div
          className={`fixed z-20 pointer-events-none transition-all duration-200 ${
            mobileSheet === 'peek' ? 'bottom-[126px] left-2.5' : 'hidden md:block'
          } md:bottom-3 ${drawerOpen ? 'md:left-[412px]' : 'md:left-3'}`}
        >
          <JplLegendCard
            jplData={jplData}
            jplFilter={jplFilter}
            onUpdateJplFilter={setJplFilter}
            onOpenLayers={() => setLayersOpen(true)}
          />
        </div>
      )}

      {/* Mobile Floating Clock / Time Machine Trigger & Expandable Dock */}
      {mobileSheet === 'peek' && (
        <div className="md:hidden fixed bottom-[76px] left-2.5 right-2.5 z-20 pointer-events-none flex flex-col items-start gap-2">
          {mobileTimeOpen ? (
            <TimeMachineDock
              clock={uiClock}
              isLive={isLive}
              paused={paused}
              speed={speed}
              holidays={engine?.net.holidays || []}
              compact
              onCloseCompact={() => setMobileTimeOpen(false)}
              onTogglePause={() => setSimulationClock({ paused: !paused, isLive: false })}
              onSetSpeed={(sp) => setSimulationClock({ speed: sp, paused: false, isLive: false })}
              onScrubSec={(sec) => setSimulationClock({ sec, isLive: false })}
              onChangeDate={(date) => setSimulationClock({ date, isLive: false })}
              onResetLive={handleResetLive}
            />
          ) : (
            <div className="pointer-events-auto inline-flex items-center gap-1 p-1 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/90 dark:border-slate-800 shadow-md">
              <button
                type="button"
                onClick={() => setSimulationClock({ paused: !paused, isLive: false })}
                aria-label={paused ? 'Lanjutkan simulasi' : 'Jeda simulasi'}
                className="w-8 h-8 rounded-xl bg-slate-900 dark:bg-blue-600 text-white flex items-center justify-center shrink-0 touch-manipulation"
              >
                {paused ? <Play className="w-3.5 h-3.5 fill-current" /> : <Pause className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => setMobileTimeOpen(true)}
                aria-label="Buka mesin waktu simulasi"
                className="px-2.5 py-1 flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100 touch-manipulation"
              >
                <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                <span className="font-mono tabular-nums font-bold">
                  {formatClockFull(uiClock.sec).slice(0, 5)}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  WIB{speed !== 1 ? ` · ${speed}×` : ''}
                </span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Left Docked Sidebar (Desktop) / 3-State Swipeable Bottom Sheet (Mobile) */}
      <aside
        aria-label="Panel navigasi dan informasi Sepur Live"
        className={`fixed z-25 transition-[transform,height] duration-200 ease-out bg-white/98 dark:bg-slate-900/98 backdrop-blur-md border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col
          md:top-3 md:bottom-3 md:left-3 md:w-[388px] md:rounded-2xl md:border
          ${drawerOpen ? 'md:translate-x-0' : 'md:-translate-x-[404px]'}
          bottom-0 left-0 right-0 rounded-t-3xl md:rounded-2xl border-t
          ${mobileSheetHeightClass}
        `}
      >
        {/* Mobile Drag Handle & Quick Sheet Snap Controls */}
        <div
          onTouchStart={handleSheetTouchStart}
          onTouchEnd={handleSheetTouchEnd}
          className="md:hidden shrink-0 flex flex-col"
        >
          <button
            type="button"
            onClick={cycleMobileSheet}
            aria-label={
              mobileSheet === 'full'
                ? 'Perkecil panel bawah'
                : mobileSheet === 'half'
                  ? 'Perbesar panel bawah penuh'
                  : 'Buka panel bawah'
            }
            className="w-full pt-2 pb-1.5 flex items-center justify-center gap-1.5 text-slate-400 touch-manipulation"
          >
            <span className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
            {mobileSheet === 'full' ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronUp className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Mobile Bottom Nav Bar (Always visible when in peek, or compact header when expanded) */}
          {mobileSheet === 'peek' && (
            <nav
              aria-label="Navigasi bawah mobile"
              className="grid grid-cols-4 gap-1 px-2 pb-safe"
            >
              {mobileTabs.map(({ id, label, icon: Icon }) => {
                const active = tab === id && !detail;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setTab(id);
                      setDetail(null);
                      setSearchQuery('');
                      setPickStationMode(null);
                      setMobileTimeOpen(false);
                      setMobileSheet('half');
                    }}
                    className={`min-h-[46px] py-1 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-colors touch-manipulation ${
                      active
                        ? 'text-blue-600 dark:text-blue-400 font-bold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-[10px] leading-tight">{label}</span>
                  </button>
                );
              })}
            </nav>
          )}
        </div>

        {/* Desktop Brand Header + Search Input + Tabs (also shows Tabs on Mobile when expanded without detail) */}
        <div
          className={`${
            mobileSheet === 'peek' ? 'hidden md:flex' : 'flex'
          } px-4 pt-1 md:pt-4 pb-3 border-b border-slate-100 dark:border-slate-800 flex-col gap-3 shrink-0`}
        >
          {/* Brand Row (Desktop) */}
          <div className="hidden md:flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                setDetail(null);
                setTab('beranda');
                setSearchQuery('');
              }}
              className="flex items-center gap-2.5 text-left"
            >
              <img
                src="/icon.svg"
                alt=""
                className="w-7 h-7 rounded-lg shrink-0 shadow-2xs"
              />
              <span className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
                Sepur Live
              </span>
            </button>

            <span className="font-mono tabular-nums text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
              {networkSummary.total} KA aktif
            </span>
          </div>

          {/* Unified Search (Desktop; on mobile it sits in the floating top bar, plus shown here when full) */}
          <div className="hidden md:block relative">
            <Search
              className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              ref={searchInputRef}
              type="search"
              aria-label="Cari stasiun, jalur, kereta, atau jalan perlintasan"
              placeholder="Cari stasiun, KA, jalur, atau jalan… (/)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 rounded-xl text-xs bg-slate-100/90 dark:bg-slate-800 border border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="Hapus pencarian"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Primary Segmented Navigation Tabs */}
          {!detail && !searchQuery.trim() && (
            <div className="flex items-center gap-2">
              <div
                role="tablist"
                aria-label="Navigasi utama"
                className="flex-1 grid grid-cols-4 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl"
              >
                {(
                  [
                    ['beranda', 'Beranda'],
                    ['jalur', 'Jalur'],
                    ['rute', 'Rute'],
                    ['stasiun', 'Stasiun'],
                  ] as [SidebarTab, string][]
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={tab === id}
                    onClick={() => {
                      setTab(id);
                      setPickStationMode(null);
                      if (window.innerWidth < 768 && mobileSheet === 'peek') {
                        setMobileSheet('half');
                      }
                    }}
                    className={`py-1.5 min-h-[34px] md:min-h-[30px] text-xs font-semibold rounded-lg transition-colors whitespace-nowrap touch-manipulation ${
                      tab === id
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {/* Quick collapse button on mobile */}
              <button
                type="button"
                onClick={() => setMobileSheet('peek')}
                aria-label="Tutup panel ke peta"
                className="md:hidden w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center shrink-0 touch-manipulation"
              >
                <Compass className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Scrollable Drawer Body (Hidden on mobile when peek so bottom bar stays compact!) */}
        <div
          className={`${
            mobileSheet === 'peek' ? 'hidden md:block' : 'block'
          } flex-1 overflow-y-auto sepur-scroll select-text pb-safe`}
        >
          {!engine ? (
            <div className="p-6 flex flex-col gap-3">
              <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
              <div className="h-10 w-full bg-slate-100 dark:bg-slate-800/70 rounded animate-pulse" />
              <div className="h-10 w-full bg-slate-100 dark:bg-slate-800/70 rounded animate-pulse" />
            </div>
          ) : searchQuery.trim() ? (
            <SearchResultsPanel
              query={searchQuery}
              engine={engine}
              results={searchResults}
              onOpenStation={openStation}
              onOpenLine={openLine}
              onOpenTrain={openTrain}
              onOpenJpl={openJpl}
            />
          ) : detail?.type === 'train' ? (
            <TrainDetailPanel
              engine={engine}
              trainId={detail.id}
              trainDate={detail.date}
              clock={uiClock}
              simSpeed={speed}
              simPaused={paused}
              threeD={threeD}
              fleet={fleet}
              followTrain={followTrain}
              gpsTracking={gpsTracking}
              gpsFix={gpsFix}
              gpsError={gpsError}
              onBack={() => {
                setDetail(null);
                setFollowTrain(false);
                if (window.innerWidth < 768) setMobileSheet('peek');
              }}
              onShare={handleShareCurrent}
              onToggleFollow={() => setFollowTrain((v) => !v)}
              onToggle3DView={handleToggle3D}
              onToggleGpsTracking={handleToggleGpsTracking}
              onFastForward={() => {
                setSimulationClock({ speed: 60, paused: false, isLive: false });
                setFollowTrain(true);
                showToast('Simulasi dipercepat 60×');
              }}
              onOpenStation={openStation}
              onOpenLine={openLine}
              onOpenTrain={openTrain}
            />
          ) : detail?.type === 'station' ? (
            <StationDetailPanel
              engine={engine}
              stationId={detail.id}
              clock={uiClock}
              stationsExtra={stationsExtra}
              isFavorite={favoriteStationId === detail.id}
              onBack={() => {
                setDetail(null);
                if (window.innerWidth < 768) setMobileSheet('peek');
              }}
              onShare={() => void handleShare()}
              onToggleFavorite={handleToggleFavorite}
              onOpenTrain={openTrain}
              onOpenLine={openLine}
              onOpenStation={openStation}
              onPlanFrom={(sid) => {
                setRouteFrom(sid);
                setDetail(null);
                setTab('rute');
                if (window.innerWidth < 768) setMobileSheet('full');
              }}
              onPlanTo={(sid) => {
                setRouteTo(sid);
                setDetail(null);
                setTab('rute');
                if (window.innerWidth < 768) setMobileSheet('full');
              }}
            />
          ) : detail?.type === 'line' ? (
            <LineDetailPanel
              engine={engine}
              lineId={detail.id}
              clock={uiClock}
              running={running}
              onBack={() => {
                setDetail(null);
                if (window.innerWidth < 768) setMobileSheet('peek');
              }}
              onShare={() => void handleShare()}
              onOpenTrain={openTrain}
              onOpenStation={openStation}
            />
          ) : detail?.type === 'jpl' && jplData ? (
            <JplDetailPanel
              engine={engine}
              jplData={jplData}
              index={detail.index}
              clock={uiClock}
              onBack={() => {
                setDetail(null);
                if (window.innerWidth < 768) setMobileSheet('peek');
              }}
              onShare={() => void handleShare({ jplIndex: detail.index, jplEnabled: true })}
              onOpenTrain={openTrain}
              onOpenStation={openStation}
              onOpenLine={openLine}
            />
          ) : tab === 'beranda' ? (
            <HomePanel
              engine={engine}
              clock={uiClock}
              running={running}
              summary={networkSummary}
              systemFilter={systemFilter}
              basemap={basemap}
              userLocation={userLocation}
              mapCenter={mapCenter}
              locating={locating}
              locationAccuracy={locationAccuracy}
              locationError={locationError}
              favoriteStationId={favoriteStationId}
              recentStations={recentStations}
              kaiLoaded={kaiLoaded}
              freightLoaded={freightLoaded}
              jplData={jplData}
              jplLoading={jplLoading}
              onSelectFilter={setSystemFilter}
              onSelectBasemap={handleSelectBasemap}
              onLocateMe={handleLocateMe}
              onEnableJpl={() => {
                setLayers((prev) => ({ ...prev, jpl: true }));
                void ensureJplLoaded();
              }}
              onOpenJpl={openJpl}
              onOpenTrain={openTrain}
              onOpenTrain3D={openTrain3D}
              onOpenStation={openStation}
              onPlanFromStation={handlePlanFromStation}
              onJumpRegion={handleJumpRegion}
              onOpenRoutePlanner={handleOpenRoutePlannerTab}
              onOpenLinesTab={handleOpenLinesTab}
              onOpenStationsTab={handleOpenStationsTab}
            />
          ) : tab === 'jalur' ? (
            <LinesListPanel engine={engine} running={running} onOpenLine={openLine} />
          ) : tab === 'rute' ? (
            <RoutePlannerPanel
              engine={engine}
              clock={uiClock}
              fromId={routeFrom}
              toId={routeTo}
              routeDate={routeDate}
              routeSec={routeSec}
              pickMode={pickStationMode}
              activeJourneyIndex={activeJourneyIdx}
              journeys={journeys}
              onSetFrom={setRouteFrom}
              onSetTo={setRouteTo}
              onSwap={() => {
                setRouteFrom(routeTo);
                setRouteTo(routeFrom);
              }}
              onSetPickMode={(mode) => {
                setPickStationMode(mode);
                if (mode && window.innerWidth < 768) {
                  setMobileSheet('peek');
                  showToast('Ketuk stasiun di peta');
                }
              }}
              onSearch={handleRouteSearch}
              onSelectJourney={(idx) => {
                setActiveJourneyIdx(idx);
                const j = journeys[idx];
                if (j) {
                  const pts: [number, number][] = [];
                  for (const leg of j.legs) {
                    const a = engine.st.get(leg.from);
                    const b = engine.st.get(leg.to);
                    if (a) pts.push([a.lng, a.lat]);
                    if (b) pts.push([b.lng, b.lat]);
                  }
                  fitBounds(pts);
                }
              }}
              onSimulateJourney={handleSimulateJourney}
              onShare={(date, sec) => {
                setRouteDate(date);
                setRouteSec(sec);
                if (routeFrom && routeTo && routeFrom !== routeTo) {
                  void handleShare({
                    route: { from: routeFrom, to: routeTo, date, sec },
                  });
                }
              }}
            />
          ) : (
            <StationsListPanel
              engine={engine}
              stationsExtra={stationsExtra}
              userLocation={userLocation}
              onOpenStation={openStation}
            />
          )}
        </div>

        {/* Quiet Attribution Footer (Desktop) */}
        <footer className="hidden md:flex items-center justify-between px-4 py-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 dark:text-slate-500 shrink-0">
          <span>Jadwal publik · Rel OpenStreetMap</span>
          <button
            type="button"
            onClick={() => setAboutOpen(true)}
            className="hover:text-slate-700 dark:hover:text-slate-300 font-medium"
          >
            Lisensi &amp; Info
          </button>
        </footer>
      </aside>

      {/* Desktop Drawer Collapse / Expand Handle */}
      <button
        type="button"
        onClick={() => setDrawerOpen((v) => !v)}
        aria-label={drawerOpen ? 'Sembunyikan panel samping' : 'Tampilkan panel samping'}
        className={`hidden md:flex fixed top-1/2 -translate-y-1/2 z-25 w-6 h-12 items-center justify-center bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 rounded-r-xl shadow-md text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all duration-200 ${
          drawerOpen ? 'left-[400px]' : 'left-0'
        }`}
      >
        {drawerOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>

      {/* Bottom Time Machine Dock (Desktop — shifts gracefully if JPL Legend is open) */}
      <div
        className={`hidden md:flex fixed bottom-3 right-16 z-20 pointer-events-none justify-center transition-all duration-200 ${
          drawerOpen
            ? layers.jpl
              ? 'left-[672px]'
              : 'left-[412px]'
            : layers.jpl
              ? 'left-[268px]'
              : 'left-3'
        }`}
      >
        <TimeMachineDock
          clock={uiClock}
          isLive={isLive}
          paused={paused}
          speed={speed}
          holidays={engine?.net.holidays || []}
          onTogglePause={() => setSimulationClock({ paused: !paused, isLive: false })}
          onSetSpeed={(sp) => setSimulationClock({ speed: sp, paused: false, isLive: false })}
          onScrubSec={(sec) => setSimulationClock({ sec, isLive: false })}
          onChangeDate={(date) => setSimulationClock({ date, isLive: false })}
          onResetLive={handleResetLive}
        />
      </div>

      {/* Toast Notification */}
      {toastMsg && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-24 md:top-20 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold shadow-lg max-w-[calc(100vw-32px)] text-center"
        >
          {toastMsg}
        </div>
      )}

      {/* Initial Loading Overlay */}
      {!engine && (
        <div
          role="status"
          className="fixed inset-0 z-50 bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6"
        >
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-lg flex flex-col items-center text-center gap-4">
            <img src="/icon.svg" alt="Logo Sepur Live" className="w-12 h-12 rounded-xl shadow-sm" />
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white">Sepur Live</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {bootError || 'Menyiapkan jaringan rel OpenStreetMap & jadwal GAPEKA Indonesia…'}
              </p>
            </div>
            {!bootError && (
              <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all duration-300"
                  style={{ width: `${bootProgress}%` }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* About & Licenses Modal */}
      {aboutOpen && <AboutModal onClose={() => setAboutOpen(false)} />}
    </div>
  );
}
