# Chatbot Admisi UPJ

## Ringkasan Proyek

Chatbot Admisi UPJ adalah aplikasi fullstack yang menggabungkan:

- Backend Flask (Python) sebagai API chatbot, pengelola FAQ, dan scraper AI.
- Frontend Next.js sebagai UI chatbot user dan dashboard admin.
- Firebase Firestore sebagai database untuk FAQ, chat logs, leads, dan feedback.
- Google Gemini AI (`google-genai`) untuk menghasilkan jawaban dan mengekstrak FAQ.

Aplikasi ini dirancang untuk membantu calon mahasiswa UPJ mendapatkan informasi penerimaan, jurusan, dan prosedur pendaftaran.

## Struktur Folder

- `backend/`
  - `app.py` – server Flask utama yang menyediakan endpoint chatbot dan scraper.
  - `auto_scraper.py` – scraper otomatis yang memproses halaman web menjadi FAQ.
  - `cek_koneksi.py` – skrip validasi koneksi Firebase dan Gemini.
  - `prompt_rules.txt` – aturan persona / prompt sistem untuk chatbot.
  - `requirements.txt` – dependency Python backend.
  - `install_backend.sh` – helper instalasi dependency untuk Linux/macOS.
  - `firebase-key.json` – kredensial service account Firebase (sensitif).

- `frontend/`
  - `src/pages/mainpage.tsx` – halaman chatbot publik.
  - `src/pages/login.tsx` – halaman login admin Google.
  - `src/pages/dashboard.tsx` – dashboard admin untuk manajemen FAQ, leads, log, dan scraping.
  - `src/lib/firebase.ts` – inisialisasi Firebase app/auth/firestore.
  - `src/styles/` – styling untuk mainpage dan dashboard.
  - `next.config.ts`, `tsconfig.json`, `tailwind.config.js`, `postcss.config.mjs` – konfigurasi frontend.

- Root
  - `run.bat` – starter Windows untuk backend + frontend.
  - `package.json` – konfigurasi dev dependency ESLint root.
  - `PROJECT_INDEX.md` – ringkasan arsitektur proyek.

## Arsitektur Utama

1. User membuka `http://localhost:3000/mainpage`.
2. Frontend mengirimkan pesan ke backend Flask di `http://localhost:5000/chat`.
3. Backend mengambil dan menyusun data FAQ dari Firestore.
4. Backend memanggil model Gemini untuk menghasilkan jawaban.
5. Backend mengembalikan respons ke frontend dalam format HTML.
6. Frontend menampilkan jawaban dan menyimpan feedback/leads.

## Instalasi

### Persyaratan

- Python 3.11+ (direkomendasikan 3.13)
- Node.js 18+ / npm
- Firebase project dengan Firestore
- Google Gemini API key

### Backend (Python)

1. Buka terminal di folder `backend/`.
2. Buat dan aktifkan virtual environment:
   ```powershell
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   ```
3. Install dependency:
   ```powershell
   python -m pip install -r requirements.txt
   ```
4. Siapkan file `.env` atau environment variable yang diperlukan.

### Frontend (Next.js)

1. Buka terminal di folder `frontend/`.
2. Install dependency:
   ```powershell
   npm install
   ```

### Persiapan Server Hosting

Jika ingin deploy aplikasi ke server Linux/VM, pastikan server memiliki dependensi berikut:

- Python 3.11+ dan `python3-venv`
- pip (`python3 -m pip`)
- Node.js 18+ dan npm
- `git` (jika clone repo dari source control)
- `curl` atau `wget`
- `build-essential` untuk paket npm native bila diperlukan

Contoh perintah instalasi pada Ubuntu/Debian:

```bash
sudo apt update
sudo apt install -y python3 python3-venv python3-pip nodejs npm git curl build-essential
```

Setelah dependensi server terpasang, jalankan di folder `backend/`:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

Lalu di folder `frontend/`:

```bash
npm install
```

Untuk production, Anda juga bisa membangun frontend dengan:

```bash
npm run build
npm start
```

Atau gunakan process manager seperti `pm2`, `systemd`, atau `gunicorn`+`nginx` untuk menjalankan backend dan frontend secara terus-menerus.

## Menjalankan Aplikasi

### Opsi 1: Jalankan menggunakan `run.bat`

Di folder root proyek (`d:\TA`), jalankan:

```powershell
run.bat
```

Ini akan membuka dua jendela terminal baru:
- Backend Flask di port `5000`
- Frontend Next.js di port `3000`

### Opsi 2: Jalankan manual

#### Backend

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python app.py
```

#### Frontend

```powershell
cd frontend
npm run dev
```

Buka browser di: `http://localhost:3000`

## Environment Variables

### Backend

Simpan variabel yang diperlukan di file `.env` pada folder `backend/` atau set secara environment:

- `GEMINI_API_KEY` – kunci API Google Gemini utama.
- `GEMINI_API_KEY_1` – kunci API fallback pertama.
- `GEMINI_API_KEY_2` – kunci API fallback kedua.
- `GEMINI_API_KEY_3` – kunci API fallback ketiga.
- `GEMINI_MODEL` – model default, default: `gemini-2.5-flash`.
- `GEMINI_MODEL_1`, `GEMINI_MODEL_2`, `GEMINI_MODEL_3` – model spesifik untuk masing-masing API key.
- `ADMIN_SECRET_TOKEN` – token untuk otorisasi endpoint admin.
- `FIREBASE_KEY_PATH` – jalur ke `firebase-key.json`, default: `firebase-key.json`.

