# Project Index - Chatbot Admisi UPJ

## 1) Ringkasan Arsitektur

Project ini adalah fullstack app dengan 2 runtime utama:

- Backend: Flask API (Python) untuk chat AI, scraping, dan cache knowledge base.
- Frontend: Next.js (Pages Router) untuk UI chatbot publik + dashboard admin.
- Database: Firebase Firestore untuk FAQ, chat logs, leads, feedback.
- AI Model: Google Gemini (`gemini-2.5-flash`) via `google.genai` client.

Alur utama:

1. User chat dari frontend (`/mainpage`) ke backend endpoint `/chat`.
2. Backend ambil FAQ dari Firestore (dengan RAM cache), bentuk system prompt, lalu panggil Gemini.
3. Response diformat HTML di backend, ditampilkan di frontend.
4. Log chat disimpan ke Firestore.
5. Admin kelola FAQ/log/leads dari dashboard, termasuk scraping URL jadi FAQ.

## 2) Struktur Folder Inti

- `backend/`
  - `app.py`: server Flask utama + endpoint API + rate limit + cache + integrasi Gemini/Firestore.
  - `auto_scraper.py`: script batch scraping website -> Gemini -> simpan FAQ ke Firestore.
  - `cek_koneksi.py`: script diagnosis koneksi OpenRouter (legacy/testing path).
  - `prompt_rules.txt`: template system prompt chatbot.
  - `requirements.txt`: dependency backend (file ter-encode UTF-16).
  - `install_backend.sh`: bootstrap install dependency backend sederhana.
  - `firebase-key.json`: service account Firebase (sensitif).

- `frontend/`
  - `src/pages/mainpage.tsx`: halaman chatbot utama user.
  - `src/pages/dashboard.tsx`: panel admin (FAQ, feedback, logs, leads, scraper, export xlsx).
  - `src/pages/login.tsx`: login admin via Google auth + allowlist email.
  - `src/pages/index.tsx`: redirect ke `/mainpage`.
  - `src/lib/firebase.ts`: inisialisasi Firebase app/auth/firestore.
  - `src/styles/*.css`: styling global/chatbot/dashboard.
  - `next.config.ts`, `tsconfig.json`, `tailwind.config.js`, `postcss.config.mjs`: konfigurasi frontend.

- Root
  - `run.bat`: jalankan backend + frontend sekaligus (Windows).
  - `package.json`: root hanya menyimpan dev dependency lint lama.

## 3) Backend Index (Detail)

### 3.1 `backend/app.py`
Fungsi dan tanggung jawab utama:

- Setup Flask + CORS + rate limiter.
- Koneksi Firestore via service account.
- Cache FAQ di RAM (`FAQ_CACHE`, durasi 1 jam).
- Pembuatan system prompt dinamis dari `prompt_rules.txt` + data FAQ Firestore.
- Panggilan model Gemini untuk menjawab chat.
- Sanitasi basic/formatting output HTML.
- Logging interaksi chat ke koleksi Firestore.

Endpoint:

- `POST /chat`
  - Input: `message`, `history`.
  - Validasi panjang pesan (maks 500 char).
  - Apply rate-limit khusus endpoint (10/minute).
  - Return: `response` (HTML formatted).

- `GET /refresh-cache`
  - Query: `token`.
  - Reset cache FAQ dan reload dari Firestore.
  - Proteksi pakai `ADMIN_SECRET_TOKEN`.

- `POST /api/scrape`
  - Header: `Authorization: Bearer <ADMIN_SECRET_TOKEN>`.
  - Input: URL target.
  - Scrape konten page (p/h1/h2/h3/li), kirim ke Gemini untuk ekstraksi FAQ JSON.
  - Return preview FAQ untuk kurasi di dashboard.

### 3.2 `backend/auto_scraper.py`
Script standalone untuk:

1. Scrape URL target.
2. Minta Gemini generate FAQ JSON.
3. Batch insert FAQ ke Firestore.

Use case: bulk update knowledge base di luar dashboard.

### 3.3 `backend/prompt_rules.txt`
Aturan persona chatbot:

- Hanya jawab domain UPJ.
- Tolak topik luar UPJ secara halus.
- Anti-halusinasi.
- Gaya bahasa ramah dengan sapaan "Kak".
- Tambahkan CTA daftar + link kontak.

## 4) Frontend Index (Detail)

### 4.1 `frontend/src/pages/mainpage.tsx`
Fitur utama chatbot UI:

