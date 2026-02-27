@echo off
echo =======================================================
echo 🚀 MEMULAI FULLSTACK CHATBOT ADMISI UPJ...
echo =======================================================
echo.

:: 1. Menjalankan Backend Python di jendela baru
echo [1/2] Menyalakan Backend (Flask) di port 5000...
start "Backend Flask" cmd /k "cd chatbot_admisi && python app.py"

:: 2. Menjalankan Frontend Next.js di jendela baru
echo [2/2] Menyalakan Frontend (Next.js) di port 3000...
start "Frontend Next.js" cmd /k "cd frontend && npm run dev"

echo.
echo ✅ SELESAI! Semua server sedang proses berjalan.
echo 🌐 Buka browser Anda di: http://localhost:3000
echo.
pause