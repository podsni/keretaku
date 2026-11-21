# Sepur Live — Peta Kereta Api Indonesia

[Sepur Live](https://keretaku-app.vercel.app) adalah aplikasi web untuk menelusuri jaringan kereta api di Pulau Jawa. Posisi kereta dihitung di peramban dari jadwal publik — GAPEKA 2026 dan jadwal komuter — mengikuti geometri rel [OpenStreetMap](https://www.openstreetmap.org/copyright). Peta memakai MapLibre GL, dengan mode rangkaian 3D Three.js, cuaca stasiun dari Open-Meteo, dan peta 4.700 perlintasan sebidang (JPL).

**Demo langsung:** [keretaku-app.vercel.app](https://keretaku-app.vercel.app)

Aplikasi ini responsif untuk desktop dan ponsel. Kamu bisa memantau pergerakan kereta, merencanakan perjalanan antarmoda, memeriksa aksesibilitas kursi roda, melihat cuaca stasiun, dan menelusuri perlintasan sebidang.

> Sepur Live adalah proyek visualisasi data terbuka yang independen. Proyek ini tidak berafiliasi secara resmi dengan PT Kereta Api Indonesia (Persero), KAI Commuter, MRT Jakarta, LRT, KCIC, maupun InJourney.

---

## Fitur utama

### Peta langsung dan mode 3D

**Pelacakan posisi dari jadwal dan Live GPS.** Aplikasi mensimulasikan pergerakan layanan rel di Pulau Jawa:

- KRL Commuter Line (Jabodetabek, Merak, Bandung Raya, Yogyakarta–Palur, dan komuter di wilayah Surabaya)
- MRT Jakarta
- LRT Jakarta dan LRT Jabodebek
- KA Bandara (Soetta, YIA, BIAS) dan Skytrain Kalayang Soetta
- Kereta Cepat Whoosh (KCIC) beserta KA Feeder Padalarang–Bandung
- KA antarkota KAI
- KA barang (parcel, kargo, ketel, service, dan angkutan khusus)

Posisi di peta dihitung dengan profil kecepatan trapesium (percepatan, jelajah, dan pengereman) di sepanjang rel OpenStreetMap. Ini bukan telemetri GPS internal operator. Jika kamu mengaktifkan **Live GPS**, posisi perangkatmu diselaraskan ke jalur rel, lalu dibandingkan dengan jadwal (sesuai jadwal, lebih awal, atau terlambat dari GAPEKA).

**Mode 3D rangkaian kereta (Three.js + lapisan kustom MapLibre):**

- Model 3D artikulasi mengikuti tikungan rel: lokomotif CC 206 dan CC 201, KRL, MRT, LRT, Whoosh CR400AF, plus aksen Kereta Panoramic (atap kaca) dan Suite Class Compartment.
- Pencahayaan otomatis mengikuti waktu simulasi di zona `Asia/Jakarta` (WIB): fajar, siang, senja, dan malam, termasuk sorot lampu depan dan pendar jendela di malam hari.
- Preset kamera: Otomatis, Kejar, Samping, Tepi rel, Atas, dan Bebas.

**Gaya peta:**

- Terang — OpenFreeMap (gaya Positron)
- Gelap — Carto Dark Matter
- Satelit — Esri World Imagery
- Hibrida — satelit plus label jalan

Kamu juga bisa menampilkan lapisan terowongan (105 ruas), perlintasan sebidang (JPL), serta terminal dan depo BBM. Ada pintasan wilayah: Jabodetabek, Bandung dan Whoosh, Cirebon–Semarang, Yogyakarta–Solo, Surabaya–Malang, Jember–Banyuwangi, dan seluruh jalur. Tema antarmuka terang atau gelap tersimpan di peramban.

### Detail stasiun

**Cuaca stasiun (Open-Meteo).** Dari koordinat stasiun, zona waktu `Asia/Jakarta`, aplikasi menampilkan:

- suhu udara (°C) dan suhu terasa
- kelembapan (%)
- kecepatan dan arah angin (km/j)
- curah hujan (mm)
- prakiraan 3 jam ke depan beserta peluang hujan (%)
- tips persiapan perjalanan, misalnya saran payung atau hidrasi

Ada cache 10 menit per stasiun, pembatalan permintaan saat kamu pindah stasiun, dan tombol Muat ulang cuaca. Open-Meteo tidak memerlukan kunci API.

**Aksesibilitas kursi roda.** Filter Ketersediaan Kursi Roda ada di papan langsung, jadwal sehari, dan papan layar LED (FIDS). Filter ini menampilkan perjalanan penumpang yang ramah kursi roda (kereta barang disembunyikan) beserta label akses per kereta, misalnya Peron Rata atau Kursi roda tersedia (KAI).

Kartu Aksesibilitas dan Kursi Roda merinci tingkat akses stasiun dan fasilitas (kursi roda, jalur landai, lift atau eskalator, toilet disabilitas, guiding block), plus panduan bantuan naik kereta melalui Contact Center KAI 121.

**Papan layar stasiun (FIDS).** Layar penuh bergaya papan informasi keberangkatan LED, sinkron dengan filter kursi roda.

**Hub transit antarmoda.** Panduan perpindahan moda di simpul besar: Manggarai, Sudirman, BNI City, Tanah Abang, Gambir, Bandung, Padalarang, Halim, Yogyakarta, Solo Balapan, dan Surabaya Gubeng, termasuk pintasan stasiun terhubung.

**Informasi stasiun dan foto.** Kode stasiun, Daop, penanda kilometer (KM), dan foto Wikimedia Commons beserta atribusi lisensi. Jaringan memuat 483 stasiun; 448 di antaranya punya foto.

### Detail kereta, ETA, dan analisis

- Estimasi tiba (ETA) dan hitung mundur ke stasiun berikutnya, menyesuaikan kecepatan simulasi Mesin waktu (1× sampai 300×).
- Deteksi persilangan dan penyusulan di lintas yang sama, lengkap dengan waktu pertemuan serta tautan ke kereta dan stasiun terkait.
- Kelas layanan, stamformasi, dan estimasi rentang tarif, termasuk Kereta Panoramic, Suite Class Compartment, dan Stainless Steel New Generation, plus grafik profil kecepatan.

### Grafik GAPEKA (diagram Marey)

Di setiap detail jalur, tab Tabel jadwal dan Grafik GAPEKA memvisualisasikan perjalanan pergi dan balik pada sumbu ruang–waktu (stasiun vs jam). Ada garis penanda waktu berjalan (Sekarang), tooltip, dan klik garis untuk membuka detail kereta.

### Perencana rute dan pencarian

- Connection Scan Algorithm (CSA) mencari rute multi-moda (KRL, MRT, LRT, KA Bandara, Whoosh, KA antarkota) dengan tag Tercepat, Hemat, atau Minim Transit, plus estimasi biaya.
- Pencarian terpadu mencakup stasiun, jalur, kereta aktif, dan JPL. Alias populer didukung, misalnya `jogja`, `tugu`, `yia`, `soetta`, `cgk`, `pasarturi`, `gubeng`, `whoosh`, `kcic`, `prameks`, `bias`, dan `dukuh atas`.

### Radar lokasi dan perlintasan sebidang (JPL)

**Radar kereta terdekat** memakai lokasi perangkat untuk menampilkan stasiun terdekat dan kereta aktif di sekitar, lengkap dengan arah (mendekat atau menjauh) dan kompas.

**Peta 4.700 perlintasan sebidang (JPL)** mengklasifikasikan tingkat pengamanan: dijaga petugas, berpalang, lampu atau bel, tanpa palang, pejalan kaki, ditutup, liar, flyover, dan underpass. Radar JPL terdekat di Beranda menampilkan perlintasan aktif terdekat dengan status Palang segera tutup, Kereta mendekat, atau Aman sementara. Foto Wikimedia yang bergeotag ditampilkan jika ada. Tautan Mapillary dan Google Street View hanya ditautkan, tidak disematkan.

Kamu juga bisa menyimpan stasiun favorit di Beranda.

### Mesin waktu dan tautan berbagi

Putar, jeda, ubah tanggal (hari kerja, akhir pekan, atau libur nasional 2026), percepat simulasi (1×, 10×, 30×, 60×, 180×, 300×), atau lompat ke jam sibuk (06:30, 08:00, 12:00, 17:30, 21:30).

Tombol Bagikan tautan membuat URL *deep-link* yang membuka kereta, stasiun, jalur, rute, perlintasan JPL, filter sistem, waktu simulasi, atau posisi kamera peta tertentu.

---

## Teknologi yang digunakan

| Kategori | Teknologi |
| :--- | :--- |
| Antarmuka | React 19, TypeScript, Vite 8 |
| Tampilan dan ikon | Tailwind CSS v4, Lucide React, Motion |
| Tipografi | Plus Jakarta Sans, JetBrains Mono |
| Peta dan visualisasi 3D | MapLibre GL JS, Three.js |
| API eksternal | Open-Meteo Forecast API (cuaca stasiun, tanpa kunci API), Esri World Imagery (satelit), OpenFreeMap (ubin vektor dan glif), Carto Dark Matter (peta gelap) |
| Pengujian | Test runner bawaan Node.js (`node:test`) melalui `tsx` |

Aplikasi ini adalah situs statis. Tidak ada backend tersendiri.

---

## Struktur proyek

```text
.
├── index.html                      # HTML utama, metadata SEO, dan favicon
├── metadata.json                   # Nama, deskripsi, dan izin geolokasi (templat AI Studio)
├── package.json                    # Skrip pengembangan, build, lint, dan tes
├── vite.config.ts                  # Bundler Vite 8 + Tailwind CSS v4
├── tsconfig.json                   # Konfigurasi TypeScript
├── vercel.json                     # Build, rewrite SPA, cache, dan header keamanan Vercel
├── .vercelignore                   # Berkas yang diabaikan saat deploy
├── .env.example                    # Contoh variabel lingkungan (lihat catatan di bawah)
├── ATTRIBUTION.md                  # Atribusi foto armada dan sumber data terbuka
├── public/
│   ├── icon.svg                    # Ikon aplikasi
│   ├── maplibre-gl-worker.mjs      # Web worker MapLibre GL
│   ├── data/
│   │   ├── network.json            # Rel OpenStreetMap, 483 stasiun, 8 sistem, terowongan, hari libur 2026
│   │   ├── trips.json              # Jadwal komuter (KRL, MRT, LRT, Bandara, Whoosh/feeder)
│   │   ├── kai.json                # Jadwal KA antarkota, lokal, dan sebagian KA Bandara (GAPEKA 2026)
│   │   ├── freight.json            # Jadwal 114 perjalanan KA barang (GAPEKA 2026)
│   │   ├── jpl.json                # 4.700 titik perlintasan sebidang di Pulau Jawa
│   │   ├── stations_x.json         # Foto Wikimedia, Daop, dan penanda KM
│   │   ├── terminals.json          # 94 emplasemen, depo BBM, dan terminal peti kemas
│   │   └── fleet.json              # Referensi ilustrasi armada per layanan
│   └── img/fleet/                  # Gambar WebP ilustrasi armada
└── src/
    ├── main.tsx                    # Titik masuk React 19
    ├── App.tsx                     # State global, deep-link, GPS, dan tata letak responsif
    ├── index.css                   # Tema Tailwind CSS dan tipografi
    ├── engine/                     # Logika murni dan fisika perkeretaapian
    │   ├── sched.ts                # Mesin jadwal, fisika trapesium, perencana rute CSA, prediksi JPL
    │   ├── analytics.ts            # Pencarian terpadu (termasuk alias Indonesia) dan statistik jaringan
    │   ├── constants.ts            # Warna, gaya peta, parser JPL, pintasan wilayah, opsi Mesin waktu
    │   ├── deeplink.ts             # Penyusun dan pengurai hash URL
    │   ├── eta.ts                  # ETA antarpemberhentian, pose 3D, dan preset kamera
    │   ├── gps.ts                  # Proyeksi GPS ke rel, selisih jadwal, dan stamformasi
    │   ├── javaInsights.ts         # Aksesibilitas, hub transit, Marey, silang/susul, tarif, pencahayaan 3D WIB
    │   ├── nearby.ts               # Radar kereta dan stasiun terdekat
    │   ├── stock.ts                # Dimensi dan komposisi sarana per tipe kereta
    │   ├── train3dLayer.ts         # Lapisan WebGL Three.js (rangkaian 3D, lampu, atmosfer WIB)
    │   ├── weather.ts              # Open-Meteo, kode WMO, tips perjalanan, dan cache
    │   ├── types.ts                # Definisi tipe TypeScript inti
    │   └── engine.test.ts          # Unit tes (node:test) untuk seluruh mesin
    └── components/                 # Antarmuka modular (sidebar desktop dan bottom-sheet ponsel)
        ├── MapCanvas.tsx           # Peta MapLibre GL, klaster JPL, ikon kereta, dan lapisan 3D
        ├── StationDetailPanel.tsx  # Detail stasiun: cuaca, aksesibilitas, hub, FIDS
        ├── TrainDetailPanel.tsx    # Detail KA: ETA, Live GPS, stamformasi, silang/susul, kecepatan
        ├── LineDetailPanel.tsx     # Detail jalur: tabel jadwal dan grafik GAPEKA (diagram Marey)
        ├── RoutePlannerPanel.tsx   # Perencana rute CSA
        ├── HomePanel.tsx           # Beranda: radar kereta, radar JPL, dan stasiun favorit
        ├── JplDetailPanel.tsx      # Detail perlintasan, lintasan KA terdekat, dan foto
        ├── JplFloatingCard.tsx     # Kartu ringkas JPL di peta
        ├── JplLegendCard.tsx       # Legenda kategori JPL
        ├── TimeMachineDock.tsx     # Kontrol waktu simulasi, tanggal, dan kecepatan putar
        ├── TopMapControls.tsx      # Filter sistem kereta dan pintasan koridor wilayah
        ├── MapRightRail.tsx        # Kontrol 3D, satelit, JPL, terowongan, tema, lokasi, dan bagikan
        ├── LayersPopover.tsx       # Pemilih gaya peta dan lapisan
        ├── Train3DHud.tsx          # HUD kamera 3D saat mengikuti rangkaian
        ├── SearchResultsPanel.tsx  # Hasil pencarian terpadu
        ├── StationsListPanel.tsx   # Daftar stasiun
        ├── LinesListPanel.tsx      # Daftar jalur
        ├── ShareButton.tsx         # Salin tautan deep-link
        └── AboutModal.tsx          # Jendela Tentang: cakupan data dan atribusi
```

---

## Sumber data

Rincian lisensi, pembuat foto, dan catatan turunan database ada di [`ATTRIBUTION.md`](./ATTRIBUTION.md).

| Data | Sumber | Catatan |
| :--- | :--- | :--- |
| KRL Commuter Line (6 lin Jabodetabek–Merak) | Open-KRL (CC BY 4.0), papan stasiun KCI | 1.143 perjalanan pada hari kerja |
| KA antarkota, lokal, dan sebagian KA Bandara | Jadwal publik GAPEKA 2026 Jawa, diurai dengan [Gapeka-parser](https://github.com/transportforbandung/Gapeka-parser) | 107 layanan di `kai.json` |
| KA barang | GAPEKA 2026 Jawa | 114 perjalanan; muatan tidak tercantum |
| MRT Jakarta, LRT Jakarta, LRT Jabodebek, Skytrain | [ShioriLabs/commute](https://github.com/ShioriLabs/commute) (ODbL 1.0) | Jadwal publik; jadwal MRT akhir pekan merupakan perkiraan |
| Whoosh (KCIC) | Pola frekuensi operator | Perkiraan; nomor perjalanan dibuat oleh Sepur Live |
| Rel, stasiun, terowongan, JPL, terminal | © kontributor [OpenStreetMap](https://www.openstreetmap.org/copyright) (ODbL 1.0), ekstrak Geofabrik Pulau Jawa | 483 stasiun, 4.700 titik JPL, 105 terowongan, 94 terminal atau depo |
| Foto stasiun dan armada | Wikimedia Commons dan Wikidata | 448 foto stasiun; atribusi per berkas di `ATTRIBUTION.md` |
| Daop dan km stasiun | Infobox artikel stasiun di id.wikipedia.org (CC BY-SA 4.0) | Dipakai juga untuk perkiraan KM JPL |
| Cuaca stasiun | [Open-Meteo Weather API](https://open-meteo.com/) (CC BY 4.0) | Zona waktu `Asia/Jakarta` (WIB) |
| Citra satelit dan peta dasar | OpenFreeMap, Carto Dark Matter, Esri World Imagery | Lihat bagian gaya peta |

Beberapa sumber sengaja tidak diimpor. Portal pemerintah yang memuat daftar JPL (DJKA e-Perlintasan, SIMARLIN Lumajang, SIMINFRA Grobogan) tidak mencantumkan lisensi pemakaian ulang. Data perlintasan [168Railway](https://168railway.com/jpl) juga tidak dipakai: itu database survei milik mereka tanpa lisensi terbuka.

Jarak antarstasiun GAPEKA (melalui Gapeka-parser) dipakai untuk menskalakan perkiraan KM.

---

## Memulai

### Prasyarat

- **Node.js** 20 atau lebih baru (`engines.node` di `package.json` mensyaratkan `>=20.0.0`)
- **npm**, atau **bun** (repositori menyertakan `bun.lock`)

### Instalasi

1. Salin repositori, lalu masuk ke foldernya.

   ```bash
   git clone https://github.com/podsni/keretaku.git
   cd keretaku
   ```

2. Pasang dependensi.

   ```bash
   npm install
   ```

3. Jalankan server pengembangan.

   ```bash
   npm run dev
   ```

   Aplikasi tersedia di [http://localhost:3000](http://localhost:3000) (Vite diikat ke `0.0.0.0`, port 3000).

### Perintah lain

| Perintah | Fungsi |
| :--- | :--- |
| `npm run build` | Membangun versi produksi ke folder `dist/` |
| `npm run preview` | Meninjau hasil build (port bawaan Vite, biasanya 4173) |
| `npm run lint` | Memeriksa tipe TypeScript (`tsc --noEmit`) |
| `npm test` | Menjalankan unit tes mesin di `src/engine/engine.test.ts` |
| `npm run clean` | Menghapus `dist/` dan `server.js` |

Tes mencakup fisika pergerakan, pemuatan data Jawa, jadwal dan keberangkatan, perencana rute CSA, prediksi JPL, *deep-link*, proyeksi GPS, ETA, radar terdekat, gaya peta, aksesibilitas kursi roda, diagram Marey, deteksi persilangan, pencahayaan 3D WIB, alias pencarian, dan parser cuaca Open-Meteo.

---

## Variabel lingkungan

Berkas [`.env.example`](./.env.example) memuat dua variabel dari templat Google AI Studio:

| Variabel | Dipakai di kode? |
| :--- | :--- |
| `GEMINI_API_KEY` | Tidak. Tidak ada impor `@google/genai` dan tidak ada pembacaan kunci ini di `src/`. |
| `APP_URL` | Tidak. Tidak dibaca di kode aplikasi. |

`metadata.json` masih mencantumkan kemampuan Gemini AI Studio, tetapi itu bukan fitur yang berjalan di aplikasi ini.

Untuk menjalankan atau men-deploy Sepur Live, kamu tidak perlu mengisi variabel lingkungan. Data jadwal bersifat statis di `public/data/`. Cuaca memakai Open-Meteo tanpa kunci API.

Variabel `DISABLE_HMR` (opsional, hanya dibaca di `vite.config.ts`) menonaktifkan HMR dan pemantauan berkas saat pengembangan di AI Studio. Tidak diperlukan untuk pemakaian biasa.

---

## Deploy ke Vercel

Demo produksi ada di [keretaku-app.vercel.app](https://keretaku-app.vercel.app). Proyek Vercel `keretaku-app` terhubung ke repositori [podsni/keretaku](https://github.com/podsni/keretaku). Setiap push ke cabang `main` men-deploy otomatis.

Proyek ini sudah dikonfigurasi sebagai aplikasi statis Vite melalui `vercel.json` dan `.vercelignore`. Tidak ada backend khusus dan tidak ada variabel lingkungan yang wajib diisi.

### Opsi 1: Dashboard Vercel

1. Unggah proyek ke repositori Git (GitHub, GitLab, atau Bitbucket).
2. Buka [vercel.com/new](https://vercel.com/new), pilih Import Git Repository, lalu pilih repositori ini.
3. Vercel membaca `vercel.json` dengan konfigurasi berikut:
   - Framework: Vite
   - Perintah pasang: `npm install`
   - Perintah build: `npm run build`
   - Folder keluaran: `dist`
   - Node.js: 20.x atau lebih baru (`engines.node >= 20.0.0`)
4. Tidak ada variabel lingkungan wajib. Langsung pilih Deploy.
5. Setelah selesai, aplikasi aktif di `https://<nama-proyek>.vercel.app` dengan HTTPS. HTTPS diperlukan agar fitur Live GPS dan Lokasiku berjalan di peramban.

### Opsi 2: Vercel CLI

1. Pasang Vercel CLI: `npm install -g vercel`
2. Masuk ke akun: `vercel login`
3. Deploy pratinjau: `vercel`
4. Deploy produksi: `vercel --prod`

### Yang diatur di `vercel.json`

- **Rewrite SPA:** rute aplikasi diarahkan ke `/index.html` tanpa mengganggu berkas statis (`/assets/*`, `/data/*`, `/img/*`, `/icon.svg`, `/maplibre-gl-worker.mjs`).
- **MIME dan cache worker MapLibre:** `/maplibre-gl-worker.mjs` disajikan sebagai `application/javascript; charset=utf-8` dengan cache 1 hari, agar peta vektor dan mode 3D berjalan lancar.
- **Cache CDN:** cache *immutable* untuk bundel Vite (`/assets/*`), serta *stale-while-revalidate* untuk dataset JSON (`/data/*`) dan ilustrasi armada (`/img/*`).
- **Header keamanan:** `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, dan `Permissions-Policy: geolocation=(self)` agar deteksi lokasi dan Live GPS tetap diizinkan di domain produksi.

`.vercelignore` mengabaikan `node_modules`, `dist`, berkas `.env`, dan aset AI Studio agar tidak ikut terunggah.

---

## Format tautan *deep-link*

Sepur Live menyinkronkan tampilan aktif ke hash URL sehingga mudah dibagikan:

| Tujuan | Contoh hash URL |
| :--- | :--- |
| Detail stasiun | `#station=YK` atau `#station=MRI&sys=krl` |
| Detail kereta | `#train=KA%20105&td=2026-11-21` |
| Detail jalur | `#line=krl-b` |
| Perencana rute | `#from=BOO&to=THB&td=2026-10-12&t=27000` |
| Perlintasan sebidang (JPL) | `#jplIdx=42&jpl=1` |
| Posisi kamera peta | `#@-7.78920,110.36350,14.5` |

Parameter tambahan yang didukung: `sys` (filter sistem: `krl`, `mrt`, `lrt`, `bandara`, `whoosh`, `kai`, `barang`), `td` (tanggal `YYYY-MM-DD`), `t` (detik sejak tengah malam, 0 sampai 86399), dan `jpl=1` (menyalakan lapisan JPL).

---

## Kontribusi

Perbaikan, laporan galat, dan usulan fitur sangat diterima, selama data yang ditambahkan berlisensi terbuka. Lihat catatan sumber di [`ATTRIBUTION.md`](./ATTRIBUTION.md).

1. Fork repositori, lalu buat cabang dari `main`.
2. Pasang dependensi dan kerjakan perubahan.
3. Jalankan `npm run lint` dan `npm test` sebelum mengusulkan perubahan.
4. Kirim pull request dengan penjelasan yang jelas.

---

## Lisensi dan atribusi

Repositori ini belum menyertakan berkas `LICENSE`.

Jendela Tentang di aplikasi menyebut bahwa Sepur Live berbasis proyek sumber terbuka **sepur-live** (MIT © 2026 podsni).

Data peta © kontributor OpenStreetMap (ODbL 1.0). Foto dari Wikimedia Commons sesuai lisensi masing-masing berkas. Rincian lengkap ada di [`ATTRIBUTION.md`](./ATTRIBUTION.md).
