"use client";

import { useState, useRef, useEffect } from "react";

export default function Home() {
  const [messages, setMessages] = useState([
    {
      sender: "bot",
      text: "<b>Halo Calon Mahasiswa! 👋</b><br><br>Selamat datang di layanan Admisi Universitas Pembangunan Jaya.<br>Saya bisa bantu jelaskan tentang:<br>• Cara Pendaftaran<br>• Info Beasiswa<br>• Jurusan & Biaya",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (e?: React.FormEvent, presetText?: string) => {
    if (e) e.preventDefault();
    const messageText = presetText || input;
    if (!messageText.trim()) return;

    setMessages((prev) => [...prev, { sender: "user", text: messageText }]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("http://127.0.0.1:5000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: messageText }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { sender: "bot", text: data.response || "Maaf, respons kosong dari server." },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { sender: "bot", text: "⚠️ <b>Gagal terhubung ke server.</b><br>Pastikan backend Flask sudah menyala." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([{ sender: "bot", text: "Chat telah dibersihkan. Ada yang bisa saya bantu lagi? 😊" }]);
  };

  const quickReplies = ["Cara Daftar", "List Jurusan", "Info Biaya", "Beasiswa"];

  return (
    // Container Utama (Background Abu-abu)
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#f3f4f6', fontFamily: 'sans-serif' }}>
      
      {/* HEADER (Background Biru Gelap) */}
      <header style={{ backgroundColor: '#1e3a8a', color: '#ffffff', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
            🎓
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>Admisi UPJ</h1>
            <p style={{ margin: 0, fontSize: '12px', color: '#bfdbfe' }}>Online • Asisten Virtual</p>
          </div>
        </div>
        <button onClick={clearChat} style={{ backgroundColor: 'transparent', color: '#ffffff', border: '1px solid #ffffff', borderRadius: '8px', padding: '8px 12px', cursor: 'pointer' }}>
          Bersihkan
        </button>
      </header>

      {/* MAIN AREA (Area Chat) */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {messages.map((msg, idx) => (
          <div key={idx} style={{ display: 'flex', justifyContent: msg.sender === "user" ? 'flex-end' : 'flex-start' }}>
            
            {msg.sender === "bot" && (
              <div style={{ fontSize: '24px', marginRight: '10px' }}>🤖</div>
            )}

            {/* BUBBLE CHAT */}
            <div
              style={{
                maxWidth: '75%',
                padding: '12px 16px',
                lineHeight: '1.5',
                fontSize: '15px',
                // Logika Warna: Biru untuk User, Putih untuk Bot
                backgroundColor: msg.sender === "user" ? '#2563eb' : '#ffffff',
                color: msg.sender === "user" ? '#ffffff' : '#1f2937',
                border: msg.sender === "bot" ? '1px solid #e5e7eb' : 'none',
                // Melengkungkan sudut bubble
                borderRadius: msg.sender === "user" ? '16px 16px 0 16px' : '16px 16px 16px 0',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
              }}
              dangerouslySetInnerHTML={{ __html: msg.text }}
            />
          </div>
        ))}

        {isLoading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
             <div style={{ fontSize: '24px' }}>🤖</div>
             <div style={{ backgroundColor: '#ffffff', padding: '12px', borderRadius: '16px 16px 16px 0', border: '1px solid #e5e7eb', color: '#6b7280', fontSize: '14px' }}>
                Sedang mengetik...
             </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* FOOTER & INPUT */}
      <footer style={{ backgroundColor: '#ffffff', borderTop: '1px solid #e5e7eb', padding: '16px' }}>
        
        {/* Quick Replies */}
        <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', marginBottom: '12px', paddingBottom: '8px' }}>
          {quickReplies.map((reply, idx) => (
            <button
              key={idx}
              onClick={() => sendMessage(undefined, reply)}
              disabled={isLoading}
              style={{ whiteSpace: 'nowrap', backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: '999px', padding: '8px 16px', fontSize: '14px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              {reply}
            </button>
          ))}
        </div>

        {/* Kolom Input */}
        <form onSubmit={sendMessage} style={{ display: 'flex', gap: '10px' }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            placeholder="Ketik pertanyaan di sini..."
            style={{ flex: 1, padding: '12px 20px', borderRadius: '999px', border: '1px solid #d1d5db', backgroundColor: '#f9fafb', fontSize: '15px', outline: 'none' }}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            style={{ backgroundColor: (isLoading || !input.trim()) ? '#9ca3af' : '#2563eb', color: '#ffffff', border: 'none', borderRadius: '50%', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: (isLoading || !input.trim()) ? 'not-allowed' : 'pointer' }}
          >
            ➤
          </button>
        </form>
      </footer>
    </div>
  );
}