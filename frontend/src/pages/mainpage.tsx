"use client";

import { useState, useRef, useEffect } from "react";
import { db } from "../lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import styles from "../styles/mainpage.module.css";

interface Message {
  sender: "user" | "bot";
  text: string;
  isForm?: boolean;
  feedbackGiven?: boolean;
  feedbackHelpful?: boolean;
}

const formatBotResponse = (raw: string) => {
  const escapeHtml = (str: string) =>
    str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const parts = raw.split(/```/);
  let html = "";

  parts.forEach((chunk, idx) => {
    // code fence
    if (idx % 2 === 1) {
      html += `<pre><code>${escapeHtml(chunk.trim())}</code></pre>`;
      return;
    }

    const lines = chunk.split(/\n+/).map(l => l.trim()).filter(Boolean);
    let inUl = false;
    let inOl = false;

    const closeLists = () => {
      if (inUl) { html += "</ul>"; inUl = false; }
      if (inOl) { html += "</ol>"; inOl = false; }
    };

    lines.forEach(line => {
      if (/^###\s+/.test(line)) { closeLists(); html += `<h3>${line.replace(/^###\s+/, "")}</h3>`; return; }
      if (/^##\s+/.test(line))  { closeLists(); html += `<h2>${line.replace(/^##\s+/, "")}</h2>`; return; }
      if (/^#\s+/.test(line))   { closeLists(); html += `<h1>${line.replace(/^#\s+/, "")}</h1>`; return; }
      if (/^>\s+/.test(line))   { closeLists(); html += `<blockquote>${line.replace(/^>\s+/, "")}</blockquote>`; return; }
      if (/^[-*]\s+/.test(line)) {
        if (!inUl) { html += "<ul>"; inUl = true; }
        html += `<li>${line.replace(/^[-*]\s+/, "")}</li>`;
        return;
      }
      if (/^\d+\.\s+/.test(line)) {
        if (!inOl) { html += "<ol>"; inOl = true; }
        html += `<li>${line.replace(/^\d+\.\s+/, "")}</li>`;
        return;
      }
      closeLists();
      html += `<p>${line}</p>`;
    });
    closeLists();
  });

  html = html
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*(?!\*)(.+?)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");

  return html;
};

const stripHtml = (html: string) =>
  html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

export default function Home() {
  const [showWelcomeCard, setShowWelcomeCard] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const [interactionCount, setInteractionCount] = useState(0); 
  const [isRegistered, setIsRegistered] = useState(false); 
  
  const [formData, setFormData] = useState({ name: "", phone: "", major: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (e?: React.FormEvent, presetText?: string) => {
    if (e) e.preventDefault();
    const messageText = presetText || input;
    if (!messageText.trim()) return;

    if (showWelcomeCard) setShowWelcomeCard(false);

    setMessages((prev) => [...prev, { sender: "user", text: messageText }]);
    setInput("");
    setIsLoading(true);
    
    const currentInteraction = interactionCount + 1;
    setInteractionCount(currentInteraction);

    const chatHistory = messages
      .filter(m => !m.isForm && m.text !== "")
      .slice(-4) 
      .map(m => ({
        role: m.sender === "user" ? "user" : "assistant",
        content: m.text.replace(/<[^>]+>/g, '') 
      }));

    try {
      const res = await fetch("http://127.0.0.1:5000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          message: messageText,
          history: chatHistory
        }),
      });
      const data = await res.json();
      
      let botResponse = data.response || "Maaf, respons kosong dari server.";
      let shouldShowForm = false;

      if (botResponse.includes("[TAMPILKAN_FORM]")) {
        shouldShowForm = true;
        botResponse = botResponse.replace("[TAMPILKAN_FORM]", "").trim();
      }

      if (botResponse) {
        const formatted = formatBotResponse(botResponse);
        setMessages((prev) => [...prev, { sender: "bot", text: formatted }]);
      }

      if (shouldShowForm || (currentInteraction === 2 && !isRegistered)) {
        setTimeout(() => {
          setMessages((prev) => [
            ...prev, 
            { sender: "bot", text: "", isForm: true }
          ]);
        }, 800); 
      }

    } catch (error) {
      setMessages((prev) => [...prev, { sender: "bot", text: "⚠️ <b>Gagal terhubung ke server AI.</b>" }]);
    } finally {
      setIsLoading(false);
    }
  };

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
        ...prev.filter(m => !m.isForm), 
        {
          sender: "bot",
          text: formatBotResponse(`**Makasih banyak kak ${formData.name}! ✨**\n\nData diri sudah tersimpan. Yuk, kita lanjut ngobrolnya!`)
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

  const startNewChat = () => {
    setMessages([]);
    setInput("");
    setInteractionCount(0);
    setIsRegistered(false);
    setFormData({ name: "", phone: "", major: "" });
    setShowWelcomeCard(true);
  };

  const handleCopy = (html: string, id: string) => {
    const plain = stripHtml(html);
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(plain).then(() => {
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 1600);
      }).catch(() => {});
    }
  };

  const handleFeedback = async (msgIdx: number, isHelpful: boolean) => {
    const botMsg = messages[msgIdx];
    if (!botMsg || botMsg.sender !== "bot") return;
    try {
      await addDoc(collection(db, "chatbot_feedback"), {
        text: stripHtml(botMsg.text),
        isHelpful,
        timestamp: serverTimestamp(),
      });
      // Optional: tampilkan notifikasi atau ubah tampilan tombol setelah feedback
      setMessages((prev) => prev.map((m, i) =>
        i === msgIdx ? { ...m, feedbackGiven: true, feedbackHelpful: isHelpful } : m
      ));
    } catch (e) {
      alert("Gagal menyimpan feedback.");
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 font-['Helvetica',_Arial,_sans-serif] text-[14px] relative overflow-hidden">
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className={styles.bgWash} />
        <div className={`${styles.orb} ${styles.orbRed}`} />
        <div className={`${styles.orb} ${styles.orbGreen}`} />
        <div className={`${styles.orb} ${styles.orbBlue}`} />
        <div className={`${styles.orb} ${styles.orbWhite}`} />
      </div>
      <div className="relative z-10 flex flex-col h-full">
      <header className="fixed top-0 left-0 right-0 z-30 px-4 pt-4 pointer-events-none">
        <div className="max-w-5xl mx-auto flex items-center justify-between rounded-2xl bg-white/55 backdrop-blur-xl shadow-xl shadow-blue-900/10 border border-white/40 px-3 py-2 sm:px-4 sm:py-3 ring-1 ring-white/30 pointer-events-auto transition-colors">
          <div className="flex items-center gap-3">
            <img
              src="/images/logo-upj.svg"
              alt="Logo UPJ"
              className="bg-white rounded-full w-10 h-10 object-contain p-1 shadow-sm shadow-blue-900/10"
            />
            <div>
              <h1 className="m-0 text-sm sm:text-base font-bold leading-tight text-blue-900">Admisi UPJ</h1>
              <p className="m-0 text-[10px] sm:text-[11px] text-blue-700">Asisten Virtual Cerdas</p>
            </div>
          </div>
          <button
            onClick={startNewChat}
            className="flex items-center gap-1 text-xs sm:text-sm font-semibold text-blue-800 bg-white/70 backdrop-blur-xl border border-blue-200 rounded-full px-3 py-2 shadow-md shadow-blue-900/10 hover:bg-blue-600 hover:text-white hover:border-blue-500 transition-colors"
          >
            <span className="hidden sm:inline">Chat Baru</span>
            <span className="sm:hidden">Reset</span>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path d="M12 5c-.414 0-.75.336-.75.75V11H6.75a.75.75 0 000 1.5H12v5.25a.75.75 0 001.5 0V12.5h5.25a.75.75 0 000-1.5H13.5V5.75A.75.75 0 0012 5z" />
            </svg>
          </button>
        </div>
      </header>

      {/* Welcome Card Overlay */}
      {showWelcomeCard && (
        <div className="fixed left-1/2 top-1/3 z-10 -translate-x-1/2 -translate-y-1/3 flex items-center justify-center pointer-events-none select-none w-full max-w-full px-2">
          <div
            className="relative shadow-2xl rounded-3xl p-3 sm:p-5 md:p-6 max-w-xs sm:max-w-sm md:max-w-md w-full flex flex-col items-center text-center animate-fade-in opacity-95 bg-white/80 backdrop-blur-xl"
            style={{ borderRadius: '1.5rem' }}
          >
            <span
              aria-hidden="true"
              className="pointer-events-none select-none absolute inset-0 z-[-1] rounded-3xl"
              style={{
                padding: 0,
                margin: 0,
                borderRadius: '1.5rem',
                boxSizing: 'border-box',
                content: '""',
                display: 'block',
                border: '4px solid transparent',
                background: 'linear-gradient(90deg, #E53935 0%, #43A047 50%, #1E88E5 100%) border-box',
                WebkitMask:
                  'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                WebkitMaskComposite: 'xor',
                maskComposite: 'exclude',
              }}
            />
            <div className="bg-white/80 rounded-full p-1 sm:p-1.5 shadow-lg mb-2 sm:mb-3 border-2 border-blue-200">
              <img src="/images/logo-upj.svg" alt="Logo UPJ" className="w-10 h-10 sm:w-14 sm:h-14" />
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-blue-900 mb-1 tracking-tight drop-shadow-sm">Layanan Admisi UPJ</h2>
            <p className="text-blue-800 text-xs sm:text-sm font-medium mb-2 sm:mb-3 leading-relaxed drop-shadow-sm">
              Selamat datang di <span className="font-bold text-blue-900">Asisten Virtual Admisi<br />Universitas Pembangunan Jaya</span>.<br />
              <span className="text-blue-700">Tanyakan apa saja seputar pendaftaran, program studi, biaya kuliah, atau beasiswa!</span>
            </p>
            <div className="flex gap-1 sm:gap-2 mt-1 flex-wrap justify-center">
              <span className="inline-block bg-blue-100 text-blue-700 text-[9px] sm:text-[11px] font-semibold px-2 py-0.5 sm:px-3 sm:py-1 rounded-full shadow">#Pendaftaran</span>
              <span className="inline-block bg-blue-100 text-blue-700 text-[9px] sm:text-[11px] font-semibold px-2 py-0.5 sm:px-3 sm:py-1 rounded-full shadow">#Beasiswa</span>
              <span className="inline-block bg-blue-100 text-blue-700 text-[9px] sm:text-[11px] font-semibold px-2 py-0.5 sm:px-3 sm:py-1 rounded-full shadow">#KampusUPJ</span>
            </div>
            {/* Gradient card wrapper closes */}
          </div>
          {/* Overlay wrapper closes */}
        </div>
      )}

      <main className="flex-1 overflow-y-auto p-4 pt-28 pb-32 flex flex-col gap-4">
        <div className="w-full max-w-5xl mx-auto flex flex-col gap-4">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}>
            {/* Bubble chat */}
            {msg.isForm ? (
              // BUBBLE FORMULIR (Sekarang bebas di-skip)
              <div className="bg-white/90 backdrop-blur border border-blue-100 rounded-2xl rounded-tl-none p-6 shadow-lg max-w-[90vw] sm:max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl w-full">
                <div className="flex items-center gap-2 mb-4">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-50 text-blue-700 text-sm font-bold">i</span>
                  <div>
                    <p className="text-xs font-semibold text-blue-700 tracking-wide mb-0">Halo kak, kira kira kakaknya minat masuk jurusan apa?</p>
                    <p className="text-sm text-gray-700 m-0">Yuk, lengkapi form di bawah ini dan klaim potongan biaya pendaftaranmu sekarang! 🚀</p>
                  </div>
                </div>
                <form onSubmit={handleLeadSubmit} className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-3">
                    <label className="flex flex-col gap-1 text-xs font-semibold text-gray-700">
                      Nama panggilan
                      <input
                        type="text"
                        id="floating_name"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-400 transition"
                        placeholder="Contoh: Raka"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs font-semibold text-gray-700">
                      Nomor WhatsApp aktif
                      <input
                        type="tel"
                        id="floating_phone"
                        required
                        value={formData.phone}
                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                        className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-400 transition"
                        placeholder="08xxxxxxxxxx"
                      />
                    </label>
                  </div>
                  <label className="flex flex-col gap-1 text-xs font-semibold text-gray-700">
                    Minat Jurusan
                    <select
                      id="floating_major"
                      required
                      value={formData.major}
                      onChange={(e) => setFormData({...formData, major: e.target.value})}
                      className={`${styles.selectFancy} rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-400 transition text-gray-800`}
                    >
                      <option value="" disabled hidden>Pilih jurusan</option>
                      <option value="Sistem Informasi">Sistem Informasi</option>
                      <option value="Informatika">Informatika</option>
                      <option value="Psikologi">Psikologi</option>
                      <option value="Manajemen">Manajemen</option>
                      <option value="Akuntansi">Akuntansi</option>
                      <option value="Teknik Sipil">Teknik Sipil</option>
                      <option value="Arsitektur">Arsitektur</option>
                    </select>
                  </label>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-500 text-white font-semibold py-3 rounded-xl shadow-md hover:shadow-lg transition disabled:opacity-70 text-sm flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? "Menyimpan..." : <>Kirim Data <span aria-hidden>🚀</span></>}
                  </button>
                </form>
              </div>
            ) : (
              // BUBBLE TEKS BIASA
              <div
                className={`relative p-3.5 pb-3 leading-relaxed text-[14px] w-full sm:w-auto ${
                  msg.sender === "user" 
                    ? "text-white rounded-2xl rounded-tr-none bg-blue-600 border border-blue-700 shadow-lg shadow-blue-900/25 max-w-[90vw] sm:max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl"
                    : "bg-white/70 backdrop-blur text-gray-800 border border-white/70 shadow-lg shadow-blue-900/10 rounded-2xl rounded-tl-none max-w-[90vw] sm:max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl"
                }`}
              >
                {msg.sender === "bot" ? (
                  <div
                    className={`space-y-2 ${styles.botContent}`}
                    dangerouslySetInnerHTML={{ __html: msg.text }}
                  />
                ) : (
                  <div dangerouslySetInnerHTML={{ __html: msg.text }} />
                )}
              </div>
            )}
            {/* Tombol copy & feedback di bawah bubble, rata kiri */}
            {msg.sender === "bot" && !msg.isForm && msg.text && (
              <div className="flex gap-2 mt-1 mb-2">
                <button
                  onClick={() => handleCopy(msg.text, `${idx}`)}
                  className="text-[11px] text-blue-700 bg-white/95 border border-blue-200 rounded-full px-2 py-1 shadow-sm hover:bg-white transition-colors"
                  title="Salin jawaban"
                  aria-label="Salin jawaban"
                >
                  {copiedId === `${idx}` ? (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
                      <path d="M9.5 13.5l-2-2a.75.75 0 10-1.06 1.06l2.53 2.53a1 1 0 001.42 0l6.63-6.63a.75.75 0 00-1.06-1.06L9.5 13.5z" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
                      <path d="M9 3a3 3 0 00-3 3v9a3 3 0 003 3h6a3 3 0 003-3V6a3 3 0 00-3-3H9zm0 1.5h6c.828 0 1.5.672 1.5 1.5v9c0 .828-.672 1.5-1.5 1.5H9A1.5 1.5 0 017.5 15V6A1.5 1.5 0 019 4.5zm-3 4.25a.75.75 0 00-.75.75v6.5A4 4 0 009 20.5h6a.75.75 0 000-1.5H9a2.5 2.5 0 01-2.5-2.5v-6.5a.75.75 0 00-.75-.75z"/>
                    </svg>
                  )}
                </button>
                {!msg.feedbackGiven && (
                  <>
                    <button
                      className="text-[11px] bg-white/95 border border-blue-200 rounded-full px-2 py-1 shadow-sm hover:bg-blue-100 text-blue-700 font-bold transition-colors"
                      onClick={() => handleFeedback(idx, true)}
                      aria-label="Jawaban membantu"
                      title="Jawaban membantu"
                    >👍</button>
                    <button
                      className="text-[11px] bg-white/95 border border-blue-200 rounded-full px-2 py-1 shadow-sm hover:bg-red-100 text-red-600 font-bold transition-colors"
                      onClick={() => handleFeedback(idx, false)}
                      aria-label="Jawaban tidak membantu"
                      title="Jawaban tidak membantu"
                    >👎</button>
                  </>
                )}
                {msg.feedbackGiven && (
                  <span className={`text-[11px] font-bold self-center ${msg.feedbackHelpful ? 'text-blue-700' : 'text-red-600'}`}>{msg.feedbackHelpful ? '👍 Terima kasih!' : '👎 Terima kasih!'}</span>
                )}
              </div>
            )}
          </div>
        ))}
        
        {isLoading && (
          <div className="w-full max-w-5xl mx-auto flex items-center gap-2">
            <div className="flex items-center justify-center mr-2 mt-1 drop-shadow-sm">
              {/* SVG robot icon modern */}
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="6" y="10" width="24" height="18" rx="8" fill="#2563eb"/>
                <rect x="10" y="14" width="16" height="10" rx="5" fill="#fff"/>
                <circle cx="14.5" cy="19" r="1.5" fill="#2563eb"/>
                <circle cx="21.5" cy="19" r="1.5" fill="#2563eb"/>
                <rect x="16" y="6" width="4" height="6" rx="2" fill="#2563eb"/>
                <rect x="8" y="24" width="4" height="4" rx="2" fill="#2563eb"/>
                <rect x="24" y="24" width="4" height="4" rx="2" fill="#2563eb"/>
              </svg>
            </div>
            <div className="bg-white p-3 rounded-2xl rounded-tl-none border border-gray-200 text-gray-500 text-sm shadow-sm flex items-center gap-1">
              <span className="animate-bounce">●</span><span className="animate-bounce delay-100">●</span><span className="animate-bounce delay-200">●</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-20 px-4 pb-4">
        <div className="w-full max-w-xl mx-auto mb-2.5">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide mobile-scroll-hide">
            {quickReplies.map((reply, idx) => (
              <button
                key={idx}
                onClick={() => sendMessage(undefined, reply)}
                disabled={isLoading}
                className="whitespace-nowrap bg-white/80 backdrop-blur text-blue-700 border border-blue-200 rounded-full px-4 py-1.5 text-xs sm:text-sm cursor-pointer font-semibold transition-all flex-shrink-0 disabled:opacity-50 shadow-sm hover:bg-blue-600 hover:text-white hover:border-blue-400 hover:shadow"
              >
                {reply}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={sendMessage} className="flex gap-2 max-w-xl mx-auto w-full">
          <div className={`${styles.glowBorder} flex-1 rounded-full`}>
            <div className="relative">
              <input
                type="text" 
                value={input} 
                onChange={(e) => setInput(e.target.value)} 
                disabled={isLoading} 
                maxLength={500} 
                placeholder="Ketik pesan di sini..."
                className="relative z-10 block w-full p-3.5 text-[14px] bg-white/80 backdrop-blur rounded-full border border-gray-200 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-200 transition-all shadow placeholder:text-gray-500 hover:border-blue-300 hover:shadow-md"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="bg-blue-600 text-white border-none rounded-full w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center cursor-pointer disabled:bg-gray-400 transition-colors shadow-md flex-shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 ml-1">
              <path d="M3.478 2.404a.75.75 0 00-.926.941l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.404z" />
            </svg>
          </button>
        </form>
      </div>
      </div>
    </div>
  );
}