Contoh `.env`:

```dotenv
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash
ADMIN_SECRET_TOKEN=rahasiaupj123
FIREBASE_KEY_PATH=firebase-key.json
```

### Frontend

Letakkan variabel env di file `.env.local` di folder `frontend/`:

- `NEXT_PUBLIC_ALLOWED_EMAILS` – email admin yang diizinkan, pisahkan koma.
- `NEXT_PUBLIC_ADMIN_SECRET_TOKEN` – token yang sama dengan `ADMIN_SECRET_TOKEN` backend.
- `NEXT_PUBLIC_SITE_NAME` – nama site tampilan.

Contoh `.env.local`:

```dotenv
NEXT_PUBLIC_ALLOWED_EMAILS=admin@upj.ac.id,superadmin@upj.ac.id
NEXT_PUBLIC_ADMIN_SECRET_TOKEN=rahasiaupj123
NEXT_PUBLIC_SITE_NAME=Admisi UPJ Assistant
```

## Endpoint Utama Backend

- `POST /chat`
  - Input: request body JSON dengan `message` dan `history`.
  - Output: respons AI dalam format HTML.

- `GET /refresh-cache?token=<ADMIN_SECRET_TOKEN>`
  - Reset cache FAQ di backend dan muat ulang data dari Firestore.

- `POST /api/scrape`
  - Input: URL target.
  - Header: `Authorization: Bearer <ADMIN_SECRET_TOKEN>`.
  - Fungsi: scraping halaman web, ekstraksi FAQ, preview hasil untuk admin.

## Panduan Pengguna

### User Chatbot

1. Buka `http://localhost:3000/mainpage`.
2. Mulai obrolan dengan mengetikkan pertanyaan tentang penerimaan, jurusan, biaya, atau prosedur UPJ.
3. Gunakan quick reply jika tersedia.
4. Jika ingin, kirim data diri melalui form leads.
5. Beri feedback pada jawaban chatbot untuk membantu perbaikan.

### Admin Dashboard

1. Buka `http://localhost:3000/login`.
2. Login dengan akun Google yang terdaftar pada `NEXT_PUBLIC_ALLOWED_EMAILS`.
3. Akses dashboard.
4. Kelola data:
   - `FAQ`: tambah, edit, hapus knowledge base.
   - `Leads`: lihat dan ekspor data calon mahasiswa.
   - `Chat Logs`: review percakapan user dengan chatbot.
   - `Feedback`: cek penilaian jawaban chatbot.
   - `Scraper`: masukkan URL dan generate FAQ baru dari halaman web.

## Panduan Teknis

### Mengedit Persona Chatbot

Modifikasi `backend/prompt_rules.txt` jika ingin mengubah gaya bahasa, aturan jawaban, atau batasan domain.

### Menambahkan atau Memperbarui FAQ

- Ubah langsung di Firestore collection `faq`.
- Atau gunakan dashboard admin untuk menambah / menyunting FAQ.
- Untuk cache FAQ di backend, panggil endpoint `GET /refresh-cache?token=<ADMIN_SECRET_TOKEN>`.

### Memeriksa Koneksi Layanan

Gunakan `backend/cek_koneksi.py` untuk memeriksa:
- koneksi Firebase Firestore
- akses ke Google Gemini API
- impor module penting

## Catatan Keamanan

- `backend/firebase-key.json` bersifat sensitif dan tidak boleh di-commit ke repositori publik.
- `ADMIN_SECRET_TOKEN` sebaiknya diatur dengan nilai unik di environment.
- `NEXT_PUBLIC_ADMIN_SECRET_TOKEN` akan terekspos pada frontend; hanya gunakan untuk validasi frontend admin dan jangan simpan nilai rahasia yang sama di repo.

## Troubleshooting

### Backend tidak bisa dijalankan

- Pastikan virtual environment aktif.
- Pastikan dependency `pip install -r requirements.txt` selesai.
- Pastikan `firebase-key.json` valid dan `FIREBASE_KEY_PATH` benar.
- Pastikan `GEMINI_API_KEY` tersedia.

### Frontend tidak dapat login admin

- Pastikan email admin ada di `NEXT_PUBLIC_ALLOWED_EMAILS`.
- Pastikan `NEXT_PUBLIC_ADMIN_SECRET_TOKEN` cocok dengan backend.

### Chatbot tidak memberikan jawaban

- Periksa log backend.
- Pastikan Firestore `faq` terisi dan model Gemini merespons.

## Dependensi Kunci

### Backend
- Flask
- Flask-Cors
- Flask-Limiter
- firebase-admin
- google-genai
- google-generativeai
- python-dotenv
- requests
- beautifulsoup4
- selenium
- webdriver-manager

### Frontend
- next@16.1.6
- react@19.2.3
- firebase
- recharts
- xlsx
- tailwindcss

## Referensi

- `backend/requirements.txt`
- `frontend/package.json`
- `PROJECT_INDEX.md`
- `backend/prompt_rules.txt`
- `run.bat`

---

Jika ingin pengayaan README lagi, seperti diagram arsitektur, checklist deployment, atau contoh file `.env`, beri tahu saya dan saya akan tambahkan.
