from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import os
import json
import logging
import re
import pandas as pd
from dotenv import load_dotenv
import google.generativeai as genai

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
# 2. FUNGSI PEMBACA DATA (JSON & EXCEL)
# =====================================================================
def load_knowledge_base():
    """Membaca info dasar dari JSON dan FAQ dari Excel"""
    base_data = {"organization": {"name": "UPJ"}, "faq": []}
    
    # A. Baca Info Dasar Kampus (Opsional, dari JSON lama jika ada)
    if os.path.exists('admisi_data.json'):
        try:
            with open('admisi_data.json', 'r', encoding='utf-8') as f:
                json_content = json.load(f)
                base_data['organization'] = json_content.get('organization', {})
        except Exception as e:
            logger.error(f"Error baca JSON: {e}")

    # B. Baca Data FAQ dari Excel (Sumber utama pengetahuan AI)
    excel_path = 'faq_admisi.xlsx'
    if os.path.exists(excel_path):
        try:
            df = pd.read_excel(excel_path)
            # Bersihkan baris kosong
            df = df.dropna(subset=['Pertanyaan', 'Jawaban']) 
            
            faqs = []
            for index, row in df.iterrows():
                faqs.append({
                    "q": str(row['Pertanyaan']).strip(),
                    "a": str(row['Jawaban']).strip()
                })
            base_data['faq'] = faqs
            logger.info(f"Berhasil meload {len(faqs)} FAQ dari Excel")
        except Exception as e:
            logger.error(f"Error baca Excel: {e}")
            
    return base_data

# =====================================================================
# 3. FORMATTER TAMPILAN
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
# 4. SYSTEM PROMPT (OTAK AI YANG STRICT)
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
    4. GAYA BAHASA: Selalu jawab dengan ramah, profesional, dan antusias. JANGAN menggunakan kata ganti orang kedua tunggal seperti "kamu" atau "Anda" (gunakan sapaan umum seperti "Kak", "Teman-teman", atau langsung ke intinya).
    5. CALL TO ACTION (CTA) WAJIB: Pada setiap akhir jawaban, berikan ajakan kuat dan persuasif untuk segera mendaftar. 
       Contoh CTA: "Yuk, segera wujudkan masa depan cemerlang bersama UPJ! Pendaftaran online dapat langsung dilakukan melalui https://pmb.upj.ac.id 🎓✨"
    6. KONTAK BANTUAN: Jika butuh konsultasi lebih lanjut, arahkan ke: https://bit.ly/kontakupj
    """

# =====================================================================
# 5. FUNGSI PANGGIL AI
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
            logger.warning("GROQ LIMIT HABIS (429)! Pindah ke Gemini...")
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
# 6. ROUTING API
# =====================================================================

# Endpoint 1: Chat AI
@app.route("/chat", methods=["POST"])
def chat():
    data = request.json
    user_msg = data.get("message")
    if not user_msg: return jsonify({"error": "Pesan kosong"}), 400

    raw_answer = call_groq(user_msg)
    
    if raw_answer is None:
        logger.info("Menggunakan Cadangan: Google Gemini")
        raw_answer = call_gemini(user_msg)
    
    final_answer = format_response_html(raw_answer)
    return jsonify({"response": final_answer})

# Endpoint 2: Menerima Upload Excel dari Dashboard Next.js
@app.route("/api/upload", methods=["POST"])
def api_upload():
    if 'file' not in request.files:
        return jsonify({"error": "Tidak ada file yang dikirim"}), 400
        
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({"error": "File kosong"}), 400
        
    if file and file.filename.endswith('.xlsx'):
        # Timpa file lama dengan yang baru
        file.save('faq_admisi.xlsx') 
        return jsonify({"message": "File berhasil diunggah dan AI sudah diperbarui"}), 200
        
    return jsonify({"error": "Format salah! Harap unggah file .xlsx"}), 400

# Jalankan Server
if __name__ == "__main__":
    app.run(debug=True, port=5000)

# Endpoint 3: Mengirim data Excel ke Dashboard Next.js
@app.route("/api/faqs", methods=["GET"])
def api_get_faqs():
    faqs = []
    excel_path = 'faq_admisi.xlsx'
    
    if os.path.exists(excel_path):
        try:
            df = pd.read_excel(excel_path)
            df = df.dropna(subset=['Pertanyaan', 'Jawaban'])
            for index, row in df.iterrows():
                faqs.append({
                    "q": str(row['Pertanyaan']).strip(),
                    "a": str(row['Jawaban']).strip()
                })
            return jsonify({"faqs": faqs}), 200
        except Exception as e:
            logger.error(f"Gagal baca excel untuk API: {e}")
            return jsonify({"error": "Gagal membaca file Excel"}), 500
            
    return jsonify({"faqs": []}), 200