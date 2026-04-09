from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import requests
import os
import json
import logging
import re
import time
from dotenv import load_dotenv
from bs4 import BeautifulSoup
import firebase_admin
from firebase_admin import credentials, firestore
from google import genai
from google.genai import types

# Import auto_scraper module
from auto_scraper import scrape_url

# =====================================================================
# 1. KONFIGURASI AWAL & DATABASE
# =====================================================================
load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)


GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
ADMIN_SECRET_TOKEN = os.getenv("ADMIN_SECRET_TOKEN", "rahasiaupj123") 
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

# Inisialisasi API Gemini
GEMINI_CLIENT = None
if GEMINI_API_KEY:
    GEMINI_CLIENT = genai.Client(api_key=GEMINI_API_KEY)

def _env_file_path():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(base_dir, ".env")

def _mask_secret(secret_value):
    if not secret_value:
        return ""
    if len(secret_value) <= 8:
        return "*" * len(secret_value)
    return f"{secret_value[:4]}{'*' * (len(secret_value) - 8)}{secret_value[-4:]}"

def _upsert_env_value(key, value):
    env_path = _env_file_path()
    lines = []

    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            lines = f.readlines()

    key_prefix = f"{key}="
    updated = False
    new_line = f"{key}={value}\n"
    new_lines = []

    for line in lines:
        if line.strip().startswith(key_prefix):
            new_lines.append(new_line)
            updated = True
        else:
            new_lines.append(line)

    if not updated:
        new_lines.append(new_line)

    with open(env_path, "w", encoding="utf-8") as f:
        f.writelines(new_lines)

def _reload_runtime_settings():
    global GEMINI_API_KEY, GEMINI_CLIENT, ADMIN_SECRET_TOKEN, GEMINI_MODEL
    load_dotenv(override=True)
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
    ADMIN_SECRET_TOKEN = os.getenv("ADMIN_SECRET_TOKEN", "rahasiaupj123")
    GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    GEMINI_CLIENT = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None

def _is_admin_authorized(req):
    token = req.headers.get("Authorization", "")
    return token == f"Bearer {ADMIN_SECRET_TOKEN}"

# --- KONEKSI FIREBASE ---
try:
    if not firebase_admin._apps:
        cred = credentials.Certificate("firebase-key.json")
        firebase_admin.initialize_app(cred)
    db = firestore.client()
    logger.info("✅ Berhasil terhubung ke Firebase Firestore!")
except Exception as e:
    logger.error(f"❌ Gagal koneksi ke Firebase: {e}")
    db = None


# =====================================================================
# 2. SISTEM KEAMANAN (CORS & RATE LIMITING)
# =====================================================================
ALLOWED_ORIGINS = [
    "http://localhost:3000",        
    "http://127.0.0.1:3000",
    "http://192.168.1.8:3000",      
    "http://43.156.170.74.nip.io:3000",  # <-- Tambahkan alamat domain VPS Anda
    "http://43.156.170.74:3000"          # <-- Tambahkan IP asli VPS (untuk jaga-jaga)
]

