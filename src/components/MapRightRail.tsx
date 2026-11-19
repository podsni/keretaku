import { memo } from 'react';
import {
  Check,
  Info,
  Layers,
  Loader2,
  LocateFixed,
  Minus,
  Moon,
  Mountain,
  Plus,
  Satellite,
  Share2,
  Sun,
  TriangleAlert,
} from 'lucide-react';
import type { MapBasemapId } from '../engine/types';

interface MapRightRailProps {
  jplEnabled: boolean;
  threeD: boolean;
  underground: boolean;
  theme: 'light' | 'dark';
  basemap: MapBasemapId;
  locating?: boolean;
  hasUserLocation?: boolean;
  layersOpen: boolean;
  justShared?: boolean;
  onToggleJpl: () => void;
  onToggle3D: () => void;
  onToggleSatellite: () => void;
  onToggleUnderground: () => void;
  onToggleTheme: () => void;
  onToggleLayers: () => void;
  onLocateMe: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onShare: () => void;
  onOpenAbout: () => void;
}

export const MapRightRail = memo(function MapRightRail({
  jplEnabled,
  threeD,
  underground,
  theme,
  basemap,
  locating = false,
  hasUserLocation = false,
  layersOpen,
  justShared = false,
  onToggleJpl,
  onToggle3D,
  onToggleSatellite,
  onToggleUnderground,
  onToggleTheme,
  onToggleLayers,
  onLocateMe,
  onZoomIn,
  onZoomOut,
  onShare,
  onOpenAbout,
}: MapRightRailProps) {
  const isSat = basemap === 'satellite' || basemap === 'hybrid';
  const btnBase =
    'w-10 h-10 md:w-9 md:h-9 flex items-center justify-center rounded-xl transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500';
  const btnIdle =
    'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 active:bg-slate-200 dark:active:bg-slate-700';

  return (
    <div
      aria-label="Kontrol peta"
      className="pointer-events-auto flex flex-col items-center gap-2"
    >
      {/* Primary Map Mode & Layer Stack */}
      <div className="flex flex-col items-center gap-0.5 p-1 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-md">
        <button
          type="button"
          onClick={onToggle3D}
          aria-pressed={threeD}
          aria-label="Mode peta 3D"
          title="Kereta & bangunan 3D"
          className={`${btnBase} text-xs font-extrabold tracking-tight ${
            threeD ? 'bg-slate-900 dark:bg-blue-600 text-white' : btnIdle
          }`}
        >
          3D
        </button>

        <button
          type="button"
          onClick={onToggleSatellite}
          aria-pressed={isSat}
          aria-label={isSat ? 'Kembali ke peta vektor' : 'Aktifkan mode peta satelit'}
          title={isSat ? 'Mode Satelit aktif (klik untuk peta vektor)' : 'Ganti ke mode Satelit'}
          className={`${btnBase} ${
            isSat ? 'bg-emerald-600 text-white shadow-xs' : btnIdle
          }`}
        >
          <Satellite className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onToggleUnderground}
          aria-pressed={underground}
          aria-label="Tampilkan jalur terowongan bawah tanah"
          title="Terowongan & jalur bawah tanah"
          className={`${btnBase} ${
            underground ? 'bg-slate-900 dark:bg-blue-600 text-white' : btnIdle
          }`}
        >
          <Mountain className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onToggleJpl}
          aria-pressed={jplEnabled}
          aria-label="Tampilkan perlintasan sebidang JPL"
          title="4.700+ Perlintasan sebidang (JPL) & flyover"
          className={`${btnBase} ${
            jplEnabled ? 'bg-amber-500 text-slate-950 shadow-xs' : btnIdle
          }`}
        >
          <TriangleAlert className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onToggleLayers}
          aria-pressed={layersOpen}
          aria-label="Pengaturan mode peta dan lapisan"
          title="Mode peta (Terang/Satelit/Hibrida/Gelap) & filter lapisan"
          className={`${btnBase} ${
            layersOpen ? 'bg-slate-900 dark:bg-blue-600 text-white' : btnIdle
          }`}
        >
          <Layers className="w-4 h-4" />
        </button>

        <div className="w-6 h-px bg-slate-200 dark:bg-slate-800 my-0.5" aria-hidden="true" />

        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={theme === 'dark' ? 'Beralih ke tema terang' : 'Beralih ke tema gelap'}
          title={theme === 'dark' ? 'Tema terang' : 'Tema gelap'}
          className={`${btnBase} ${btnIdle}`}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <button
          type="button"
          onClick={onLocateMe}
          disabled={locating}
          aria-label="Deteksi dan pusatkan ke lokasiku"
          title={hasUserLocation ? 'Perbarui lokasiku saat ini' : 'Deteksi lokasiku'}
          className={`${btnBase} ${
            hasUserLocation
              ? 'bg-blue-600 text-white shadow-xs'
              : btnIdle
          } disabled:opacity-70`}
        >
          {locating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <LocateFixed className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Zoom Controls Stack */}
      <div className="flex flex-col items-center p-1 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-md">
        <button
          type="button"
          onClick={onZoomIn}
          aria-label="Perbesar peta"
          title="Perbesar peta"
          className={`${btnBase} ${btnIdle}`}
        >
          <Plus className="w-4 h-4" />
        </button>
        <div className="w-6 h-px bg-slate-200 dark:bg-slate-800" aria-hidden="true" />
        <button
          type="button"
          onClick={onZoomOut}
          aria-label="Perkecil peta"
          title="Perkecil peta"
          className={`${btnBase} ${btnIdle}`}
        >
          <Minus className="w-4 h-4" />
        </button>
      </div>

      {/* Share Active View Trigger */}
      <button
        type="button"
        onClick={onShare}
        aria-label="Bagikan tautan tampilan saat ini"
        title={justShared ? 'Tautan tersalin' : 'Bagikan tautan tampilan saat ini'}
        className={`w-10 h-10 md:w-9 md:h-9 flex items-center justify-center rounded-full backdrop-blur-md border shadow-md transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
          justShared
            ? 'bg-emerald-600 border-emerald-600 text-white'
            : `bg-white/95 dark:bg-slate-900/95 border-slate-200/90 dark:border-slate-800 ${btnIdle}`
        }`}
      >
        {justShared ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
      </button>

      {/* Info Trigger */}
      <button
        type="button"
        onClick={onOpenAbout}
        aria-label="Tentang Sepur Live dan sumber data"
        title="Tentang & Sumber Data"
        className={`w-10 h-10 md:w-9 md:h-9 flex items-center justify-center rounded-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/90 dark:border-slate-800 shadow-md ${btnIdle}`}
      >
        <Info className="w-4 h-4" />
      </button>
    </div>
  );
});
