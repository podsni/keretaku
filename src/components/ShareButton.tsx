import { useEffect, useRef, useState } from 'react';
import { Check, Share2 } from 'lucide-react';

interface ShareButtonProps {
  onClick: () => void;
  label?: string;
  copiedLabel?: string;
  ariaLabel?: string;
  title?: string;
  iconOnly?: boolean;
  className?: string;
}

export function ShareButton({
  onClick,
  label = 'Bagikan',
  copiedLabel = 'Tersalin',
  ariaLabel = 'Salin tautan tampilan ini',
  title = 'Salin tautan',
  iconOnly = false,
  className = '',
}: ShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  const handleClick = () => {
    onClick();
    setCopied(true);
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setCopied(false), 2000);
  };

  if (iconOnly) {
    return (
      <button
        type="button"
        onClick={handleClick}
        aria-label={ariaLabel}
        title={copied ? copiedLabel : title}
        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors shrink-0 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
          copied
            ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
        } ${className}`}
      >
        {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={ariaLabel}
      title={copied ? copiedLabel : title}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 min-h-[36px] rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
        copied
          ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300'
          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
      } ${className}`}
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
      <span>{copied ? copiedLabel : label}</span>
    </button>
  );
}