CORS(app, resources={
    r"/*": {
        "origins": ALLOWED_ORIGINS,
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["500 per day", "70 per hour"], 
    storage_uri="memory://" 
)

@app.errorhandler(429)
def ratelimit_handler(e):
    logger.warning("🚨 Terdeteksi Spam (Rate Limit Hit)! IP diblokir sementara.")
    return jsonify({
        "response": "Wah, nanyanya cepet banget! 😅 Mesin AI-nya butuh napas bentar nih. Tunggu sekitar satu menit lagi ya baru ketik pesan baru!"
    }), 429


# =====================================================================
# 3. SISTEM CACHING DATABASE
# =====================================================================
FAQ_CACHE = None
LAST_FETCH_TIME = 0
CACHE_DURATION = 3600 # 1 Jam

def load_knowledge_base():
    global FAQ_CACHE, LAST_FETCH_TIME
    current_time = time.time()
    
    if FAQ_CACHE is not None and (current_time - LAST_FETCH_TIME) < CACHE_DURATION:
        logger.info("⚡ Mengambil data FAQ dari Cache RAM")
        return FAQ_CACHE

    base_data = {"organization": {"name": "UPJ"}, "faq": []}
    
    if db is None: return base_data

    try:
        faqs_ref = db.collection("faq") 
        docs = faqs_ref.stream()
        
        faqs = []
        for doc in docs:
            data = doc.to_dict()
            if 'q' in data and 'a' in data:
                faqs.append({"q": str(data['q']).strip(), "a": str(data['a']).strip()})
            
        base_data['faq'] = faqs
        FAQ_CACHE = base_data
        LAST_FETCH_TIME = current_time
        
        logger.info(f"🔄 Cache Diperbarui: Memuat {len(faqs)} FAQ dari Firebase")
    except Exception as e:
        logger.error(f"❌ Error baca data dari Firestore: {e}")
        if FAQ_CACHE is not None: return FAQ_CACHE
            
    return base_data


# =====================================================================
# 4. FORMATTER & SYSTEM PROMPT
# =====================================================================
def format_response_html(text):
    if not text: return ""
    text = text.replace('\n', '<br>')
    text = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', text)
    text = re.sub(
        r'\[([^\]]+)\]\((https?://[^\)]+)\)', 
        r'<a href="\2" target="_blank" class="text-blue-600 hover:text-blue-800 underline font-semibold">\1</a>', 
        text
    )
    text = re.sub(
        r'(?<!href=")(?<!src=")(https?://[^\s<"]+)', 
        r'<a href="\1" target="_blank" class="text-blue-600 hover:text-blue-800 underline font-semibold">\1</a>', 
        text
    )
    return text

def get_system_prompt():
    current_data = load_knowledge_base() 
    data_str = json.dumps(current_data, ensure_ascii=False)
    
    try:
        base_dir = os.path.dirname(os.path.abspath(__file__))
        prompt_path = os.path.join(base_dir, "prompt_rules.txt")
        
        with open(prompt_path, "r", encoding="utf-8") as file:
            prompt_template = file.read()
            
        final_prompt = prompt_template.replace("{knowledge_base}", data_str)
        return final_prompt
        
    except Exception as e:
        logger.error(f"❌ Gagal membaca prompt_rules.txt: {e}")
        return f"PERAN: Asisten Virtual Admisi UPJ.\nDATA: {data_str}"


# =====================================================================
# 5. FUNGSI PANGGIL AI (HANYA GEMINI)
# =====================================================================
def call_ai(user_msg, history=[]):
    if not GEMINI_CLIENT: return "Mohon maaf, API Key belum dikonfigurasi."
    try:
        formatted_contents = []

        # Gemini butuh riwayat yang konsisten (harus diawali user)
        safe_history = list(history)
        while len(safe_history) > 0 and safe_history[0]["role"] == "assistant":
            safe_history.pop(0)

        for h in safe_history:
            role = "user" if h["role"] == "user" else "model"
            clean_content = re.sub(r'<[^>]+>', '', str(h.get("content", ""))).strip()
            if clean_content:
                formatted_contents.append({"role": role, "parts": [{"text": clean_content}]})

        # Tambahkan pesan terbaru
        formatted_contents.append({"role": "user", "parts": [{"text": user_msg}]})

        # Set konfigurasi dan System Prompt
        config = types.GenerateContentConfig(
            system_instruction=get_system_prompt(),
            temperature=0.2,
        )

        response = GEMINI_CLIENT.models.generate_content(
            model=GEMINI_MODEL,
            contents=formatted_contents,
            config=config
        )
        
        return response.text
    except Exception as e: 
        logger.error(f"❌ AI Error: {e}")
        return "Mohon maaf, server sedang sibuk."


# =====================================================================
# 6. ROUTING API UTAMA
# =====================================================================
@app.route("/chat", methods=["POST"])
@limiter.limit("10 per minute")
def chat():
    data = request.json
    user_msg = data.get("message")
    chat_history = data.get("history", []) 
    
    if not user_msg or not isinstance(user_msg, str): 
        return jsonify({"error": "Pesan tidak valid"}), 400

    if len(user_msg.strip()) > 500:
        logger.warning(f"🛡️ Serangan Payload Ditolak! Panjang: {len(user_msg)} karakter.")
        return jsonify({"response": "Maaf kak, pertanyaannya kepanjangan nih (maksimal 500 karakter). Boleh diringkas sedikit biar gampang aku pahami? 😊"})

    # Panggil fungsi AI tunggal
    raw_answer = call_ai(user_msg, chat_history)
    final_answer = format_response_html(raw_answer)
    
    if db is not None:
        try:
            db.collection("chat_logs").add({
                "user_message": user_msg,
                "bot_response": raw_answer, 
                "timestamp": firestore.SERVER_TIMESTAMP 
            })
        except Exception as e:
            logger.error(f"⚠️ Gagal menyimpan log: {e}")

    return jsonify({"response": final_answer})


# =====================================================================
# 7. ROUTING API UNTUK ADMIN (REFRESH CACHE)
# =====================================================================
@app.route("/refresh-cache", methods=["GET"])
def refresh_cache():
    token = request.args.get("token")
    if token != ADMIN_SECRET_TOKEN:
        logger.warning("🚨 Upaya akses tanpa izin ke /refresh-cache ditolak!")
        return jsonify({"error": "Akses Ditolak. Token rahasia salah atau tidak ada."}), 401

    global FAQ_CACHE, LAST_FETCH_TIME
    FAQ_CACHE = None
    LAST_FETCH_TIME = 0
    load_knowledge_base()
    
    return jsonify({"status": "success", "message": "Cache berhasil dikosongkan dan diperbarui dari Firebase!"})


# =====================================================================
# 8. ROUTING API UNTUK SETTINGS ADMIN (ENV RUNTIME)
# =====================================================================
@app.route("/api/admin/settings", methods=["GET"])
def get_admin_settings():
    if not _is_admin_authorized(request):
        return jsonify({"error": "Akses Ditolak!"}), 401

    return jsonify({
        "status": "success",
        "data": {
            "gemini_api_key_set": bool(GEMINI_API_KEY),
            "gemini_api_key_masked": _mask_secret(GEMINI_API_KEY),
            "gemini_model": GEMINI_MODEL,
        }
    })


@app.route("/api/admin/settings", methods=["POST"])
def update_admin_settings():
    if not _is_admin_authorized(request):
        return jsonify({"error": "Akses Ditolak!"}), 401

    data = request.json or {}
    gemini_api_key = data.get("gemini_api_key")
    gemini_model = data.get("gemini_model")

    if gemini_api_key is None and gemini_model is None:
        return jsonify({"error": "Data pengaturan tidak ditemukan."}), 400

    try:
        if gemini_api_key is not None:
            _upsert_env_value("GEMINI_API_KEY", str(gemini_api_key).strip())

        if gemini_model is not None:
            clean_model = str(gemini_model).strip()
            if not clean_model:
                clean_model = "gemini-2.5-flash"
            _upsert_env_value("GEMINI_MODEL", clean_model)

        _reload_runtime_settings()

        return jsonify({
            "status": "success",
            "message": "Pengaturan API berhasil disimpan dan diterapkan.",
            "data": {
                "gemini_api_key_set": bool(GEMINI_API_KEY),
                "gemini_api_key_masked": _mask_secret(GEMINI_API_KEY),
                "gemini_model": GEMINI_MODEL,
            }
        })
    except Exception as e:
        logger.error(f"❌ Gagal menyimpan settings admin: {e}")
        return jsonify({"error": "Gagal menyimpan pengaturan API."}), 500


# =====================================================================
# 9. ROUTING API UNTUK AUTO-SCRAPER (PREVIEW MODE)
# =====================================================================
@app.route("/api/scrape", methods=["POST"])
def api_scrape():
    """
    Admin endpoint untuk scrape URL dan generate FAQ
    Request body: {"url": "https://example.com/page"}
    Header: Authorization: Bearer <ADMIN_SECRET_TOKEN>
    """
    token = request.headers.get("Authorization")
    if token != f"Bearer {ADMIN_SECRET_TOKEN}":
        logger.warning("🚨 Unauthorized scrape attempt!")
        return jsonify({"error": "Akses Ditolak! Token tidak valid."}), 401

    data = request.json
    target_url = data.get("url")
    
    if not target_url or not isinstance(target_url, str):
        return jsonify({"error": "URL tidak boleh kosong atau tidak valid"}), 400

    if not target_url.startswith(('http://', 'https://')):
        return jsonify({"error": "URL harus dimulai dengan http:// atau https://"}), 400

    if not GEMINI_CLIENT:
        return jsonify({"error": "GEMINI_API_KEY belum dikonfigurasi."}), 400

    logger.info(f"🌍 Menerima request scraping untuk URL: {target_url}")

    try:
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        response = requests.get(target_url, headers=headers)
        soup = BeautifulSoup(response.text, 'html.parser')
        paragraphs = soup.find_all(['p', 'h1', 'h2', 'h3', 'li'])
        raw_text = " ".join([p.get_text(strip=True) for p in paragraphs])

        if not raw_text or len(raw_text) < 100:
            return jsonify({"error": "Gagal mengambil teks atau teks terlalu pendek."}), 400

        prompt = f"""
        Kamu adalah pembuat FAQ profesional. Baca teks informasi kampus berikut:
        ---
        {raw_text[:20000]}
        ---
        Ekstrak informasi penting di atas menjadi pasangan Pertanyaan dan Jawaban (FAQ) untuk calon mahasiswa.
        Keluarkan HANYA dalam format JSON Array yang valid persis seperti format ini:
        [
          {{"q": "Pertanyaan 1", "a": "Jawaban 1"}}
        ]
        TIDAK BOLEH ADA TEKS LAIN SELAIN JSON! JANGAN gunakan blok kode markdown.
        """
        
        ai_response = GEMINI_CLIENT.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
        )
        
        if result["success"]:
            # Clear cache karena ada FAQ baru
            global FAQ_CACHE, LAST_FETCH_TIME
            FAQ_CACHE = None
            LAST_FETCH_TIME = 0
            
            logger.info(f"✅ Scraping sukses: {len(result['faqs'])} FAQ generated")
            
            return jsonify({
                "status": "success",
                "message": result["message"],
                "data": result["faqs"],
                "count": len(result["faqs"]),
                "debug": result.get("debug", "")
            }), 200
        else:
            logger.warning(f"⚠️ Scraping gagal: {result.get('error', 'Unknown error')}")
            
            return jsonify({
                "status": "error",
                "message": result.get("message") or "Gagal memproses scraping",
                "error": result.get("error"),
                "data": [],
                "count": 0,
                "debug": result.get("debug", "")
            }), 400

    except Exception as e:
        error_msg = str(e)
        logger.error(f"❌ Scrape Error: {error_msg}")
        import traceback
        traceback.print_exc()
        
        return jsonify({
            "status": "error",
            "message": "Terjadi kesalahan saat scraping halaman",
            "error": error_msg,
            "data": [],
            "count": 0,
            "debug": f"Exception: {error_msg}"
        }), 500


# =====================================================================
# 10. JALANKAN SERVER (HARUS DI PALING BAWAH!)
# =====================================================================
if __name__ == "__main__":
    app.run(host="0.0.0.0", debug=True, port=5000)