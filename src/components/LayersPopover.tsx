import { Globe, Map as MapIcon, Moon, Satellite, X } from 'lucide-react';
import { BASEMAP_OPTIONS, FCAT, JCAT, SYS_COLOR, SYS_LABEL } from '../engine/constants';
import type {
  FreightCategory,
  JplData,
  JplFilter,
  LayerState,
  MapBasemapId,
  SystemId,
} from '../engine/types';

interface LayersPopoverProps {
  basemap: MapBasemapId;
  layers: LayerState;
  freightCats: FreightCategory[];
  jplData: JplData | null;
  jplLoading: boolean;
  jplFilter: JplFilter;
  onSelectBasemap: (id: MapBasemapId) => void;
  onToggleLayer: (key: keyof LayerState) => void;
  onToggleFreightCat: (cat: FreightCategory) => void;
  onUpdateJplFilter: (next: JplFilter) => void;
  onClose: () => void;
}

const SYSTEM_ORDER: SystemId[] = [
  'krl',
  'mrt',
  'lrtj',
  'jbdb',
  'bandara',
  'whoosh',
  'regional',
  'kai',
  'barang',
];

const BASEMAP_ICON: Record<MapBasemapId, typeof MapIcon> = {
  light: MapIcon,
  satellite: Satellite,
  hybrid: Globe,
  dark: Moon,
};

const BASEMAP_SWATCH: Record<MapBasemapId, string> = {
  light: 'bg-slate-100 border-slate-300 text-slate-700',
  satellite: 'bg-emerald-950 border-emerald-700 text-emerald-300',
  hybrid: 'bg-teal-950 border-teal-700 text-teal-200',
  dark: 'bg-slate-900 border-slate-700 text-slate-200',
};

