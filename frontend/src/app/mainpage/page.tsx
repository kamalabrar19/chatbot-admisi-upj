"use client";

import { useState, useRef, useEffect } from "react";
import { db } from "../../lib/firebase"; 
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

interface Message {
  sender: "user" | "bot";
  text: string;
  isForm?: boolean; 
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: "bot",
      text: "<b>Halo! 👋</b><br><br>Selamat datang di layanan Admisi Universitas Pembangunan Jaya.<br>Ada yang bisa dibantu terkait pendaftaran, program studi, atau biaya kuliah?",
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const [interactionCount, setInteractionCount] = useState(0); 
  const [isRegistered, setIsRegistered] = useState(false); 
  
  const [formData, setFormData] = useState({ name: "", phone: "", major: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (e?: React.FormEvent, presetText?: string) => {
    if (e) e.preventDefault();
    const messageText = presetText || input;
    if (!messageText.trim()) return;

    // 1. Tampilkan pesan user di layar
    setMessages((prev) => [...prev, { sender: "user", text: messageText }]);
    setInput("");
    setIsLoading(true);
    
    const currentInteraction = interactionCount + 1;
    setInteractionCount(currentInteraction);

    // ================= FITUR BARU: SIAPKAN MEMORI =================
    // Ambil maksimal 4 obrolan terakhir untuk dikirim sebagai memori (tanpa bubble form)
    const chatHistory = messages
      .filter(m => !m.isForm && m.text !== "") 
      .slice(-4) // Ambil 4 terakhir agar memori fokus dan hemat token API
      .map(m => ({
        role: m.sender === "user" ? "user" : "assistant",
        content: m.text.replace(/<[^>]+>/g, '') // Buang kode HTML biar rapi saat dibaca AI
      }));
    // ==============================================================

    try {
      const res = await fetch("http://127.0.0.1:5000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          message: messageText,
          history: chatHistory // Kirim memorinya ke backend!
        }),
      });
      const data = await res.json();
      
      let botResponse = data.response || "Maaf, respons kosong dari server.";
      let shouldShowForm = false;

      // 2. TANGKAP KODE RAHASIA DARI AI
      if (botResponse.includes("[TAMPILKAN_FORM]")) {
        shouldShowForm = true;
        // Hapus kode tersebut agar tidak dibaca oleh pengunjung
        botResponse = botResponse.replace("[TAMPILKAN_FORM]", "").trim();
      }

      // 3. Tampilkan jawaban teks bot
      if (botResponse) {
        setMessages((prev) => [...prev, { sender: "bot", text: botResponse }]);
      }

      // 4. MUNCULKAN FORM JIKA: 
      // - AI mengirim kode rahasia, ATAU 
      // - Ini adalah chat ke-2 dan user belum pernah ngisi form
      if (shouldShowForm || (currentInteraction === 2 && !isRegistered)) {
        setTimeout(() => {
          setMessages((prev) => [
            ...prev, 
            { sender: "bot", text: "", isForm: true } // Render UI Form
          ]);
        }, 800); 
      }

    } catch (error) {
      setMessages((prev) => [...prev, { sender: "bot", text: "⚠️ <b>Gagal terhubung ke server AI.</b>" }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Fungsi saat form Lead Generation dikirim
  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone || !formData.major) return;

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "leads"), {
        nama: formData.name,
        whatsapp: formData.phone,
        minat_jurusan: formData.major,
        waktu_daftar: serverTimestamp()
      });
      
      setIsRegistered(true);
      
