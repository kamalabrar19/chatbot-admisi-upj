from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import os
import json
import logging
import re
from dotenv import load_dotenv
import google.generativeai as genai

# === LIBRARY FIREBASE ===
import firebase_admin
from firebase_admin import credentials, firestore

# =====================================================================
# 1. KONFIGURASI AWAL
# =====================================================================
load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
# Mengizinkan Frontend Next.js berkomunikasi dengan API ini
CORS(app) 

# --- API KEYS ---
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

# =====================================================================
# 2. INISIALISASI FIREBASE ADMIN
# =====================================================================
# Pastikan file firebase-key.json sudah ada di folder yang sama dengan app.py
try:
    # Cek agar tidak inisialisasi ganda saat server reload
    if not firebase_admin._apps:
        cred = credentials.Certificate("firebase-key.json")
        firebase_admin.initialize_app(cred)
    db = firestore.client()
    logger.info("✅ Berhasil terhubung ke Firebase Firestore!")
except Exception as e:
    logger.error(f"❌ Gagal koneksi ke Firebase. Cek file firebase-key.json Anda! Error: {e}")
    db = None

# =====================================================================
# 3. FUNGSI PEMBACA DATA (DARI FIRESTORE)
# =====================================================================
def load_knowledge_base():
    """Membaca FAQ langsung dari Firebase Firestore secara Real-Time"""
    base_data = {"organization": {"name": "UPJ"}, "faq": []}
    
    if db is None:
        logger.warning("⚠️ Database tidak terhubung. AI tidak memiliki data pengetahuan.")
        return base_data

    try:
        # Menarik data dari koleksi "faqs" di Firestore
        faqs_ref = db.collection("faqs")
        docs = faqs_ref.stream()
        
        faqs = []
        for doc in docs:
            data = doc.to_dict()
            if 'q' in data and 'a' in data:
                faqs.append({
                    "q": str(data['q']).strip(),
                    "a": str(data['a']).strip()
                })
            
        base_data['faq'] = faqs
        logger.info(f"✅ AI berhasil memuat {len(faqs)} FAQ dari Firebase")
    except Exception as e:
        logger.error(f"❌ Error baca data dari Firestore: {e}")
            
    return base_data

# =====================================================================
# 4. FORMATTER TAMPILAN
# =====================================================================
def format_response_html(text):
    if not text: return ""
    text = text.replace('\n', '<br>')
    text = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', text)
    
    # Format Link Markdown
    text = re.sub(
        r'\[([^\]]+)\]\((https?://[^\)]+)\)', 
        r'<a href="\2" target="_blank" class="text-blue-600 hover:text-blue-800 underline font-semibold">\1</a>', 
        text
    )
    # Format Raw URL
    text = re.sub(
        r'(?<!href=")(?<!src=")(https?://[^\s<"]+)', 
        r'<a href="\1" target="_blank" class="text-blue-600 hover:text-blue-800 underline font-semibold">\1</a>', 
        text
    )
    return text

# =====================================================================
# 5. SYSTEM PROMPT (OTAK AI YANG STRICT)
# =====================================================================
def get_system_prompt():
    current_data = load_knowledge_base() 
    data_str = json.dumps(current_data, ensure_ascii=False)
    
    return f"""
    PERAN: Asisten Virtual Admisi Universitas Pembangunan Jaya (UPJ).
    
    DATA KNOWLEDGE BASE: 
    {data_str}
    
    ATURAN KETAT (GUARDRAILS):
    1. DOMAIN TERBATAS: HANYA jawab pertanyaan yang BERKAITAN dengan Universitas Pembangunan Jaya (UPJ) berdasarkan DATA KNOWLEDGE BASE.
    2. PENOLAKAN TOPIK LUAR: JIKA pengguna bertanya tentang topik di luar UPJ (misal: coding, cuaca, resep masakan, politik, kampus lain, dll), TOLAK DENGAN HALUS.
       Format penolakan wajib: "Mohon maaf, saat ini asisten hanya dapat memberikan informasi seputar penerimaan mahasiswa baru di Universitas Pembangunan Jaya (UPJ). Apakah ada informasi program studi atau biaya kuliah UPJ yang ingin ditanyakan?"
    3. ANTI-HALUSINASI: JANGAN PERNAH berhalusinasi atau mengarang info. Jika info tidak ada di data, arahkan ke kontak resmi.
    4. GAYA BAHASA: Selalu jawab dengan ramah, profesional, dan antusias. JANGAN menggunakan kata ganti orang kedua tunggal.
    5. CALL TO ACTION (CTA) WAJIB: Pada setiap akhir jawaban, berikan ajakan kuat dan persuasif untuk segera mendaftar. 
       Contoh CTA: "Yuk, segera wujudkan masa depan cemerlang bersama UPJ! Pendaftaran online dapat langsung dilakukan melalui https://pmb.upj.ac.id 🎓✨"
    6. KONTAK BANTUAN: Jika butuh konsultasi lebih lanjut, arahkan ke: https://bit.ly/kontakupj
    """

# =====================================================================
# 6. FUNGSI PANGGIL AI
# =====================================================================
def call_groq(user_msg):
    if not GROQ_API_KEY: return None
    try:
        headers = {"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"}
        payload = {
            "model": "llama-3.1-8b-instant",
            "messages": [
                {"role": "system", "content": get_system_prompt()},
                {"role": "user", "content": user_msg}
            ],
            "temperature": 0.2
        }
        resp = requests.post("https://api.groq.com/openai/v1/chat/completions", headers=headers, json=payload, timeout=5)
        
        if resp.status_code == 200:
            return resp.json()['choices'][0]['message']['content']
        elif resp.status_code == 429:
            logger.warning("⚠️ GROQ LIMIT HABIS (429)! Pindah ke Gemini...")
            return None 
        else:
            return None
    except Exception as e:
        logger.error(f"Groq Connection Error: {e}")
        return None

def call_gemini(user_msg):
    if not GEMINI_API_KEY: return "Mohon maaf, server sedang sibuk. Silakan coba beberapa saat lagi."
    try:
        generation_config = genai.types.GenerationConfig(temperature=0.2)
        model = genai.GenerativeModel("gemini-1.5-flash", generation_config=generation_config)
        full_prompt = f"{get_system_prompt()}\n\nPertanyaan: {user_msg}"
        resp = model.generate_content(full_prompt)
        return resp.text
    except Exception as e:
        logger.error(f"Gemini Error: {e}")
        return "Mohon maaf, seluruh server sedang sibuk. Silakan coba kembali nanti."

# =====================================================================
# 7. ROUTING API (MURNI HANYA UNTUK CHAT)
# =====================================================================
@app.route("/chat", methods=["POST"])
def chat():
    data = request.json
    user_msg = data.get("message")
    if not user_msg: return jsonify({"error": "Pesan kosong"}), 400

    raw_answer = call_groq(user_msg)
    
    if raw_answer is None:
        logger.info("🔄 Menggunakan Cadangan: Google Gemini")
        raw_answer = call_gemini(user_msg)
    
    final_answer = format_response_html(raw_answer)
    return jsonify({"response": final_answer})

# Jalankan Server
if __name__ == "__main__":
    app.run(debug=True, port=5000)