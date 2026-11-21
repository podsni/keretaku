# Sepur Live — Peta Kereta Api Indonesia Interaktif

**Sepur Live** adalah aplikasi web pelacakan dan eksplorasi jaringan perkeretaapian Indonesia (Pulau Jawa) secara interaktif berbasis **MapLibre GL**, **Three.js 3D**, **jadwal publik GAPEKA 2026**, geometri rel **OpenStreetMap**, dan data **cuaca stasiun real-time**.

Aplikasi ini dirancang responsif penuh untuk **desktop maupun mobile** sehingga penumpang, railfans, dan pengguna transportasi umum dapat memantau pergerakan kereta, merencanakan perjalanan antarmoda, memeriksa aksesibilitas kursi roda, melihat cuaca stasiun saat ini, hingga menelusuri lebih dari 4.700 perlintasan sebidang (JPL).

---

## Fitur Utama

### 1. Peta Langsung & Mode 3D Atmosferik
- **Pelacakan Posisi Kereta Real-Time (Jadwal GAPEKA + Live GPS)**:
  - Mensimulasikan pergerakan seluruh layanan rel di Pulau Jawa: **KRL Commuter Line** (Jabodetabek, Merak, Bandung Raya, Yogyakarta–Palur, Surabaya–Sidoarjo–Malang), **MRT Jakarta**, **LRT Jakarta & LRT Jabodebek**, **KA Bandara (Soetta, YIA, BIAS)**, **Kereta Cepat Whoosh (KCIC)**, **KA Antarkota KAI**, serta **KA Barang**.
  - Mendukung pelacakan **Live GPS** untuk menyelaraskan posisi pengguna langsung ke jalur rel OpenStreetMap beserta selisih jadwal (*tepat waktu / lebih cepat / terlambat*).
- **Mode 3D Rangkaian Kereta (Three.js + MapLibre Custom Layer)**:
  - Model 3D kereta artikulasi mengikuti tikungan rel secara akurat (lokomotif CC 206/CC 201, KRL, MRT, LRT, Whoosh CR400AF, serta aksen khusus **Kereta Panoramic** dengan atap *skylight* dan **Suite Class Compartment**).
  - **Pencahayaan Siang–Senja–Malam WIB** otomatis sesuai waktu simulasi: cahaya alami fajar/siang/senja, sorot lampu depan (*headlight beam*), dan pendar jendela hangat pada malam hari.
  - Preset kamera 3D interaktif: **Otomatis**, **Kejar**, **Samping**, **Tepi Rel**, **Atas**, dan **Bebas**.
- **Mode Peta Multi-Gaya**:
  - Pilihan peta **Terang**, **Gelap**, **Satelit (Esri World Imagery)**, dan **Hibrida (Satelit + Label Jalan)**, plus lapisan terowongan bawah tanah dan perlintasan sebidang (JPL).

### 2. Detail Stasiun Lengkap & Ramah Disabilitas
- **Cuaca Stasiun Real-Time (Open-Meteo API)**:
  - Menampilkan kondisi cuaca aktual langsung dari koordinat geografis stasiun (`Asia/Jakarta` / WIB): suhu udara (`°C`), suhu terasa (*feels like*), kelembapan (`%`), kecepatan & arah angin (`km/j`), curah hujan (`mm`), prakiraan **3 jam ke depan** lengkap dengan peluang hujan (`%`), serta **tips persiapan perjalanan penumpang** otomatis (mis. saran payung saat potensi hujan tinggi atau hidrasi saat udara terik).
  - Dilengkapi *caching* pintar 10 menit per stasiun, pembatalan permintaan otomatis saat berpindah stasiun, serta tombol **Muat ulang cuaca**.
