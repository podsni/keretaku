import { X } from 'lucide-react';

interface AboutModalProps {
  onClose: () => void;
}

export function AboutModal({ onClose }: AboutModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label="Tentang Sepur Live"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-xl max-h-[85vh] overflow-y-auto sepur-scroll bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 flex flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Tentang Sepur Live</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Peta langsung pergerakan kereta api di Pulau Jawa berdasarkan jadwal publik &amp; rel OpenStreetMap.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup jendela tentang"
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed space-y-2">
          <p>
            Posisi setiap kereta dihitung secara matematis di browser menggunakan profil kecepatan trapesium (percepatan, kecepatan jelajah, dan pengereman per jenis sarana) mengikuti geometri rel asli OpenStreetMap. Aplikasi ini <strong>tidak menggunakan pelacak GPS</strong> sehingga keterlambatan real-time tidak ditampilkan.
          </p>
        </div>

        {/* Data Coverage Table */}
        <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300">
              <tr>
                <th className="px-3 py-2 font-semibold">Sistem</th>
                <th className="px-3 py-2 font-semibold">Sumber Data</th>
                <th className="px-3 py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              <tr>
                <td className="px-3 py-2 font-medium">KRL Commuter Line</td>
                <td className="px-3 py-2">Open-KRL (CC BY 4.0)</td>
                <td className="px-3 py-2">Jadwal resmi (6 lin, 1.143 KA)</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-medium">KA Antarkota, Lokal, Bandara</td>
                <td className="px-3 py-2">GAPEKA 2026 Jawa</td>
                <td className="px-3 py-2">Jadwal resmi (107 layanan)</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-medium">KA Barang</td>
                <td className="px-3 py-2">GAPEKA 2026 Jawa</td>
                <td className="px-3 py-2">114 perjalanan (muatan tidak tercantum)</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-medium">MRT, LRTJ, LRT Jabodebek</td>
                <td className="px-3 py-2">ShioriLabs (ODbL)</td>
                <td className="px-3 py-2">Jadwal publik (MRT akhir pekan perkiraan)</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-medium">Whoosh (KCIC)</td>
                <td className="px-3 py-2">Pola frekuensi operator</td>
                <td className="px-3 py-2">Perkiraan</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-medium">Rel, Stasiun &amp; 4.700 JPL</td>
                <td className="px-3 py-2">OpenStreetMap (ODbL) &amp; Commons</td>
                <td className="px-3 py-2">488/494 petak rel asli · 448 foto stasiun</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed border-t border-slate-100 dark:border-slate-800 pt-3">
          Berbasis proyek sumber terbuka <strong className="text-slate-700 dark:text-slate-200">sepur-live</strong> (MIT © 2026 Hendra Bangun Dwi R). Data peta © kontributor OpenStreetMap (ODbL), foto dari Wikimedia Commons sesuai lisensi masing-masing. Tidak berafiliasi dengan PT KAI, KAI Commuter, MRT Jakarta, LRT Jakarta, KCIC, maupun InJourney.
        </p>
      </div>
    </div>
  );
}
