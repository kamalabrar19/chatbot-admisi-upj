import requests
from bs4 import BeautifulSoup
from google import genai
import firebase_admin
from firebase_admin import credentials, firestore
import json
import os
from dotenv import load_dotenv

# ==========================================
# 1. LOAD KONFIGURASI & KONEKSI
# ==========================================
load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Inisialisasi client Gemini gaya baru
client = genai.Client(api_key=GEMINI_API_KEY)

if not firebase_admin._apps:
    cred = credentials.Certificate("firebase-key.json")
    firebase_admin.initialize_app(cred)
db = firestore.client()

# ==========================================
# 2. FUNGSI SCRAPER & AI
# ==========================================
def scrape_website(url):
    print(f"🌍 Sedang menyedot data dari: {url}...")
    try:
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        response = requests.get(url, headers=headers)
        
        soup = BeautifulSoup(response.text, 'html.parser')
        paragraphs = soup.find_all(['p', 'h1', 'h2', 'h3', 'li'])
        text = " ".join([p.get_text(strip=True) for p in paragraphs])
        
        print(f"✅ Berhasil menyedot {len(text)} karakter teks!")
        return text
    except Exception as e:
        print(f"❌ Gagal menyedot website: {e}")
        return None

def extract_faq_with_ai(raw_text):
    print("🧠 Menyuruh Gemini berpikir dan merangkum jadi FAQ...")
    
    prompt = f"""
    Kamu adalah pembuat FAQ profesional. Baca teks informasi kampus berikut:
    ---
    {raw_text[:20000]}
    ---
    Ekstrak informasi penting di atas menjadi pasangan Pertanyaan dan Jawaban (FAQ) untuk calon mahasiswa.
    Keluarkan HANYA dalam format JSON Array yang valid persis seperti format ini:
    [
      {{"q": "Pertanyaan 1", "a": "Jawaban 1"}},
      {{"q": "Pertanyaan 2", "a": "Jawaban 2"}}
    ]
    TIDAK BOLEH ADA TEKS LAIN SELAIN JSON! JANGAN gunakan blok kode markdown (```json).
    """
    
    try:
        # Cara memanggil API Gemini versi terbaru (gemini-2.5-flash)
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
        )
        
        clean_json = response.text.replace("```json", "").replace("```", "").strip()
        faqs = json.loads(clean_json)
        print(f"✨ Gemini berhasil membuat {len(faqs)} FAQ baru!")
        return faqs
    except Exception as e:
        print(f"❌ Gagal memproses AI: {e}")
        print("Raw AI Output:", response.text if response else "Tidak ada response")
        return []

def save_to_firebase(faq_list):
    if not faq_list:
        print("⚠️ Tidak ada FAQ yang disimpan.")
        return
        
    print("💾 Mengirim data ke Firebase Firestore...")
    batch = db.batch()
    
    for faq in faq_list:
        doc_ref = db.collection("faq").document()
        batch.set(doc_ref, {
            "q": str(faq.get("q", "")).strip(), 
            "a": str(faq.get("a", "")).strip()
        })
        
    batch.commit()
    print("🎉 SUKSES! Semua FAQ sudah masuk ke database!")

# ==========================================
# EKSEKUSI UTAMA
# ==========================================
if __name__ == "__main__":
    print("🚀 MEMULAI AUTO-SCRAPER BOT 🚀\n")
    
    # URL sudah bersih dari karakter aneh!
    TARGET_URL = "https://pmb.upj.ac.id/jalur-seleksi" 
    
    teks_website = scrape_website(TARGET_URL)
    
    if teks_website:
        hasil_faq = extract_faq_with_ai(teks_website)
        save_to_firebase(hasil_faq)