- **Filter Ketersediaan Kursi Roda & Profil Aksesibilitas Stasiun**:
  - Tombol filter interaktif **Ketersediaan Kursi Roda** pada **Papan langsung**, **Jadwal sehari**, dan **Papan Layar LED (FIDS)** untuk menyaring perjalanan penumpang ramah kursi roda (menyembunyikan kereta barang) dengan label akses per kereta (*Peron Rata* / *Kursi Roda Tersedia KAI*).
  - Kartu **Aksesibilitas & Kursi Roda** merinci tingkat akses stasiun, ketersediaan fasilitas (kursi roda gratis, jalur landai/ramp, lift/eskalator, toilet disabilitas, *guiding block*), dan panduan layanan bantuan *boarding* KAI 121.
- **Mode Papan Layar Stasiun (FIDS)**:
  - Layar penuh bergaya papan informasi keberangkatan LED stasiun secara langsung yang sinkron dengan filter kursi roda.
- **Kartu Hub Transit Antarmoda**:
  - Panduan perpindahan moda untuk simpul besar Pulau Jawa (**Manggarai, Sudirman, BNI City, Tanah Abang, Gambir, Bandung, Padalarang, Halim, Yogyakarta, Solo Balapan, Surabaya Gubeng**) lengkap dengan pintasan stasiun terhubung.
- **Informasi Stasiun & Foto Wikimedia Commons**:
  - Kode stasiun, Daop, penanda kilometer (`KM`) yang dirapikan, dan foto stasiun beserta atribusi lisensi.

### 3. Detail Kereta, ETA & Analisis Operasional
- **Estimasi Tiba (ETA) & Hitung Mundur Real-Time**:
  - Menghitung jarak, progres antarpemberhentian, dan waktu hitung mundur menuju stasiun berikutnya yang menyesuaikan kecepatan simulasi (*Time Machine* `1×` hingga `300×`).
- **Deteksi Persilangan & Penyusulan (*Meets & Overtakes*)**:
  - Mendeteksi titik silang atau susul dengan kereta lain pada lintas yang sama lengkap dengan waktu pertemuan serta tautan ke kereta dan stasiun terkait.
- **Kelas Layanan, Stamformasi & Estimasi Tarif**:
  - Rincian susunan rangkaian (*consist/stamformasi*) termasuk **Kereta Panoramic (`PAN`)**, **Suite Class Compartment (`SCC`)**, dan **Stainless Steel New Generation**, ditambah estimasi rentang tarif serta grafik profil kecepatan perjalanan.

### 4. Grafik GAPEKA Interaktif (Diagram Marey)
- Tersedia di setiap detail jalur melalui tab **Tabel Jadwal | Grafik GAPEKA**.
- Memvisualisasikan perjalanan arah pergi dan balik pada sumbu ruang–waktu (stasiun vs jam operasional) lengkap dengan garis penanda waktu berjalan (**Sekarang**), *hover tooltip*, dan klik garis perjalanan untuk membuka detail kereta.

### 5. Perencana Rute Antarmoda & Pencarian Alias Indonesia
- **Connection Scan Algorithm (CSA)** untuk mencari rute multi-moda (KRL, MRT, LRT, KA Bandara, Whoosh, KA Antarkota) dengan tag perbandingan otomatis (**Tercepat**, **Hemat**, **Minim Transit**) dan estimasi biaya perjalanan.
- **Pencarian Terpadu dengan Alias Populer**: mendukung pencarian cepat menggunakan istilah lokal seperti `jogja`, `tugu`, `yia`, `soetta`, `cgk`, `pasarturi`, `gubeng`, `whoosh`, `kcic`, `prameks`, `bias`, dan `dukuh atas`.

### 6. Radar Lokasi Terdekat & Perlintasan Sebidang (JPL)
- **Radar Kereta Terdekat**: mendeteksi lokasi pengguna secara otomatis untuk menampilkan stasiun terdekat dan kereta aktif di sekitar lengkap dengan indikator arah datang (*mendekat / menjauh*) dan kompas.
- **Peta & Radar 4.700+ Perlintasan Sebidang (JPL)**:
  - Klasifikasi tingkat pengamanan (dijaga petugas, berpalang, lampu/bel, tanpa palang, *flyover*, *underpass*).
  - **Radar JPL Terdekat** di Beranda menampilkan perlintasan aktif terdekat lengkap dengan hitungan mundur status palang (*Palang segera tutup*, *Kereta mendekat*, *Aman sementara*).