- Chat realtime ke backend `/chat`.
- Kirim ringkasan history 4 pesan terakhir.
- Render markdown-like bot response ke HTML (`formatBotResponse`).
- Quick reply chips.
- Welcome overlay.
- Form lead capture (nama, WA, minat jurusan) -> Firestore `leads`.
- Tombol copy jawaban bot.
- Tombol feedback jawaban (helpful/not helpful) -> Firestore `chatbot_feedback`.

### 4.2 `frontend/src/pages/login.tsx`

- Login admin pakai Google popup.
- Restriksi email admin dari env: `NEXT_PUBLIC_ALLOWED_EMAILS`.
- Jika email tidak diizinkan: logout otomatis + tampilkan error.

### 4.3 `frontend/src/pages/dashboard.tsx`
Modul admin utama:

- Auth guard (`onAuthStateChanged`) -> redirect ke `/login`.
- CRUD FAQ (`faq`).
- Import FAQ dari Excel (xlsx) via `xlsx` package.
- Export FAQ, leads, analytics ke xlsx.
- Tabel chat logs (`chat_logs`) + hapus individual / mass delete.
- Tabel leads (`leads`) + search/filter.
- Rekap feedback chatbot (`chatbot_feedback`).
- Auto-scraper AI: panggil backend `/api/scrape`, kurasi hasil, simpan batch ke `faq`.
- Insight dashboard: ringkasan metrik + chart sederhana (bar/sparkline).

### 4.4 `frontend/src/lib/firebase.ts`

- Init Firebase app singleton.
- Export instance:
  - `auth`
  - `googleProvider`
  - `db` (Firestore)

## 5) Firestore Collections Yang Dipakai

- `faq`: source knowledge base Q/A chatbot.
- `chat_logs`: arsip percakapan user-bot dari backend.
- `leads`: data prospek mahasiswa dari form chatbot.
- `chatbot_feedback`: evaluasi kualitas jawaban bot.

## 6) Environment Variables

Backend:

- `GEMINI_API_KEY`: API key Google Gemini.
- `ADMIN_SECRET_TOKEN`: token proteksi endpoint admin (`/refresh-cache`, `/api/scrape`).

Frontend:

- `NEXT_PUBLIC_ALLOWED_EMAILS`: daftar email admin dipisah koma.
- `NEXT_PUBLIC_ADMIN_SECRET_TOKEN`: dipakai dashboard untuk panggil endpoint scrape backend.
- `NEXT_PUBLIC_SITE_NAME`: diset di `next.config.ts`.

## 7) Dependency Snapshot

Frontend penting:

- `next`, `react`, `firebase`, `xlsx`, `tailwindcss`, `typescript`.

Backend penting (subset):

- `Flask`, `Flask-Cors`, `Flask-Limiter`, `firebase_admin`, `google-generativeai`, `google-ai-generativelanguage`, `python-dotenv`, `requests`, `beautifulsoup4` (via bs4 import), `gunicorn`.

Catatan:

- `backend/requirements.txt` berisi dependency sangat banyak (termasuk ML stack besar seperti `torch`, `transformers`) yang tidak tampak dipakai langsung di `app.py`.

## 8) Risiko Teknis dan Temuan Penting

1. Kredensial sensitif berisiko terekspos:
   - `backend/firebase-key.json` ada di repo workspace.
   - `frontend/src/lib/firebase.ts` memuat config Firebase langsung di source.
2. Ketidaksesuaian dependency:
   - `install_backend.sh` hanya install paket minimal, tidak sinkron dengan `requirements.txt`.
3. Kualitas metadata Next:
   - `src/pages/_document.tsx` memakai `<title>` langsung di Document (praktik kurang ideal di Next).
4. Potensi drift toolchain frontend:
   - Kombinasi versi `next@16` dengan paket lint config lama perlu validasi kompatibilitas.
5. Cache FAQ manual:
   - Perubahan data FAQ tidak langsung terbaca hingga cache expire atau endpoint refresh dipanggil.

## 9) Cara Menjalankan Cepat

Backend:

1. Masuk ke `backend/`.
2. Siapkan virtualenv.
3. Install dependency.
4. Jalankan `python app.py`.

Frontend:

1. Masuk ke `frontend/`.
2. `npm install`.
3. `npm run dev`.

Windows fullstack:

- Jalankan `run.bat` di root.

## 10) Rekomendasi Prioritas Lanjutan

1. Pisahkan dan amankan secret (`firebase-key.json`, token env) dengan secret manager / CI vars.
2. Rapikan dependency backend: buat baseline minimal dari import aktual.
3. Tambahkan dokumentasi `.env.example` backend/frontend.
4. Tambahkan test minimal untuk endpoint `/chat` dan `/api/scrape`.
5. Tambahkan observability sederhana (request id, latency logging, error categorization).
