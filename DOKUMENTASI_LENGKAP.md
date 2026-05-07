# 📚 Dokumentasi Lengkap - Chatbot Admisi UPJ

**Terakhir diperbarui:** 6 Mei 2026

---

## 📋 Daftar Isi

1. [Ringkasan Proyek](#ringkasan-proyek)
2. [Arsitektur Sistem](#arsitektur-sistem)
3. [Struktur Folder & File](#struktur-folder--file)
4. [Backend - Flask Python](#backend---flask-python)
5. [Frontend - Next.js](#frontend---nextjs)
6. [Database & API Services](#database--api-services)
7. [Instalasi & Setup](#instalasi--setup)
8. [Penggunaan & API Endpoint](#penggunaan--api-endpoint)
9. [Deployment](#deployment)
10. [Troubleshooting](#troubleshooting)
11. [Developer Guide](#developer-guide)

---

## 🎯 Ringkasan Proyek

### Deskripsi

**Chatbot Admisi UPJ** adalah aplikasi fullstack yang membantu calon mahasiswa Universitas Pembangunan Jaya (UPJ) mendapatkan informasi tentang:
- Program akademik dan jurusan
- Proses pendaftaran & penerimaan
- Biaya pendidikan
- Fasilitas kampus
- Tanya jawab umum (FAQ)

### Tujuan

Mengotomatisasi proses respons pertanyaan admisi melalui chatbot AI yang didukung oleh Google Gemini, sehingga calon mahasiswa mendapat jawaban instan 24/7.

### Tech Stack

| Komponen | Teknologi | Versi |
|----------|-----------|-------|
| **Backend** | Flask (Python) | 2.3.3+ |
| **Frontend** | Next.js (React) | 16.1.6+ |
| **Database** | Firebase Firestore | - |
| **AI Model** | Google Gemini | 2.5-flash |
| **Authentication** | Firebase Auth + Google | - |
| **Styling** | Tailwind CSS | 3.4.19+ |
| **Charting** | Recharts | 3.8.1+ |

---

## 🏗️ Arsitektur Sistem

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER BROWSER                             │
│  (Frontend Next.js: mainpage.tsx + dashboard.tsx)               │
└────────────────────┬────────────────────────────────────────────┘
                     │ HTTP/HTTPS
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND FLASK                                │
│  (Python - app.py)                                              │
│  ├─ POST /chat → Chatbot AI Response                            │
│  ├─ POST /api/scrape → URL Scraping                             │
│  ├─ GET /refresh-cache → Cache Refresh                          │
│  └─ Admin Endpoints                                             │
└────────────────────┬────────────────────────────────────────────┘
        ┌────────────┴────────────┬────────────────┐
        │                         │                │
        ▼                         ▼                ▼
┌──────────────────┐   ┌──────────────────┐  ┌──────────────────┐
│  FIREBASE        │   │  GOOGLE GEMINI   │  │  WEB SCRAPER     │
│  FIRESTORE       │   │  API (gen-ai)    │  │  (beautifulsoup) │
│  ├─ FAQ          │   │  ├─ Chat Gen     │  │                  │
│  ├─ Chat Logs    │   │  ├─ FAQ Extract  │  │  External URLs   │
│  ├─ Leads        │   │  └─ Content      │  │  for Knowledge   │
│  └─ Feedback     │   │    Analysis      │  │  Base Updates    │
└──────────────────┘   └──────────────────┘  └──────────────────┘
```

### Alur Komunikasi

1. **User Input** → Frontend mengirim pesan ke Backend `/chat`
2. **FAQ Retrieval** → Backend mengambil FAQ dari Firestore Cache (refresh 1 jam)
3. **Prompt Generation** → Backend membuat system prompt dari `prompt_rules.txt` + FAQ
4. **AI Processing** → Backend panggil Google Gemini untuk generate response
5. **Response Format** → Backend format response ke HTML
6. **Display** → Frontend menampilkan response di chatbot UI
7. **Logging** → Chat history disimpan ke Firestore

---

## 📁 Struktur Folder & File

```
Chatbot-Ai-UPJ/
├── backend/
│   ├── app.py                      # Flask server utama
│   ├── auto_scraper.py             # Script batch scraping
│   ├── cek_koneksi.py              # Diagnosis koneksi
│   ├── prompt_rules.txt            # Template system prompt
│   ├── requirements.txt            # Python dependencies
│   ├── firebase-key.json           # Service account Firebase (⚠️ SENSITIF)
│   ├── .env                        # Environment variables
│   ├── install_backend.sh          # Setup script Linux/macOS
│   ├── Procfile                    # Konfigurasi deployment
│   └── .venv/                      # Virtual environment Python
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── mainpage.tsx        # UI Chatbot publik
│   │   │   ├── dashboard.tsx       # Admin dashboard
│   │   │   ├── login.tsx           # Admin login (Google Auth)
│   │   │   ├── _app.tsx            # Next.js app wrapper
│   │   │   ├── _document.tsx       # HTML document setup
│   │   │   └── index.tsx           # Redirect ke mainpage
│   │   ├── lib/
│   │   │   └── firebase.ts         # Firebase initialization
│   │   └── styles/
│   │       ├── globals.css         # Global styles
│   │       ├── mainpage.css        # Chatbot page styles
│   │       ├── mainpage.module.css # Chatbot modules
│   │       └── dashboard.module.css # Dashboard modules
│   ├── public/
│   │   └── images/                 # Static images
│   ├── package.json                # Node.js dependencies
│   ├── tsconfig.json               # TypeScript config
│   ├── next.config.ts              # Next.js config
│   ├── tailwind.config.js          # Tailwind CSS config
│   ├── postcss.config.mjs          # PostCSS config
│   └── .next/                      # Build output
│
├── chatbot_admisi/                 # (Folder kosong/legacy)
│
├── root files/
│   ├── package.json                # Root dev dependencies
│   ├── README.md                   # README original
│   ├── PROJECT_INDEX.md            # Project architecture overview
│   ├── PROPOSAL_PROMPT.md          # Project proposal
│   ├── run.bat                     # Windows startup script
│   ├── DOKUMENTASI_LENGKAP.md      # 📄 File ini
│   ├── PANDUAN_FRONTEND.md         # Frontend detailed guide
│   ├── PANDUAN_BACKEND.md          # Backend detailed guide
│   ├── PANDUAN_API.md              # API endpoint reference
│   ├── PANDUAN_FIREBASE.md         # Firebase setup & usage
│   └── PANDUAN_DEPLOYMENT.md       # Deployment guide
│
├── .git/                           # Git version control
├── .gitignore                      # Git ignore rules
├── .venv/                          # Python virtual environment (root)
└── venv/                           # Alternative venv folder
```

---

## 🔧 Backend - Flask Python

### File Utama: `backend/app.py`

#### Fungsi Utama

| Fungsi | Deskripsi |
|--------|-----------|
| `initialize_firebase()` | Koneksi ke Firebase Firestore via service account |
| `load_prompt_rules()` | Load system prompt dari `prompt_rules.txt` |
| `get_faq_cache()` | Ambil FAQ dari cache RAM (dengan TTL 1 jam) |
| `refresh_faq_cache()` | Reload FAQ dari Firestore ke cache |
| `generate_system_prompt()` | Buat dynamic system prompt dengan FAQ current |
| `call_gemini_chat()` | Panggil API Gemini untuk generate response |
| `sanitize_response()` | Format & sanitasi response HTML |
| `save_chat_log()` | Simpan interaksi ke Firestore |

#### Endpoint API

##### 1. **POST `/chat`**
Endpoint utama untuk chatbot message.

**Request Body:**
```json
{
  "message": "Apa saja jurusan di UPJ?",
  "history": [
    {"role": "user", "content": "Halo"},
    {"role": "assistant", "content": "Halo Kak! Apa yang bisa aku bantu?"}
  ]
}
```

**Response:**
```json
{
  "response": "<p>UPJ memiliki berbagai jurusan...</p>",
  "timestamp": "2026-05-06T10:30:00Z"
}
```

**Rate Limit:** 10 request/minute per IP

**Validasi:**
- Message harus ada dan < 500 karakter
- History max 4 pesan terakhir

---

##### 2. **GET `/refresh-cache`**
Refresh FAQ cache dari Firestore.

**Query Parameters:**
```
token=<ADMIN_SECRET_TOKEN>
```

**Response:**
```json
{
  "status": "success",
  "message": "Cache refreshed",
  "faq_count": 45,
  "timestamp": "2026-05-06T10:30:00Z"
}
```

**Keamanan:** Require `ADMIN_SECRET_TOKEN`

---

##### 3. **POST `/api/scrape`**
Scrape URL dan extract FAQ.

**Headers:**
```
Authorization: Bearer <ADMIN_SECRET_TOKEN>
Content-Type: application/json
```

**Request Body:**
```json
{
  "url": "https://upj.ac.id/program-studi"
}
```

**Response:**
```json
{
  "preview_faq": [
    {
      "question": "Apa itu Program S1?",
      "answer": "Program sarjana selama 4 tahun...",
      "category": "Academic"
    }
  ],
  "source_url": "https://upj.ac.id/program-studi",
  "status": "preview"
}
```

**Proses:**
1. Scrape konten HTML (p, h1-h3, li tags)
2. Kirim ke Gemini untuk extract FAQ JSON
3. Return preview untuk admin review

---

### File Pendukung

#### `auto_scraper.py`
Script standalone untuk bulk scraping.

**Fungsi:**
```python
scrape_and_save_faq(urls: list, batch_size: int = 5)
```

**Penggunaan:**
```bash
python auto_scraper.py --urls "https://upj.ac.id/..."
```

#### `prompt_rules.txt`
Template system prompt untuk chatbot.

**Aturan Ketat:**
1. Hanya jawab pertanyaan terkait UPJ
2. Tolak topik luar UPJ dengan halus
3. Jangan halusinasi
4. Gaya bahasa ramah, sapaan "Kak"
5. CTA: Link daftar & kontak
6. Rekomendasi Sistem Informasi jika ditanya banding SI vs Informatika

#### `requirements.txt`
Dependencies Python backend.

**Packages Kunci:**
```
Flask==2.3.3
Flask-CORS==4.0.0
Flask-Limiter==4.1.1
firebase-admin==7.1.0
google-genai==1.66.0
beautifulsoup4==4.14.3
```

---

## 🎨 Frontend - Next.js

### File Utama

#### `src/pages/mainpage.tsx`
Halaman chatbot publik.

**Fitur:**
- Chat UI dengan message history
- Auto-scroll ke message terbaru
- Loading state saat awaiting response
- Error handling & retry logic
- Mobile-responsive design
- Typing indicator

**Component Structure:**
```
mainpage.tsx
├── ChatContainer
├── MessageList
│   └── Message (user/assistant)
├── InputForm
└── FeedbackWidget
```

**State Management:**
```typescript
const [messages, setMessages] = useState([])
const [input, setInput] = useState('')
const [loading, setLoading] = useState(false)
const [history, setHistory] = useState([])
```

---

#### `src/pages/dashboard.tsx`
Admin dashboard untuk management.

**Fitur:**
- 📋 FAQ Management (Create/Read/Update/Delete)
- 📊 Chat Analytics & Logs
- 👥 Leads Management
- ⭐ Feedback & Reviews
- 🔄 Scraper Management
- 📥 Export ke Excel (XLSX)
- 🔐 Role-based access

**Tabs:**
1. **FAQ Manager** - CRUD FAQ, preview AI responses
2. **Chat Logs** - View semua chat history, search filter
3. **Leads** - Contact info dari user, export
4. **Feedback** - User ratings & comments
5. **Scraper** - URL scraping, batch upload
6. **Analytics** - Chart trending questions

---

#### `src/pages/login.tsx`
Admin authentication page.

**Fitur:**
- Google OAuth 2.0 login
- Email allowlist validation
- Firestore user role check
- Redirect ke dashboard setelah login

**Flow:**
1. User klik "Login with Google"
2. Google Auth popup
3. Backend verify email di allowlist
4. Create session & redirect ke dashboard

---

#### `src/lib/firebase.ts`
Firebase SDK initialization.

**Init Konfigurasi:**
```typescript
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: "xxx.firebaseapp.com",
  projectId: "xxx",
  storageBucket: "xxx.appspot.com",
  messagingSenderId: "xxx",
  appId: "xxx"
}
```

**Services:**
- `initializeApp()` - App initialization
- `getAuth()` - Authentication
- `getFirestore()` - Database access
- `onAuthStateChanged()` - Auth state listener

---

### Styling

#### Global Styles
- `globals.css` - Reset, typography, colors

#### Component Styles
- `mainpage.module.css` - Chatbot page
- `dashboard.module.css` - Admin dashboard

#### Tailwind Config
- `tailwind.config.js` - Theme, colors, breakpoints
- `postcss.config.mjs` - PostCSS plugins

---

## 🔐 Database & API Services

### Firebase Firestore Collections

#### 1. **`faqs`** Collection
Knowledge base chatbot.

**Document Schema:**
```json
{
  "id": "faq_001",
  "question": "Apa saja jurusan di UPJ?",
  "answer": "UPJ memiliki program studi di bidang...",
  "category": "Academic",
  "tags": ["jurusan", "program"],
  "created_at": "2026-01-15T10:00:00Z",
  "updated_at": "2026-05-06T10:00:00Z",
  "ai_generated": true,
  "source_url": "https://upj.ac.id/...",
  "status": "active"
}
```

---

#### 2. **`chat_logs`** Collection
Riwayat chat dengan user.

**Document Schema:**
```json
{
  "id": "chat_log_001",
  "session_id": "sess_abc123",
  "user_message": "Berapa biaya pendaftaran?",
  "assistant_response": "Biaya pendaftaran adalah...",
  "timestamp": "2026-05-06T10:30:00Z",
  "response_time_ms": 1250,
  "model_used": "gemini-2.5-flash",
  "user_ip": "192.168.1.1",
  "feedback": {
    "rating": 4,
    "helpful": true,
    "comment": "Jawaban sangat membantu"
  }
}
```

---

#### 3. **`leads`** Collection
Data calon mahasiswa yang tertarik.

**Document Schema:**
```json
{
  "id": "lead_001",
  "name": "Budi Santoso",
  "email": "budi@example.com",
  "phone": "+62812345678",
  "source": "chatbot",
  "interested_program": "Sistem Informasi",
  "message": "Saya tertarik untuk mendaftar",
  "collected_at": "2026-05-06T10:30:00Z",
  "status": "new"
}
```

---

#### 4. **`feedback`** Collection
Rating & review dari user.

**Document Schema:**
```json
{
  "id": "feedback_001",
  "user_session": "sess_abc123",
  "rating": 5,
  "accuracy": 4,
  "helpfulness": 5,
  "comment": "Bot sangat helpful!",
  "timestamp": "2026-05-06T10:30:00Z"
}
```

---

#### 5. **`admin_users`** Collection
Admin access control.

**Document Schema:**
```json
{
  "email": "admin@upj.ac.id",
  "role": "superadmin",
  "permissions": ["faq_manage", "chat_view", "lead_export"],
  "created_at": "2026-01-01T00:00:00Z",
  "last_login": "2026-05-06T10:00:00Z",
  "status": "active"
}
```

---

### Google Gemini Integration

**Model:** `gemini-2.5-flash`

**Fallback Multi-Key System:**
- Primary Key: `GEMINI_API_KEY_1`
- Secondary Key: `GEMINI_API_KEY_2`
- Tertiary Key: `GEMINI_API_KEY_3`

**Backup per Key Models:**
- `GEMINI_MODEL_1`, `GEMINI_MODEL_2`, `GEMINI_MODEL_3`

**Rate Limit Mitigation:**
- Key rotation ketika rate limit tercapai
- Request queuing
- Exponential backoff

---

## 🚀 Instalasi & Setup

### Prasyarat

- **OS:** Windows 10+, macOS 10.15+, atau Linux (Ubuntu 20.04+)
- **Python:** 3.11+ (recommended 3.13)
- **Node.js:** 18+ LTS
- **Git:** 2.34+
- **Firebase Project:** Active dengan Firestore enabled
- **Google Gemini API Key:** Dari [Google AI Studio](https://aistudio.google.com)

### Instalasi Windows

#### Step 1: Clone Repository
```powershell
git clone https://github.com/yourrepo/Chatbot-Ai-UPJ.git
cd Chatbot-Ai-UPJ
```

#### Step 2: Setup Backend
```powershell
cd backend

# Buat virtual environment
python -m venv .venv

# Activate virtual environment
.\.venv\Scripts\Activate.ps1

# Install dependencies
python -m pip install --upgrade pip
pip install -r requirements.txt
```

#### Step 3: Konfigurasi Environment Backend
Buat file `.env` di folder `backend/`:

```env
# Firebase Configuration
FIREBASE_CREDENTIALS_PATH=./firebase-key.json

# Gemini API Keys (support multi-key failover)
GEMINI_API_KEY_1=sk-proj-xxx...
GEMINI_API_KEY_2=sk-proj-yyy...
GEMINI_API_KEY_3=sk-proj-zzz...

# Gemini Models (optional)
GEMINI_MODEL=gemini-2.5-flash
GEMINI_MODEL_1=gemini-2.5-flash
GEMINI_MODEL_2=gemini-2.5-flash
GEMINI_MODEL_3=gemini-2.5-flash

# Backend Configuration
FLASK_ENV=development
FLASK_DEBUG=True
FLASK_PORT=5000

# Admin Security
ADMIN_SECRET_TOKEN=your-secret-token-here

# CORS Settings
CORS_ORIGINS=http://localhost:3000,http://localhost:8000
```

#### Step 4: Setup Firebase Service Account
1. Ke [Firebase Console](https://console.firebase.google.com)
2. Pilih project
3. Project Settings → Service Accounts → Generate New Private Key
4. Rename ke `firebase-key.json`
5. Tempatkan di folder `backend/`

#### Step 5: Setup Frontend
```powershell
cd ../frontend

# Install dependencies
npm install

# Konfigurasi environment variables
# Buat file .env.local
```

Buat `.env.local` di `frontend/`:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=xxx
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=xxx.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=xxx
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=xxx.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=xxx
NEXT_PUBLIC_FIREBASE_APP_ID=xxx

# Backend API URL
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000
```

#### Step 6: Jalankan Aplikasi

**Option A: Terpisah**

Terminal 1 (Backend):
```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python app.py
# Backend akan run di http://localhost:5000
```

Terminal 2 (Frontend):
```powershell
cd frontend
npm run dev
# Frontend akan run di http://localhost:3000
```

**Option B: Sekaligus (Using run.bat)**
```powershell
cd d:\Chatbot-Ai-UPJ
.\run.bat
```

#### Step 7: Test Aplikasi
- Buka browser → http://localhost:3000/mainpage
- Test chat dengan bot
- Login admin di http://localhost:3000/login

---

### Instalasi Linux/macOS

```bash
# Clone repo
git clone https://github.com/yourrepo/Chatbot-Ai-UPJ.git
cd Chatbot-Ai-UPJ

# Backend setup
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Create .env file
cp .env.example .env
nano .env  # Edit sesuai config

# Frontend setup
cd ../frontend
npm install
# Create .env.local
echo "NEXT_PUBLIC_FIREBASE_API_KEY=xxx" > .env.local
echo "NEXT_PUBLIC_API_BASE_URL=http://localhost:5000" >> .env.local

# Run
# Terminal 1:
cd backend && source .venv/bin/activate && python app.py

# Terminal 2:
cd frontend && npm run dev
```

---

## 📡 Penggunaan & API Endpoint

### Chatbot API

#### Chat Endpoint

```bash
curl -X POST http://localhost:5000/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Apa saja jurusan di UPJ?",
    "history": [
      {"role": "user", "content": "Halo"},
      {"role": "assistant", "content": "Halo Kak!"}
    ]
  }'
```

**Response Success:**
```json
{
  "response": "<p>UPJ memiliki berbagai program studi di bidang...</p>",
  "timestamp": "2026-05-06T10:30:00Z"
}
```

**Response Error:**
```json
{
  "error": "Message too long (max 500 chars)",
  "status": 400
}
```

---

#### Cache Refresh Endpoint

```bash
curl -X GET "http://localhost:5000/refresh-cache?token=rahasiaupj123"
```

**Response:**
```json
{
  "status": "success",
  "message": "Cache refreshed successfully",
  "faq_count": 45,
  "timestamp": "2026-05-06T10:30:00Z",
  "duration_ms": 850
}
```

---

#### Scraping Endpoint

```bash
curl -X POST http://localhost:5000/api/scrape \
  -H "Authorization: Bearer rahasiaupj123" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://upj.ac.id/program-studi"}'
```

**Response:**
```json
{
  "status": "preview",
  "source_url": "https://upj.ac.id/program-studi",
  "extracted_faq": [
    {
      "question": "Apa itu Program S1?",
      "answer": "Program sarjana selama 4 tahun...",
      "category": "Academic"
    }
  ],
  "extraction_confidence": 0.95
}
```

---

### Frontend API Usage

#### Send Chat Message

```typescript
// mainpage.tsx
const sendMessage = async (message: string) => {
  setLoading(true)
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_BASE_URL}/chat`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          history: messages.map(m => ({
            role: m.role,
            content: m.content
          }))
        })
      }
    )
    const data = await response.json()
    setMessages([...messages, { role: 'assistant', content: data.response }])
  } catch (error) {
    console.error('Error:', error)
  } finally {
    setLoading(false)
  }
}
```

---

## 🌐 Deployment

### Deploy ke Vercel (Frontend)

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
cd frontend
vercel

# Set environment variables di Vercel dashboard
# - NEXT_PUBLIC_FIREBASE_API_KEY
# - NEXT_PUBLIC_API_BASE_URL
```

---

### Deploy Backend ke Heroku / Render

#### Menggunakan Procfile
```
web: python app.py
```

#### Deploy ke Render

1. Push ke GitHub
2. Connect repo ke Render
3. Set environment variables
4. Deploy

```
GEMINI_API_KEY_1=xxx
ADMIN_SECRET_TOKEN=xxx
FIREBASE_CREDENTIALS_PATH=./firebase-key.json
```

---

### Deploy ke VPS / Server Linux

```bash
# SSH ke server
ssh user@your-server.com

# Clone repository
git clone https://github.com/yourrepo/Chatbot-Ai-UPJ.git
cd Chatbot-Ai-UPJ

# Install system dependencies
sudo apt update
sudo apt install -y python3 python3-venv python3-pip nodejs npm

# Setup backend
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pip install gunicorn

# Setup frontend
cd ../frontend
npm install
npm run build

# Start dengan PM2 (process manager)
npm install -g pm2

# Create ecosystem.config.js
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'chatbot-backend',
      script: 'backend/app.py',
      interpreter: 'python3',
      cwd: '/path/to/Chatbot-Ai-UPJ',
      instances: 1,
      env: {
        FLASK_ENV: 'production'
      }
    }
  ]
}
EOF

# Start
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# Setup Nginx reverse proxy
sudo apt install nginx
sudo nano /etc/nginx/sites-available/chatbot

# Config:
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
    }

    location /api {
        proxy_pass http://localhost:5000;
    }
}

sudo ln -s /etc/nginx/sites-available/chatbot /etc/nginx/sites-enabled/
sudo systemctl restart nginx
```

---

## 🔧 Troubleshooting

### Backend Issues

#### Error: "Firebase credentials not found"

**Solusi:**
1. Pastikan `firebase-key.json` ada di folder `backend/`
2. Set environment variable:
   ```powershell
   $env:FIREBASE_CREDENTIALS_PATH="./firebase-key.json"
   ```
3. Restart Flask server

---

#### Error: "Gemini API key invalid"

**Solusi:**
1. Verify API key dari [Google AI Studio](https://aistudio.google.com)
2. Pastikan sudah enable Gemini API di Google Cloud
3. Check rate limit quota
4. Test dengan curl:
   ```bash
   curl -H "x-goog-api-key: YOUR_KEY" \
     https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent
   ```

---

#### Error: "CORS error" / "No 'Access-Control-Allow-Origin' header"

**Solusi:**
1. Backend harus set CORS header:
   ```python
   CORS(app, resources={r"/*": {"origins": ["http://localhost:3000"]}})
   ```
2. Frontend harus send request dengan proper headers
3. Verify domain di CORS_ORIGINS env var

---

### Frontend Issues

#### Error: "Cannot find module firebase"

**Solusi:**
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

---

#### Error: "Next.js build fails"

**Solusi:**
```bash
cd frontend
npm cache clean --force
npm install
NEXT_DISABLE_TURBOPACK=1 npm run build
npm start
```

---

#### Error: "Blank page / 404"

**Solusi:**
1. Check routes di `pages/` folder
2. Verify routing: `/mainpage` → `pages/mainpage.tsx`
3. Restart dev server

---

### Firebase Issues

#### Error: "Permission denied" di Firestore

**Solusi:**
1. Check Firestore Security Rules:
   ```
   match /databases/{database}/documents {
     match /faqs/{document=**} {
       allow read: if true;
       allow write: if request.auth != null;
     }
   }
   ```
2. Verify user role di `admin_users` collection

---

## 👨‍💻 Developer Guide

### Project Setup untuk Development

```bash
# Clone & setup
git clone <repo>
cd Chatbot-Ai-UPJ

# Install pre-commit hooks
pre-commit install

# Setup both environments
python -m venv backend/.venv
npm install --prefix frontend
```

---

### Code Structure Best Practices

#### Backend (Python/Flask)

```python
# ✅ Good
@app.route('/chat', methods=['POST'])
def handle_chat():
    """Handle user chat message and return AI response."""
    message = request.json.get('message', '')
    
    # Validate
    if not message or len(message) > 500:
        return {'error': 'Invalid message'}, 400
    
    # Process
    response = generate_response(message)
    
    # Return
    return {'response': response}

# ❌ Bad
@app.route('/chat', methods=['POST'])
def chat():
    msg = request.json.get('message')
    return {'response': generate_response(msg)}
```

---

#### Frontend (Next.js/React)

```typescript
// ✅ Good
export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  
  const sendMessage = async (message: string) => {
    setLoading(true)
    try {
      const response = await fetchChat(message)
      setMessages(prev => [...prev, response])
    } catch (error) {
      console.error('Chat error:', error)
    } finally {
      setLoading(false)
    }
  }
  
  return <ChatUI messages={messages} onSend={sendMessage} loading={loading} />
}

// ❌ Bad
export default function Chat() {
  const sendMsg = () => {
    fetch('/chat').then(r => r.json()).then(d => console.log(d))
  }
  return <div onClick={sendMsg}>Send</div>
}
```

---

### Commit Message Convention

```
format: [TYPE] Subject

TYPE:
  feat:   New feature
  fix:    Bug fix
  docs:   Documentation
  style:  Code style (formatting)
  refactor: Code refactoring
  test:   Test addition
  chore:  Maintenance

Example:
  feat: Add user chat rating feature
  fix: Handle Firebase connection timeout
  docs: Update API endpoint documentation
```

---

### Testing

#### Backend Tests
```bash
cd backend
pytest tests/
```

#### Frontend Tests
```bash
cd frontend
npm test
```

---

### Debugging Tips

**Backend:**
- Enable logging: `logging.basicConfig(level=logging.DEBUG)`
- Use `flask shell` untuk REPL
- Set `FLASK_DEBUG=True` untuk auto-reload

**Frontend:**
- Chrome DevTools: F12
- React DevTools extension
- Check `NEXT_DEBUG_MODE=1`

---

## 📖 Referensi Tambahan

### Links Penting

- [Firebase Documentation](https://firebase.google.com/docs)
- [Google Gemini API](https://ai.google.dev/)
- [Next.js Docs](https://nextjs.org/docs)
- [Flask Docs](https://flask.palletsprojects.com/)
- [Tailwind CSS](https://tailwindcss.com/docs)

### File Config Penting

| File | Deskripsi |
|------|-----------|
| `backend/.env` | Backend environment variables |
| `frontend/.env.local` | Frontend environment variables |
| `backend/firebase-key.json` | Firebase service account (⚠️ SENSITIF) |
| `backend/prompt_rules.txt` | Chatbot behavior rules |
| `frontend/next.config.ts` | Next.js config (API routes, rewrites) |
| `frontend/tailwind.config.js` | Tailwind CSS theme config |

---

## 📞 Support & Contact

Untuk pertanyaan atau masalah:
1. Check dokumentasi di README.md
2. Lihat issue di GitHub
3. Contact admin team UPJ

---

**Document Version:** 1.0
**Last Updated:** 6 Mei 2026
**Maintainer:** Development Team

---