### 7. Mesin Waktu (*Time Machine*) & Tautan Berbagi (*Deep-Link*)
- Putar, jeda, ubah tanggal (hari kerja / akhir pekan / libur nasional), percepat simulasi (`1×`–`300×`), atau lompat ke jam sibuk (`06:30`, `08:00`, `12:00`, `17:30`, `21:30`).
- Fitur **Bagikan Tautan** menghasilkan URL *deep-link* yang langsung membuka kereta, stasiun, jalur, rute, perlintasan JPL, dan posisi kamera peta tertentu.

---

## Arsitektur & Struktur Proyek

```text
.
├── index.html                      # Entry HTML, metadata SEO & favicon kustom
├── metadata.json                   # Konfigurasi nama, deskripsi, dan izin geolocation
├── package.json                    # Skrip pengembangan, build, dan linting
├── vite.config.ts                  # Konfigurasi bundler Vite + Tailwind CSS v4
├── ATTRIBUTION.md                  # Atribusi lengkap foto armada & sumber data terbuka
├── public/
│   ├── data/
│   │   ├── network.json            # Geometri rel OpenStreetMap, stasiun & daftar jalur
│   │   ├── trips.json              # Jadwal komuter (KRL, MRT, LRT, Bandara, Whoosh)
│   │   ├── kai.json                # Jadwal KA Antarkota & Lokal KAI (GAPEKA 2026)
│   │   ├── freight.json            # Jadwal KA Barang GAPEKA 2026
│   │   ├── jpl.json                # 4.700+ titik perlintasan sebidang (JPL) Pulau Jawa
│   │   ├── stations_x.json         # Metadata stasiun: foto Wikimedia, Daop, dan penanda KM
│   │   ├── terminals.json          # Emplasemen, depo BBM, terminal peti kemas & dry port
│   │   └── fleet.json              # Referensi ilustrasi armada per layanan
│   └── img/fleet/                  # Aset gambar WebP ilustrasi armada
└── src/
    ├── main.tsx                    # Bootstrap React 19
    ├── App.tsx                     # State global, sinkronisasi deep-link, GPS & tata letak responsif
    ├── index.css                   # Konfigurasi tema Tailwind CSS & scrollbar kustom
    ├── engine/                     # Modul logika murni & fisika perkeretaapian
    │   ├── sched.ts                # Mesin jadwal, fisika trapesium, CSA router & prediksi JPL
    │   ├── analytics.ts            # Pencarian terpadu (+ alias Indonesia) & statistik jaringan
    │   ├── constants.ts            # Skema warna, gaya basemap (terang/gelap/satelit/hibrida), parser JPL
    │   ├── deeplink.ts             # Serializer & parser URL hash deep-link
    │   ├── eta.ts                  # Kalkulasi ETA antarpemberhentian, pose 3D & preset kamera
    │   ├── gps.ts                  # Proyeksi GPS-ke-rel, selisih jadwal & pembangun stamformasi
    │   ├── javaInsights.ts         # Aksesibilitas kursi roda, hub transit, Marey, silang/susul, tarif, 3D WIB
    │   ├── nearby.ts               # Radar kereta & stasiun terdekat + deteksi vektor mendekat
    │   ├── stock.ts                # Dimensi & komposisi sarana per tipe kereta
    │   ├── train3dLayer.ts         # Custom WebGL layer Three.js (rangkaian 3D + lampu & atmosfer WIB)
    │   ├── weather.ts              # Integrasi Open-Meteo real-time, kode WMO ID, tips perjalanan & cache
    │   ├── types.ts                # Definisi tipe TypeScript inti
    │   └── engine.test.ts          # Rangkaian unit test (node:test) mencakup seluruh mesin
    └── components/                 # Komponen antarmuka modular (Desktop sidebar & Mobile bottom-sheet)
        ├── MapCanvas.tsx           # Peta MapLibre GL, klaster JPL, ikon kereta & layer 3D
        ├── StationDetailPanel.tsx  # Detail stasiun: Cuaca live, Aksesibilitas, Kursi Roda, Hub, FIDS
        ├── TrainDetailPanel.tsx    # Detail KA: ETA countdown, Live GPS, Stamformasi, Silang/Susul, Kecepatan
        ├── LineDetailPanel.tsx     # Detail jalur: Tabel jadwal & Grafik GAPEKA (Diagram Marey)
        ├── RoutePlannerPanel.tsx   # Perencana rute CSA dengan perbandingan tarif & durasi
        ├── HomePanel.tsx           # Beranda: Radar kereta terdekat, Radar JPL, Stasiun favorit & sorotan
        ├── JplDetailPanel.tsx      # Detail perlintasan sebidang, lintasan KA terdekat & foto
        ├── TimeMachineDock.tsx     # Kontrol waktu simulasi, tanggal & kecepatan putar
        ├── TopMapControls.tsx      # Filter sistem kereta & pintasan koridor wilayah Jawa
        ├── MapRightRail.tsx        # Kontrol 3D, satelit, JPL, terowongan, tema, lokasi & bagikan
        ├── Train3DHud.tsx          # HUD kamera 3D saat mengikuti rangkaian kereta
        └── ...                     # Panel pencarian, daftar stasiun/jalur, legenda, modal info
```

