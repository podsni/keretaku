import { useMemo } from 'react';
import { ArrowLeft, Camera, ExternalLink } from 'lucide-react';
import type { Engine } from '../engine/sched';
import { fmt } from '../engine/sched';
import { linesBetweenStations } from '../engine/analytics';
import {
  BARRIER,
  CONF,
  GSEP,
  JCAT,
  clampSpeedKmh,
  formatDistanceKm,
  formatWait,
  jplOsmUrl,
  jplParseRow,
  jplRoadLabel,
  jplTitleLabel,
  trainDisplayInfo,
} from '../engine/constants';
import type { ClockState, JplData } from '../engine/types';
import { ShareButton } from './ShareButton';

interface JplDetailPanelProps {
  engine: Engine;
  jplData: JplData;
  index: number;
  clock: ClockState;
  onBack: () => void;
  onShare: () => void;
  onOpenTrain: (id: string, date: string) => void;
  onOpenStation: (id: string) => void;
  onOpenLine?: (id: string) => void;
}

export function JplDetailPanel({
  engine,
  jplData,
  index,
  clock,
  onBack,
  onShare,
  onOpenTrain,
  onOpenStation,
  onOpenLine,
}: JplDetailPanelProps) {
  const item = useMemo(() => jplParseRow(jplData, index), [jplData, index]);
  const [catName, catColor] = JCAT[item.cat] || ['Perlintasan', '#64748b'];
  const isGradeSep = GSEP.has(item.cat);
  const [confLabel, confDesc] = CONF[item.conf] || CONF[1];

  const stA = engine.st.get(item.a);
  const stB = engine.st.get(item.b);
  const petakLines = useMemo(
    () => linesBetweenStations(engine, item.a, item.b),
    [engine, item.a, item.b],
  );

  const upcomingPasses = useMemo(() => {
    if (!item.a || !item.b) return [];
    return engine.passes(item.a, item.b, item.dA, clock, 4 * 3600, 8);
  }, [engine, item, clock.date, Math.floor(clock.sec / 30)]);

  const safetyItems: string[] = [];
  if (item.barrier && BARRIER[item.barrier]) safetyItems.push(BARRIER[item.barrier]);
  if (item.light) safetyItems.push('Lampu isyarat');
  else if (item.noLight) safetyItems.push('Tanpa lampu');
  if (item.bell) safetyItems.push('Bel/sirine');
  else if (item.noBell) safetyItems.push('Tanpa bel');
  if (item.sup) safetyItems.push('Dijaga petugas');

  const lat = item.p[1];
  const lng = item.p[0];
  const streetViewUrl = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;
  const mapillaryUrl = `https://www.mapillary.com/app/?lat=${lat}&lng=${lng}&z=17`;
  const commonsUrl = `https://commons.wikimedia.org/wiki/Special:Nearby#/coord/${lat},${lng}`;
  const osmUrl = jplOsmUrl(item.osm);

  const emblemGlyph =
    item.cat === 'under' ? '▼' : item.cat === 'fly' ? '▲' : item.cat === 'tutup' ? '–' : '×';

  return (
    <div className="flex flex-col">
      <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white min-h-[36px] pr-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali</span>
        </button>
        <div className="flex items-center gap-2">
          <span className="font-mono tabular-nums text-xs text-slate-400">
            {item.daop && item.daop !== '-' ? item.daop : 'Jawa'}
            {item.km ? ` · KM ${item.km}` : ''}
          </span>
          <ShareButton
            onClick={onShare}
            ariaLabel={`Bagikan tautan ${jplTitleLabel(item)}`}
            title="Salin tautan perlintasan ini"
          />
        </div>
      </div>

      {/* Header */}
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col gap-3">
        <div className="flex items-start gap-2.5">
          <span
            className="w-9 h-9 rounded-xl text-white font-bold text-sm flex items-center justify-center shrink-0 mt-0.5 shadow-xs"
            style={{ backgroundColor: catColor }}
            aria-hidden="true"
          >
            {emblemGlyph}
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
              {jplTitleLabel(item)}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
              {catName}
              {!isGradeSep && safetyItems.length ? ` · ${safetyItems.join(', ')}` : ''}
            </p>
          </div>
        </div>

        {/* Photo or External Links */}
        {item.ph ? (
          <figure className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
            <img
              src={item.ph[1]}
              alt={jplTitleLabel(item)}
              referrerPolicy="no-referrer"
              className="w-full h-36 object-cover"
            />
            <figcaption className="px-2.5 py-1.5 text-[11px] text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 flex justify-between gap-2">
              <span className="truncate">Foto: {item.ph[4]}</span>
              <a
                href={item.ph[7]}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline shrink-0"
              >
                {item.ph[5]}
              </a>
            </figcaption>
          </figure>
        ) : (
          <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-3 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
              <Camera className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
              <span>Belum ada foto terbuka · Lihat kondisi lapangan:</span>
            </div>
            <div className="flex flex-wrap items-center gap-3.5 text-xs font-semibold">
              <a
                href={mapillaryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 hover:underline"
              >
                <span>Mapillary</span>
              </a>
              <a
                href={streetViewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 hover:underline"
              >
                <span>Street View</span>
              </a>
              <a
                href={commonsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 hover:underline"
              >
                <span>Commons sekitar</span>
              </a>
            </div>
          </div>
        )}

        {/* Road Box */}
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 px-3 py-2">
          <div className="text-[10px] font-semibold text-slate-400">Jalan</div>
          <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
            {jplRoadLabel(item)}
          </div>
        </div>

        {/* 4-column Technical Metadata Grid */}
        <dl className="grid grid-cols-4 gap-1.5 text-xs">
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 px-2 py-2">
            <dt className="text-[10px] text-slate-400">Daop</dt>
            <dd className="font-bold text-slate-900 dark:text-white mt-0.5">
              {item.daop && item.daop !== '-' ? item.daop : '—'}
            </dd>
          </div>
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 px-2 py-2">
            <dt className="text-[10px] text-slate-400">KM</dt>
            <dd className="font-mono tabular-nums font-bold text-slate-900 dark:text-white mt-0.5 text-[11px]">
              {item.km ? (item.dInf ? `± ${item.km}` : item.km) : '—'}
            </dd>
          </div>
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 px-2 py-2">
            <dt className="text-[10px] text-slate-400">Jalur</dt>
            <dd className="font-mono tabular-nums font-bold text-slate-900 dark:text-white mt-0.5">
              {item.tracks ? `${item.tracks}` : '—'}
            </dd>
          </div>
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 px-2 py-2">
            <dt className="text-[10px] text-slate-400">No. JPL</dt>
            <dd className="font-semibold text-slate-700 dark:text-slate-200 mt-0.5 text-[10px] leading-tight">
              {item.ref || 'Belum terdata'}
            </dd>
          </div>
        </dl>

        {/* Between & Distance */}
        <div className="flex flex-col gap-1.5 text-xs pt-0.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-slate-500 dark:text-slate-400">Antara</span>
            <div className="font-semibold text-slate-900 dark:text-white text-right">
              {stA ? (
                <button
                  type="button"
                  onClick={() => onOpenStation(stA.id)}
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {stA.name}
                </button>
              ) : (
                <span>{item.a || '—'}</span>
              )}
              <span className="mx-1 text-slate-400">–</span>
              {stB ? (
                <button
                  type="button"
                  onClick={() => onOpenStation(stB.id)}
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {stB.name}
                </button>
              ) : (
                <span>{item.b || '—'}</span>
              )}
            </div>
          </div>

          {stA && Number.isFinite(item.dA) && item.dA > 0 && (
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-slate-500 dark:text-slate-400">Posisi</span>
              <span className="font-mono tabular-nums font-semibold text-slate-800 dark:text-slate-200">
                ± {formatDistanceKm(item.dA)} dari {stA.name}
              </span>
            </div>
          )}

          <div className="flex items-baseline justify-between gap-2">
            <span className="text-slate-500 dark:text-slate-400">Kelengkapan data</span>
            <span className="font-semibold text-emerald-700 dark:text-emerald-400 text-right">
              {confLabel} · {confDesc}
            </span>
          </div>
        </div>

        {/* Interactive Line Badges */}
        {petakLines.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {petakLines.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => onOpenLine?.(l.id)}
                title={l.name}
                className="px-2 py-0.5 rounded-md text-[11px] font-bold tracking-tight"
                style={{ backgroundColor: l.color, color: l.text || '#ffffff' }}
              >
                {l.short}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100 dark:border-slate-800">
          <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
            {lat.toFixed(5)}, {lng.toFixed(5)}
          </span>
          <a
            href={osmUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400 hover:underline"
          >
            <span>Lihat / perbaiki di OSM</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Live Upcoming Trains Passing this Crossing */}
      <div className="p-4 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-200">
            Perkiraan kereta melintas berikutnya
          </h3>
          <span className="text-[11px] text-slate-400">4 jam ke depan</span>
        </div>

        {upcomingPasses.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400 py-4 text-center">
            Tidak ada kereta terjadwal yang melintasi petak ini dalam 4 jam ke depan.
          </p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {upcomingPasses.map((p) => {
              const line = engine.lines.get(p.trip.line);
              const info = trainDisplayInfo(p.trip, line);
              const towardName = engine.st.get(p.toward)?.name || p.toward;
              const kmh = clampSpeedKmh(p.v, line);
              return (
                <button
                  key={`${p.trip.key}-${Math.round(p.at)}`}
                  type="button"
                  onClick={() => onOpenTrain(p.trip.id, p.trip.date)}
                  className="w-full py-2.5 flex items-center justify-between gap-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded px-1.5 -mx-1.5 transition-colors touch-manipulation"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-1.5 h-7 rounded-full shrink-0"
                      style={{ backgroundColor: line?.color || '#64748b' }}
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                        {info.name} {p.trip.freight ? '· KA barang' : ''}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        Arah {towardName} · ±{kmh} km/j
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono tabular-nums text-xs font-bold text-slate-900 dark:text-white">
                      {fmt(p.at)}
                    </div>
                    <div className="font-mono tabular-nums text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                      {formatWait(p.dt)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <p className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
          Nomor JPL resmi dan identitas penjaga tidak pernah dikarang bila tidak ada di OpenStreetMap. Waktu melintas dihitung dari jadwal publik, bukan sensor rel langsung.
        </p>
      </div>
    </div>
  );
}
