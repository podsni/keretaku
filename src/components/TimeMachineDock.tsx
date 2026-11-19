import { Calendar, Pause, Play, RotateCcw, X } from 'lucide-react';
import { SPEED_OPTIONS, TIME_PRESETS, dayLabel, formatClockFull } from '../engine/constants';
import type { ClockState } from '../engine/types';

interface TimeMachineDockProps {
  clock: ClockState;
  isLive: boolean;
  paused: boolean;
  speed: number;
  holidays: string[];
  compact?: boolean;
  onCloseCompact?: () => void;
  onTogglePause: () => void;
  onSetSpeed: (speed: number) => void;
  onScrubSec: (sec: number) => void;
  onChangeDate: (date: string) => void;
  onResetLive: () => void;
}

export function TimeMachineDock({
  clock,
  isLive,
  paused,
  speed,
  holidays,
  compact = false,
  onCloseCompact,
  onTogglePause,
  onSetSpeed,
  onScrubSec,
  onChangeDate,
  onResetLive,
}: TimeMachineDockProps) {
  const secInt = ((Math.floor(clock.sec) % 86400) + 86400) % 86400;

  return (
    <section
      aria-label="Mesin waktu simulasi kereta"
      className={`pointer-events-auto bg-white/97 dark:bg-slate-900/97 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl shadow-lg flex flex-col gap-2 w-full ${
        compact ? 'px-3 py-2.5 max-w-[calc(100vw-24px)]' : 'px-3.5 py-2.5 max-w-[660px]'
      }`}
    >
      {/* Row 1: Clock + Play/Pause + (Close on mobile) + Speed + Date + Live Reset */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className={`flex items-center justify-between gap-2 ${compact ? 'w-full' : ''}`}>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onTogglePause}
              aria-label={paused ? 'Lanjutkan simulasi' : 'Jeda simulasi'}
              className="w-9 h-9 md:w-8 md:h-8 rounded-xl flex items-center justify-center bg-slate-900 dark:bg-blue-600 text-white hover:bg-slate-800 dark:hover:bg-blue-500 transition-colors shrink-0 touch-manipulation"
            >
              {paused ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4" />}
            </button>

            <div className="flex flex-col md:flex-row md:items-baseline md:gap-2 leading-tight">
              <span
                data-testid={compact ? 'mobile-wib-clock' : 'live-wib-clock'}
                className="font-mono tabular-nums text-sm md:text-base font-bold text-slate-900 dark:text-slate-50 tracking-tight"
              >
                {formatClockFull(clock.sec)}
              </span>
              <span className="text-[11px] md:text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
                WIB · {dayLabel(clock.date, holidays)}
              </span>
            </div>
          </div>

          {compact && onCloseCompact && (
            <button
              type="button"
              onClick={onCloseCompact}
              aria-label="Tutup mesin waktu"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0 touch-manipulation"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className={`flex items-center gap-1.5 flex-wrap ${compact ? 'w-full justify-between' : ''}`}>
          {/* Speed multiplier segmented bar */}
          <div
            className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg overflow-x-auto no-scrollbar"
            role="group"
            aria-label="Kecepatan pemutaran"
          >
            {(compact ? [1, 10, 30, 60, 180] : SPEED_OPTIONS).map((sp) => (
              <button
                key={sp}
                type="button"
                onClick={() => onSetSpeed(sp)}
                aria-pressed={speed === sp}
                className={`px-2 py-1 text-[11px] font-mono tabular-nums font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 touch-manipulation ${
                  speed === sp
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {sp}×
              </button>
            ))}
          </div>

          {/* Date input */}
          <label className="relative flex items-center bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/70 dark:hover:bg-slate-700 rounded-lg px-2 py-1 text-xs text-slate-700 dark:text-slate-200 cursor-pointer transition-colors">
            <Calendar className="w-3.5 h-3.5 mr-1 text-slate-500 dark:text-slate-400 shrink-0" />
            <input
              type="date"
              aria-label="Tanggal jadwal"
              value={clock.date}
              onChange={(e) => e.target.value && onChangeDate(e.target.value)}
              className="bg-transparent font-mono tabular-nums text-[11px] focus:outline-none w-[92px] cursor-pointer"
            />
          </label>

          {/* Reset to live */}
          {(!isLive || paused || speed !== 1) && (
            <button
              type="button"
              onClick={onResetLive}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 touch-manipulation"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Langsung</span>
            </button>
          )}
        </div>
      </div>

      {/* Row 2: 24h Scrubber + Rush Hour Presets */}
      <div className="flex items-center gap-2.5">
        <span className="font-mono tabular-nums text-[10px] text-slate-400 dark:text-slate-500 shrink-0">00:00</span>
        <input
          type="range"
          min={0}
          max={86340}
          step={60}
          value={secInt}
          aria-label="Geser waktu sepanjang hari"
          onChange={(e) => onScrubSec(Number(e.target.value))}
          className="sepur-range flex-1"
        />
        <span className="font-mono tabular-nums text-[10px] text-slate-400 dark:text-slate-500 shrink-0">23:59</span>

        {!compact && (
          <div className="hidden sm:flex items-center gap-1 pl-2 border-l border-slate-200 dark:border-slate-800">
            {TIME_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                title={p.title}
                onClick={() => onScrubSec(p.sec)}
                className="px-2 py-0.5 text-[11px] font-mono tabular-nums font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors whitespace-nowrap shrink-0"
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Compact mobile rush-hour presets */}
      {compact && (
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pt-0.5">
          {TIME_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => onScrubSec(p.sec)}
              className="px-2.5 py-1 text-[11px] font-mono tabular-nums font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 whitespace-nowrap shrink-0 touch-manipulation"
            >
              {p.label} · {p.title}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