---

## Teknologi yang Digunakan

| Kategori | Teknologi |
| :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite 8 |
| **Styling & Ikon** | Tailwind CSS v4, Lucide React, Motion |
| **Peta & Visualisasi 3D** | MapLibre GL JS, Three.js |
| **API Eksternal Real-Time** | Open-Meteo Forecast API (Cuaca stasiun real-time tanpa API key), Esri World Imagery (Mode Satelit), OpenFreeMap Vector Tiles |
| **Pengujian** | Node.js Built-in Test Runner (`node:test`) melalui `tsx` |

---

## Instalasi & Menjalankan Secara Lokal

### Prasyarat
- **Node.js** versi `20+` (disarankan LTS)
- **npm** atau **bun**

### Langkah Instalasi

1. **Pasang dependensi**
   ```bash
   npm install
   ```

2. **Jalankan server pengembangan**
   ```bash
   npm run dev
   ```
   Aplikasi dapat diakses di `http://localhost:3000`.

3. **Bangun untuk produksi (*Production Build*)**
   ```bash
   npm run build
   ```

4. **Pratinjau hasil build produksi**
   ```bash
   npm run preview
   ```

---

## Pengujian & Verifikasi Kualitas

### Menjalankan Unit Test
Seluruh logika mesin (fisika pergerakan, jadwal GAPEKA, perencana rute CSA, prediksi JPL, *deep-link*, proyeksi GPS, ETA, radar terdekat, aksesibilitas kursi roda, diagram Marey, deteksi persilangan, pencahayaan 3D WIB, dan parser cuaca Open-Meteo) diuji melalui `node:test`:

```bash
npx --yes tsx --test src/engine/engine.test.ts
```

### Pengecekan Tipe TypeScript (*Type Check*)
```bash
npm run lint
```

---

## Deploy ke Vercel

Proyek ini sudah dikonfigurasi siap *deploy* sebagai aplikasi statis Vite di **Vercel** melalui `vercel.json` dan `.vercelignore` — **tanpa perlu backend khusus maupun API key / Environment Variable wajib** (data jadwal bersifat statis dan API cuaca Open-Meteo berjalan langsung tanpa kunci API).

### Opsi 1: Deploy via GitHub & Dashboard Vercel (Direkomendasikan)