      setMessages((prev) => [
        // Hapus bubble form yang ada di layar biar bersih
        ...prev.filter(m => !m.isForm), 
        {
          sender: "bot",
          text: `<b>Makasih banyak kak ${formData.name}! ✨</b><br><br>Data diri sudah tersimpan. Yuk, kita lanjut ngobrolnya!`
        }
      ]);
      
    } catch (error) {
      console.error("Gagal menyimpan lead:", error);
      alert("Terjadi kesalahan, mohon coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const quickReplies = ["Cara Daftar", "Info Biaya", "Beasiswa", "Lokasi Kampus"];

  return (
    <div className="flex flex-col h-screen bg-gray-50 font-sans">
      <header className="bg-blue-900 text-white p-4 flex justify-between items-center shadow-md z-10">
        <div className="flex items-center gap-3">
          <div className="bg-white rounded-full w-10 h-10 flex items-center justify-center text-xl shadow-sm">🎓</div>
          <div>
            <h1 className="m-0 text-lg font-bold leading-tight">Admisi UPJ</h1>
            <p className="m-0 text-xs text-blue-200">Asisten Virtual Cerdas</p>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
            {msg.sender === "bot" && <div className="text-2xl mr-2 mt-1 drop-shadow-sm">🤖</div>}
            
            {msg.isForm ? (
              // BUBBLE FORMULIR (Sekarang bebas di-skip)
              <div className="bg-white border border-blue-200 rounded-2xl rounded-tl-none p-5 shadow-sm max-w-[85%] sm:max-w-[70%]">
                <p className="text-sm text-gray-800 font-semibold mb-3">
                  Silakan isi data berikut jika ingin didata oleh tim Admisi kami 👇
                </p>
                <form onSubmit={handleLeadSubmit} className="space-y-3">
                  <input type="text" required value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="Nama Panggilan" className="w-full text-sm border border-gray-300 rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50" />
                  <input type="tel" required value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} placeholder="Nomor WhatsApp aktif" className="w-full text-sm border border-gray-300 rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50" />
                  <select required value={formData.major} onChange={(e) => setFormData({...formData, major: e.target.value})} className="w-full text-sm border border-gray-300 rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50 text-gray-700">
                    <option value="">-- Pilih Minat Jurusan --</option>
                    <option value="Informatika">Informatika</option>
                    <option value="Sistem Informasi">Sistem Informasi</option>
                    <option value="DKV">Desain Komunikasi Visual (DKV)</option>
                    <option value="Desain Produk">Desain Produk</option>
                    <option value="Ilmu Komunikasi">Ilmu Komunikasi</option>
                    <option value="Psikologi">Psikologi</option>
                    <option value="Manajemen">Manajemen</option>
                    <option value="Akuntansi">Akuntansi</option>
                    <option value="Teknik Sipil">Teknik Sipil</option>
                    <option value="Arsitektur">Arsitektur</option>
                  </select>
                  <button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 text-white font-bold py-2.5 rounded-xl hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-70 text-sm mt-1">
                    {isSubmitting ? "Menyimpan..." : "Kirim Data 🚀"}
                  </button>
                </form>
              </div>
            ) : (
              // BUBBLE TEKS BIASA
              <div
                className={`max-w-[80%] p-3.5 leading-relaxed text-[15px] shadow-sm ${
                  msg.sender === "user" 
                  ? "bg-blue-600 text-white rounded-2xl rounded-tr-none" 
                  : "bg-white text-gray-800 border border-gray-200 rounded-2xl rounded-tl-none"
                }`}
                dangerouslySetInnerHTML={{ __html: msg.text }}
              />
            )}
          </div>
        ))}
        
        {isLoading && (
          <div className="flex items-center gap-2">
             <div className="text-2xl drop-shadow-sm">🤖</div>
             <div className="bg-white p-3 rounded-2xl rounded-tl-none border border-gray-200 text-gray-500 text-sm shadow-sm flex items-center gap-1">
               <span className="animate-bounce">●</span><span className="animate-bounce delay-100">●</span><span className="animate-bounce delay-200">●</span>
             </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* FOOTER & INPUT (Sekarang TIDAK PERNAH DIKUNCI, kecuali saat nunggu jawaban AI) */}
      <footer className="bg-white border-t border-gray-200 p-4">
        <div className="flex gap-2 overflow-x-auto mb-3 pb-1 scrollbar-hide">
          {quickReplies.map((reply, idx) => (
            <button key={idx} onClick={() => sendMessage(undefined, reply)} disabled={isLoading} className="whitespace-nowrap bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-4 py-1.5 text-sm cursor-pointer font-semibold hover:bg-blue-100 transition-colors flex-shrink-0 disabled:opacity-50">
              {reply}
            </button>
          ))}
        </div>

        <form onSubmit={sendMessage} className="flex gap-2">
          <input 
            type="text" 
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            disabled={isLoading} // Hanya dikunci waktu loading
            placeholder="Ketik pesan di sini..." 
            className="flex-1 p-3.5 rounded-full border border-gray-300 bg-gray-50 text-[15px] outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-200 transition-all" 
          />
          <button 
            type="submit" 
            disabled={isLoading || !input.trim()} 
            className="bg-blue-600 text-white border-none rounded-full w-12 h-12 flex items-center justify-center cursor-pointer disabled:bg-gray-400 transition-colors shadow-md flex-shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 ml-1">
              <path d="M3.478 2.404a.75.75 0 00-.926.941l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.404z" />
            </svg>
          </button>
        </form>
      </footer>
    </div>
  );
}