export function LayersPopover({
  basemap,
  layers,
  freightCats,
  jplData,
  jplLoading,
  jplFilter,
  onSelectBasemap,
  onToggleLayer,
  onToggleFreightCat,
  onUpdateJplFilter,
  onClose,
}: LayersPopoverProps) {
  const jplCats = jplData ? Object.keys(JCAT).filter((k) => (jplData.stats[k] ?? 0) > 0) : [];
  const daops = jplData
    ? Object.keys(jplData.daop)
        .filter((k) => k !== '-')
        .sort((a, b) => {
          const na = parseInt(a.replace(/\D/g, ''), 10) || 0;
          const nb = parseInt(b.replace(/\D/g, ''), 10) || 0;
          return na - nb;
        })
    : [];

  const toggleJplCat = (cat: string) => {
    if (!jplData) return;
    const all = jplCats;
    let cur = jplFilter.cats.length ? [...jplFilter.cats] : [...all];
    if (!jplFilter.cats.length) cur = [cat];
    else cur = cur.includes(cat) ? cur.filter((x) => x !== cat) : [...cur, cat];
    onUpdateJplFilter({ ...jplFilter, cats: cur.length === all.length ? [] : cur });
  };

  return (
    <div
      role="dialog"
      aria-label="Pengaturan mode peta dan lapisan"
      className="pointer-events-auto w-[340px] max-w-[calc(100vw-24px)] max-h-[76vh] overflow-y-auto sepur-scroll bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-4 flex flex-col gap-4"
    >
      <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-50">Mode Peta &amp; Lapisan</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Pilih gaya peta, jaringan rel, dan JPL</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup pengaturan lapisan"
          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Basemap Switcher (Light / Satellite / Hybrid / Dark) */}
      <div>
        <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">Gaya Peta</h3>
        <div className="grid grid-cols-2 gap-1.5">
          {BASEMAP_OPTIONS.map((opt) => {
            const Icon = BASEMAP_ICON[opt.id];
            const active = basemap === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onSelectBasemap(opt.id)}
                aria-pressed={active}
                data-testid={`basemap-${opt.id}`}
                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl border text-left transition-colors ${
                  active
                    ? 'border-blue-600 bg-blue-50/80 dark:bg-blue-950/50 text-slate-900 dark:text-white shadow-2xs'
                    : 'border-slate-200/80 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/30 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span
                  className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${BASEMAP_SWATCH[opt.id]}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold truncate">{opt.label}</span>
                  <span className="block text-[10px] text-slate-500 dark:text-slate-400 truncate">
                    {opt.desc}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Systems */}
      <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
        <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">Sistem Kereta</h3>
        <div className="grid grid-cols-2 gap-1.5">
          {SYSTEM_ORDER.map((sys) => {
            const active = layers[sys];
            return (
              <button
                key={sys}
                type="button"
                onClick={() => onToggleLayer(sys)}
                aria-pressed={active}
                className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-left text-xs font-medium transition-colors ${
                  active
                    ? 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white'
                    : 'border-transparent bg-transparent text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: active ? SYS_COLOR[sys] : '#94a3b8' }}
                />
                <span className="truncate">{SYS_LABEL[sys]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Freight Categories */}
      {layers.barang && (
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
          <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">Kategori KA Barang</h3>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(FCAT) as FreightCategory[]).map((cat) => {
              const [label, , color] = FCAT[cat];
              const on = freightCats.includes(cat);
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => onToggleFreightCat(cat)}
                  aria-pressed={on}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-colors ${
                    on
                      ? 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white'
                      : 'border-slate-200/60 dark:border-slate-800 text-slate-400 dark:text-slate-500'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: on ? color : '#94a3b8' }} />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Map Overlays */}
      <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
        <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">Infrastruktur &amp; Elemen Peta</h3>
        <div className="grid grid-cols-2 gap-1.5">
          {(
            [
              ['jpl', 'Perlintasan (JPL)'],
              ['terminals', 'Terminal & Depo BBM'],
              ['stations', 'Titik Stasiun'],
              ['net', 'Rel OpenStreetMap'],
              ['labels', 'Label Kereta & Stasiun'],
            ] as [keyof LayerState, string][]
          ).map(([key, label]) => {
            const on = layers[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => onToggleLayer(key)}
                aria-pressed={on}
                className={`px-2.5 py-2 rounded-lg border text-left text-xs font-medium transition-colors ${
                  on
                    ? 'border-blue-600/40 bg-blue-50/70 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200'
                    : 'border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* JPL Filters when enabled */}
      {layers.jpl && (
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
              Filter Perlintasan Sebidang (JPL)
            </h3>
            {(jplFilter.cats.length > 0 || jplFilter.daop !== '') && (
              <button
                type="button"
                onClick={() => onUpdateJplFilter({ cats: [], daop: '' })}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                Reset
              </button>
            )}
          </div>

          {jplLoading && !jplData ? (
            <p className="text-xs text-slate-500">Memuat 4.700 titik perlintasan…</p>
          ) : (
            jplData && (
              <>
                <div className="flex flex-col gap-1">
                  {jplCats.map((k) => {
                    const [name, color] = JCAT[k];
                    const on = !jplFilter.cats.length || jplFilter.cats.includes(k);
                    const count = jplFilter.daop
                      ? jplData.daop[jplFilter.daop]?.[k] || 0
                      : jplData.stats[k] || 0;
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => toggleJplCat(k)}
                        aria-pressed={on}
                        className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${
                          on
                            ? 'bg-slate-100/80 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium'
                            : 'text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: color, opacity: on ? 1 : 0.3 }}
                          />
                          <span className="truncate">{name}</span>
                        </span>
                        <span className="font-mono tabular-nums text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
                          {count.toLocaleString('id-ID')}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                    Filter Wilayah Daop
                  </label>
                  <select
                    aria-label="Filter Daop perlintasan"
                    value={jplFilter.daop}
                    onChange={(e) => onUpdateJplFilter({ ...jplFilter, daop: e.target.value })}
                    className="w-full px-2.5 py-2 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                  >
                    <option value="">Semua Daop ({jplData.x.length.toLocaleString('id-ID')} titik)</option>
                    {daops.map((d) => (
                      <option key={d} value={d}>
                        {d} ({(jplData.daop[d]?.all ?? 0).toLocaleString('id-ID')} titik)
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )
          )}
        </div>
      )}
    </div>
  );
}
