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
import google.generativeai as genai
import firebase_admin
from firebase_admin import credentials, firestore

# =====================================================================
# 1. KONFIGURASI AWAL & DATABASE
# =====================================================================
load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# --- KUNCI API ---
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
ADMIN_SECRET_TOKEN = os.getenv("ADMIN_SECRET_TOKEN", "rahasiaupj123") # Password darurat untuk Admin

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

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
    "http://localhost:3000",        # Untuk ngoding lokal
    "http://127.0.0.1:3000",
    "192.168.1.8:3000",                # Alternatif localhost
    # "https://frontend-chatbot-upj.vercel.app", # Buka kalau sudah di Vercel
    # "https://admisi-ai.upj.ac.id",             # Buka kalau sudah pakai domain kampus
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
    default_limits=["500 per day", "70 per hour"], # Batas wajar harian/jam
    storage_uri="memory://" 
)

@app.errorhandler(429)
def ratelimit_handler(e):
    logger.warning("🚨 Terdeteksi Spam (Rate Limit Hit)! IP diblokir sementara.")
    return jsonify({
        "response": "Wah, kamu nanyanya cepet banget! 😅 Mesin AI-nya butuh napas bentar nih. Tunggu sekitar satu menit lagi ya baru ketik pesan baru!"
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
        logger.info("⚡ Mengambil data FAQ dari Cache RAM (Hemat Kuota Database!)")
        return FAQ_CACHE

    base_data = {"organization": {"name": "UPJ"}, "faq": []}
    
    if db is None: return base_data

    try:
        faqs_ref = db.collection("faq") # Menggunakan collection "faq" sesuai frontend
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
    
    return f"""
    PERAN: Asisten Virtual Admisi Universitas Pembangunan Jaya (UPJ).
    DATA KNOWLEDGE BASE: 
    {data_str}
    
    ATURAN KETAT:
    1. DOMAIN TERBATAS: HANYA jawab pertanyaan yang BERKAITAN dengan Universitas Pembangunan Jaya (UPJ).
    2. PENOLAKAN TOPIK LUAR: JIKA pengguna bertanya tentang topik di luar UPJ, TOLAK DENGAN HALUS.
    3. ANTI-HALUSINASI: JANGAN PERNAH berhalusinasi atau mengarang info.
    4. GAYA BAHASA: Selalu jawab dengan ramah, profesional, dan antusias. JANGAN menggunakan kata ganti orang kedua tunggal.
    5. CALL TO ACTION: Pada setiap akhir jawaban, berikan ajakan mendaftar: https://pmb.upj.ac.id
    6. KONTAK: Jika butuh konsultasi, arahkan ke: https://bit.ly/kontakupj
    7. ATURAN FORMULIR: JANGAN PERNAH menambahkan kode [TAMPILKAN_FORM] di akhir jawaban, KECUALI pengunjung SECARA EKSPLISIT meminta formulir.
    """


# =====================================================================
# 5. FUNGSI PANGGIL AI
# =====================================================================
def call_groq(user_msg, history=[]):
    if not GROQ_API_KEY: return None
    try:
        headers = {"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"}
        messages = [{"role": "system", "content": get_system_prompt()}]
        
        safe_history = list(history)
        while len(safe_history) > 0 and safe_history[0]["role"] == "assistant":
            safe_history.pop(0)

        for h in safe_history: 
            messages.append({"role": h["role"], "content": h["content"]})
            
        messages.append({"role": "user", "content": user_msg})

        payload = {"model": "llama-3.1-8b-instant", "messages": messages, "temperature": 0.2}
        resp = requests.post("https://api.groq.com/openai/v1/chat/completions", headers=headers, json=payload, timeout=8)
        
        if resp.status_code == 200: 
            return resp.json()['choices'][0]['message']['content']
        elif resp.status_code == 429: 
            logger.warning("⚠️ GROQ LIMIT HABIS (429)! Pindah ke Gemini...")
            return None 
        else: 
            logger.error(f"❌ Groq API Error ({resp.status_code}): {resp.text}")
            return None
    except Exception as e: 
        logger.error(f"❌ Groq Request Error: {e}")
        return None

def call_gemini(user_msg, history=[]):
    if not GEMINI_API_KEY: return "Mohon maaf, server sedang sibuk."
    try:
        generation_config = genai.types.GenerationConfig(temperature=0.2)
        model = genai.GenerativeModel("gemini-1.5-flash", generation_config=generation_config, system_instruction=get_system_prompt())
        
        gemini_history = []
        for h in history:
            role = "user" if h["role"] == "user" else "model"
            clean_content = re.sub(r'<[^>]+>', '', str(h.get("content", ""))).strip()
            if clean_content:
                gemini_history.append({"role": role, "parts": [clean_content]})

        while len(gemini_history) > 0 and gemini_history[0]["role"] == "model":
            gemini_history.pop(0)

        chat = model.start_chat(history=gemini_history)
        return chat.send_message(user_msg).text
    except Exception as e: 
        logger.error(f"❌ Gemini Error: {e}")
        return "Mohon maaf, seluruh server sedang sibuk."


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

    raw_answer = call_groq(user_msg, chat_history)
    
    if raw_answer is None:
        logger.info("🔄 Menggunakan Cadangan: Google Gemini")
        raw_answer = call_gemini(user_msg, chat_history)
    
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
# 7. ROUTING API UNTUK ADMIN
# =====================================================================
@app.route("/refresh-cache", methods=["GET"])
def refresh_cache():
    """Endpoint untuk mereset memori secara manual dari Dashboard"""
    # FITUR KEAMANAN BARU: Wajib pakai token!
    token = request.args.get("token")
    if token != ADMIN_SECRET_TOKEN:
        logger.warning("🚨 Upaya akses tanpa izin ke /refresh-cache ditolak!")
        return jsonify({"error": "Akses Ditolak. Token rahasia salah atau tidak ada."}), 401

    global FAQ_CACHE, LAST_FETCH_TIME
    FAQ_CACHE = None
    LAST_FETCH_TIME = 0
    load_knowledge_base()
    
    return jsonify({"status": "success", "message": "Cache berhasil dikosongkan dan diperbarui dari Firebase!"})

if __name__ == "__main__":
    app.run(host="0.0.0.0", debug=True, port=5000)