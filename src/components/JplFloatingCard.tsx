import { useMemo } from 'react';
import { Camera, ExternalLink, X } from 'lucide-react';
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

interface JplFloatingCardProps {
  engine: Engine;
  jplData: JplData;
  index: number;
  clock: ClockState;
  onClose: () => void;
  onShare: () => void;
  onOpenTrain: (id: string, date: string) => void;
  onOpenStation: (id: string) => void;
  onOpenLine: (id: string) => void;
}

export function JplFloatingCard({
  engine,
  jplData,
  index,
  clock,
  onClose,
  onShare,
  onOpenTrain,
  onOpenStation,
  onOpenLine,
}: JplFloatingCardProps) {
  const item = useMemo(() => jplParseRow(jplData, index), [jplData, index]);
  const [catName, catColor] = JCAT[item.cat] || ['Perlintasan sebidang', '#64748b'];
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
    return engine.passes(item.a, item.b, item.dA, clock, 4 * 3600, 5);
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

  const subtitleDesc = isGradeSep
    ? `${catName} · bukan perlintasan sebidang · terdeteksi dari geometri OSM`
    : `${catName}${safetyItems.length ? ` · ${safetyItems.join(', ')}` : ''}`;

  return (
    <article
      aria-label={`Detail ${jplTitleLabel(item)}`}
      className="pointer-events-auto w-[340px] max-w-[calc(100vw-24px)] max-h-[78vh] overflow-y-auto sepur-scroll bg-white/98 dark:bg-slate-900/98 backdrop-blur-md border border-slate-200 dark:border-slate-700/80 rounded-2xl shadow-2xl p-4 flex flex-col gap-3 select-text"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex items-start gap-2.5 min-w-0">
          <span
            className="w-8 h-8 rounded-xl text-white font-bold text-sm flex items-center justify-center shrink-0 mt-0.5 shadow-xs"
            style={{ backgroundColor: catColor }}
            aria-hidden="true"
          >
            {emblemGlyph}
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
              {jplTitleLabel(item)}
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug mt-0.5">
              {subtitleDesc}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <ShareButton
            onClick={onShare}
            iconOnly
            ariaLabel={`Bagikan tautan ${jplTitleLabel(item)}`}
            title="Salin tautan perlintasan ini"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup kartu perlintasan"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Photo or Field View Links */}
      {item.ph ? (
        <figure className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800">
          <img
            src={item.ph[1]}
            alt={jplTitleLabel(item)}
            referrerPolicy="no-referrer"
            className="w-full h-32 object-cover"
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
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 px-3 py-2.5 flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300">
            <Camera className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
            <span className="font-semibold text-slate-800 dark:text-slate-100">Belum ada foto</span>
            <span className="text-slate-400">·</span>
            <span className="truncate">Lihat kondisi lapangan:</span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
            <a
              href={mapillaryUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-rose-600 dark:text-rose-400 hover:underline"
            >
              Mapillary
            </a>
            <a
              href={streetViewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-rose-600 dark:text-rose-400 hover:underline"
            >
              Street View
            </a>
            <a
              href={commonsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-rose-600 dark:text-rose-400 hover:underline"
            >
              Commons sekitar
            </a>
          </div>
        </div>
      )}

      {/* Road Name */}
      <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2">
        <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 tracking-wide">
          Jalan
        </div>
        <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5 leading-snug">
          {jplRoadLabel(item)}
        </div>
      </div>

      {/* 4-column Telemetry Grid: Daop, KM, Jalur Rel, Nomor JPL */}
      <dl className="grid grid-cols-4 gap-1.5 text-xs">
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 px-2 py-2">
          <dt className="text-[10px] font-medium text-slate-400">Daop</dt>
          <dd className="font-bold text-slate-900 dark:text-white mt-0.5 leading-tight">
            {item.daop && item.daop !== '-' ? item.daop : '—'}
          </dd>
        </div>
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 px-2 py-2">
          <dt className="text-[10px] font-medium text-slate-400">KM</dt>
          <dd className="font-mono tabular-nums font-bold text-slate-900 dark:text-white mt-0.5 leading-tight text-[11px]">
            {item.km ? (
              <>
                {item.dInf ? `± ${item.km}` : item.km}
                {item.dInf && (
                  <span className="block text-[9px] font-sans font-normal text-slate-400">
                    perkiraan
                  </span>
                )}
              </>
            ) : (
              '—'
            )}
          </dd>
        </div>
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 px-2 py-2">
          <dt className="text-[10px] font-medium text-slate-400">Jalur rel</dt>
          <dd className="font-mono tabular-nums font-bold text-slate-900 dark:text-white mt-0.5 leading-tight">
            {item.tracks ? `${item.tracks}` : '—'}
          </dd>
        </div>
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 px-2 py-2">
          <dt className="text-[10px] font-medium text-slate-400">No. JPL</dt>
          <dd className="font-semibold text-slate-700 dark:text-slate-200 mt-0.5 leading-tight text-[10px]">
            {item.ref || 'Belum terdata'}
          </dd>
        </div>
      </dl>

      {/* Between Stations & Position */}
      <div className="flex flex-col gap-1.5 text-xs pt-0.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-slate-500 dark:text-slate-400 shrink-0">Antara</span>
          <div className="font-semibold text-slate-900 dark:text-white text-right">
            {stA ? (
              <button
                type="button"
                onClick={() => onOpenStation(stA.id)}
                className="hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
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
                className="hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
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
            <span className="text-slate-500 dark:text-slate-400 shrink-0">Posisi</span>
            <span className="font-mono tabular-nums font-semibold text-slate-800 dark:text-slate-200">
              ± {formatDistanceKm(item.dA)} dari {stA.name}
            </span>
          </div>
        )}
      </div>

      {/* Interactive Line Badges */}
      {petakLines.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {petakLines.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => onOpenLine(l.id)}
              title={l.name}
              className="px-2 py-0.5 rounded-md text-[11px] font-bold tracking-tight transition-opacity hover:opacity-85"
              style={{ backgroundColor: l.color, color: l.text || '#ffffff' }}
            >
              {l.short}
            </button>
          ))}
        </div>
      )}

      {/* Data completeness */}
      <div className="flex items-baseline justify-between gap-3 text-[11px] pt-1 border-t border-slate-100 dark:border-slate-800">
        <span className="text-slate-500 dark:text-slate-400 shrink-0">Kelengkapan data</span>
        <span className="text-right font-semibold text-emerald-700 dark:text-emerald-400 leading-snug">
          {confLabel} · {confDesc}
        </span>
      </div>

      {/* Upcoming Passing Trains (compact) */}
      {upcomingPasses.length > 0 && (
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              Kereta melintas berikutnya
            </span>
            <span className="text-slate-400">4 jam ke depan</span>
          </div>
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
                  className="w-full py-1.5 flex items-center justify-between gap-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded px-1 -mx-1 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-1.5 h-6 rounded-full shrink-0"
                      style={{ backgroundColor: line?.color || '#64748b' }}
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                        {info.name}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                        Arah {towardName} · ±{kmh} km/j
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0 font-mono tabular-nums">
                    <div className="text-xs font-bold text-slate-900 dark:text-white">{fmt(p.at)}</div>
                    <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                      {formatWait(p.dt)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer: Source + Coordinates + Edit in OSM */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-1.5">
        <div className="text-[10px] text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/60 rounded-lg px-2 py-1">
          Sumber: OpenStreetMap (ODbL) · KM dari km stasiun Wikipedia
        </div>
        <div className="flex items-center justify-between gap-2 text-[11px]">
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
    </article>
  );
}
