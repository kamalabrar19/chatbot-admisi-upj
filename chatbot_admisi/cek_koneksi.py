import requests
import json
import os
from dotenv import load_dotenv

# 1. Load Environment
load_dotenv()
API_KEY = os.getenv("OPENROUTER_API_KEY")

print("--- DIAGNOSIS KONEKSI ---")

# Cek apakah Key terbaca
if not API_KEY:
    print("❌ API Key TIDAK DITEMUKAN di .env!")
    print("Pastikan nama file adalah '.env' (bukan .env.txt) dan sejajar dengan file ini.")
    exit()
else:
    print(f"✅ API Key terbaca (Depan: {API_KEY[:5]}...)")

# 2. Tes Request Sederhana (Ping Google Gemini)
# Kita pakai model yang paling stabil
MODEL_TEST = "google/gemini-2.0-flash-thinking-exp:free"

print(f"🔄 Mencoba menghubungi OpenRouter dengan model: {MODEL_TEST}...")

try:
    response = requests.post(
        url="https://openrouter.ai/api/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:5000",
        },
        data=json.dumps({
            "model": MODEL_TEST,
            "messages": [
                {"role": "user", "content": "Halo, tes koneksi 123."}
            ],
        }),
        timeout=30
    )

    print(f"📡 Status Code: {response.status_code}")
    
    if response.status_code == 200:
        print("✅ SUKSES! Balasan AI:")
        print(response.json()['choices'][0]['message']['content'])
    else:
        print("❌ GAGAL! Pesan Error dari OpenRouter:")
        print(response.text)

except Exception as e:
    print(f"🔥 ERROR PYTHON: {e}")