1. **Unggah proyek ke repositori GitHub** (GitLab / Bitbucket juga didukung).
2. Buka [vercel.com/new](https://vercel.com/new), lalu pilih **Import Git Repository** dan pilih repositori proyek ini.
3. Vercel akan otomatis membaca `vercel.json` dengan konfigurasi berikut:
   - **Framework Preset**: `Vite`
   - **Install Command**: `npm install`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Node.js Version**: `20.x` atau lebih baru (`engines.node >= 20.0.0`)
4. Tidak ada *Environment Variable* wajib yang perlu diisi — langsung klik **Deploy**.
5. Setelah selesai, aplikasi langsung aktif di URL `https://<nama-proyek>.vercel.app` dengan HTTPS penuh (dibutuhkan browser agar fitur **Live GPS / Lokasiku** berjalan).

### Opsi 2: Deploy via Vercel CLI

1. **Pasang Vercel CLI secara global**
   ```bash
   npm install -g vercel
   ```

2. **Masuk ke akun Vercel**
   ```bash
   vercel login
   ```

3. **Deploy pratinjau (*Preview*)**
   ```bash
   vercel
   ```

4. **Deploy ke produksi (*Production*)**
   ```bash
   vercel --prod
   ```

### Apa yang Diatur di `vercel.json`?
- **SPA Fallback Rewrite**: mengarahkan rute aplikasi ke `/index.html` tanpa mengganggu berkas statis (`/assets/*`, `/data/*`, `/img/*`, `/icon.svg`, `/maplibre-gl-worker.mjs`).
- **MIME & Cache Web Worker MapLibre**: memastikan `/maplibre-gl-worker.mjs` disajikan sebagai `application/javascript; charset=utf-8` agar peta vektor & 3D berjalan lancar.
- **Caching Edge CDN**: *immutable caching* untuk bundel aset Vite (`/assets/*`) dan *stale-while-revalidate* untuk dataset JSON GAPEKA (`/data/*`) serta ilustrasi armada (`/img/*`).
- **Header Keamanan & Geolokasi**: menyertakan `Permissions-Policy: geolocation=(self)` agar fitur deteksi lokasi & Live GPS tetap diizinkan di domain produksi.

---

## Format Tautan *Deep-Link*

Sepur Live menyinkronkan tampilan aktif ke hash URL sehingga mudah dibagikan:

| Tujuan | Contoh Hash URL |
| :--- | :--- |
| **Detail Stasiun** | `#station=YK` atau `#station=MRI&sys=krl` |
| **Detail Kereta** | `#train=KA%20105&td=2026-11-21` |
| **Detail Jalur / GAPEKA** | `#line=krl-b` |
| **Perencana Rute** | `#from=BOO&to=THB&td=2026-10-12&t=27000` |
| **Perlintasan Sebidang (JPL)** | `#jplIdx=42&jpl=1` |
| **Posisi Kamera Peta** | `#@-7.78920,110.36350,14.5` |

---

## Sumber Data, API & Atribusi

- **Geometri Rel, Stasiun & JPL**: © Kontributor [OpenStreetMap](https://www.openstreetmap.org/copyright) (ODbL 1.0).
- **Jadwal Kereta Api**: Jadwal publik **GAPEKA 2026** (KAI) dan jadwal komuter/angkutan massal (KRL Commuter Line, MRT Jakarta, LRT Jakarta, LRT Jabodebek, KA Bandara, KCIC Whoosh). Posisi di peta dihitung dari jadwal pada rel OpenStreetMap (bukan telemetri GPS internal operator), kecuali jika pengguna mengaktifkan fitur Live GPS pada perangkatnya sendiri.
- **Data Cuaca Stasiun Real-Time**: [Open-Meteo Weather API](https://open-meteo.com/) (CC BY 4.0) menggunakan zona waktu `Asia/Jakarta` (WIB).
- **Citra Satelit & Peta Dasar**: OpenFreeMap & Esri World Imagery.
- **Foto Stasiun & Armada**: Wikimedia Commons dan Wikidata (CC0 / CC BY / CC BY-SA). Rincian atribusi pembuat dan lisensi tiap berkas tersedia di [`ATTRIBUTION.md`](./ATTRIBUTION.md).

> **Catatan**: Sepur Live adalah proyek visualisasi data terbuka independen dan tidak berafiliasi secara resmi dengan PT Kereta Api Indonesia (Persero), KAI Commuter, MRT Jakarta, LRT, maupun KCIC.
