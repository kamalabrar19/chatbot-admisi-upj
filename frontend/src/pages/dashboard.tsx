"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, getDocs, addDoc, deleteDoc, doc, writeBatch, query, orderBy, limit, updateDoc } from "firebase/firestore";
import * as XLSX from "xlsx";
import styles from "../styles/dashboard.module.css";
import Head from "next/head";

interface FAQ { id: string; q: string; a: string; }
interface ChatLog { id: string; user_message: string; bot_response: string; timestamp: any; }
interface Lead { id: string; nama: string; whatsapp: string; minat_jurusan: string; waktu_daftar: any; }

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();

  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [chatLogs, setChatLogs] = useState<ChatLog[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [newQ, setNewQ] = useState("");
  const [newA, setNewA] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [isUploading, setIsUploading] = useState(false);
  const [leadSearch, setLeadSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQ, setEditQ] = useState("");
  const [editA, setEditA] = useState("");

  // ==========================================
  // STATE KHUSUS AUTO-SCRAPER AI
  // ==========================================
  const [scrapeUrl, setScrapeUrl] = useState("");
  const [isScraping, setIsScraping] = useState(false);
  const [isSavingScrape, setIsSavingScrape] = useState(false);
  const [previewData, setPreviewData] = useState<{ q: string; a: string }[]>([]);
  const [scrapeStatus, setScrapeStatus] = useState({ type: "", text: "" });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) router.push("/login");
      else {
        setUser(currentUser);
        fetchData();
      }
    });
    return () => unsubscribe();
  }, [router]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const faqSnapshot = await getDocs(collection(db, "faq"));
      const faqData: FAQ[] = faqSnapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as any) }));

      const logsQuery = query(collection(db, "chat_logs"), orderBy("timestamp", "desc"), limit(50));
      const logsSnapshot = await getDocs(logsQuery);
      const logsData: ChatLog[] = logsSnapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as any) }));

      const leadsSnapshot = await getDocs(collection(db, "leads"));
      const leadsData: Lead[] = leadsSnapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as any) }));

      setFaqs(faqData);
      setChatLogs(logsData);
      setLeads(leadsData);
    } catch (error) {
      console.error("Error fetching data: ", error);
      setStatus({ type: "error", message: "Gagal mengambil data." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/mainpage");
  };

  const addFAQ = async () => {
    if (!newQ.trim() || !newA.trim()) return;
    try {
      const docRef = await addDoc(collection(db, "faq"), { q: newQ, a: newA });
      setFaqs([...faqs, { id: docRef.id, q: newQ, a: newA }]);
      setNewQ("");
      setNewA("");
      setStatus({ type: "success", message: "FAQ ditambahkan." });
    } catch (error) {
      console.error("Error adding FAQ: ", error);
      setStatus({ type: "error", message: "Gagal menambahkan FAQ." });
    }
  };

  const deleteFAQ = async (id: string) => {
    try {
      await deleteDoc(doc(db, "faq", id));
      setFaqs(faqs.filter((f) => f.id !== id));
    } catch (error) {
      console.error("Error deleting FAQ: ", error);
    }
  };

  const updateFAQ = async (id: string, updatedQ: string, updatedA: string) => {
    if (!updatedQ.trim() || !updatedA.trim()) return;
    try {
      await updateDoc(doc(db, "faq", id), { q: updatedQ, a: updatedA });
      setFaqs(faqs.map((f) => f.id === id ? { id, q: updatedQ, a: updatedA } : f));
      setEditingId(null);
      setEditQ("");
      setEditA("");
      setStatus({ type: "success", message: "FAQ berhasil diperbarui." });
    } catch (error) {
      console.error("Error updating FAQ: ", error);
      setStatus({ type: "error", message: "Gagal memperbarui FAQ." });
    }
  };

  const startEdit = (faq: FAQ) => {
    setEditingId(faq.id);
    setEditQ(faq.q);
    setEditA(faq.a);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditQ("");
    setEditA("");
  };

  const handleFileUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData: any[] = XLSX.utils.sheet_to_json(sheet);

      const batch = writeBatch(db);
      let count = 0; 

      jsonData.forEach((row) => {
        const pertanyaan = row.Pertanyaan || row.pertanyaan || row.Q || row.q || "";
        const jawaban = row.Jawaban || row.jawaban || row.A || row.a || "";

        if (String(pertanyaan).trim() !== "" && String(jawaban).trim() !== "") {
          const docRef = doc(collection(db, "faq"));
          batch.set(docRef, { 
            q: String(pertanyaan).trim(), 
            a: String(jawaban).trim() 
          });
          count++;
        }
      });

      if (count > 0) {
        await batch.commit();
        setStatus({ type: "success", message: `Upload ${count} data berhasil.` });
        fetchData();
      } else {
        setStatus({ type: "error", message: "Gagal: Format kolom tidak sesuai atau Excel kosong." });
      }

    } catch (error) {
      console.error("Error uploading file: ", error);
      setStatus({ type: "error", message: "Gagal upload." });
    } finally {
      setIsUploading(false);
    }
  };

  const deleteChatLog = async (id: string) => {
    try {
      await deleteDoc(doc(db, "chat_logs", id));
      setChatLogs(chatLogs.filter((log) => log.id !== id));
    } catch (error) {
      console.error("Error deleting chat log: ", error);
    }
  };

  const deleteAllChatLogs = async () => {
    try {
      const logsSnapshot = await getDocs(collection(db, "chat_logs"));
      const batch = writeBatch(db);
      logsSnapshot.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      setChatLogs([]);
    } catch (error) {
      console.error("Error deleting all chat logs: ", error);
    }
  };

  // ==========================================
  // LOGIKA AUTO-SCRAPER AI
  // ==========================================
  const handleScrape = async () => {
    if (!scrapeUrl) return alert("Masukkan URL dulu, Kak!");
    setIsScraping(true);
    setScrapeStatus({ type: "info", text: "🤖 Sedang menyedot web & menyuruh AI berpikir..." });

    try {
      const response = await fetch("http://localhost:5000/api/scrape", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.NEXT_PUBLIC_ADMIN_SECRET_TOKEN}`
        },
        body: JSON.stringify({ url: scrapeUrl }),
      });

      const result = await response.json();

      if (response.ok && result.status === "success") {
        setPreviewData(result.data);
        setScrapeStatus({ type: "success", text: `✨ Berhasil menemukan ${result.data.length} FAQ! Silakan kurasi di bawah.` });
      } else {
        setScrapeStatus({ type: "error", text: result.error || "Gagal melakukan scraping." });
      }
    } catch (error) {
      console.error(error);
      setScrapeStatus({ type: "error", text: "Gagal menghubungi server Backend Python." });
    } finally {
      setIsScraping(false);
    }
  };

  const handleEditScrape = (index: number, field: "q" | "a", value: string) => {
    const newData = [...previewData];
    newData[index][field] = value;
    setPreviewData(newData);
  };

  const handleDeleteScrapeRow = (index: number) => {
    const newData = previewData.filter((_, i) => i !== index);
    setPreviewData(newData);
  };

  const handleSaveScrapeToFirestore = async () => {
    if (previewData.length === 0) return alert("Tidak ada data untuk disimpan!");
    setIsSavingScrape(true);
    setScrapeStatus({ type: "info", text: "💾 Sedang menyimpan ke Database..." });

    try {
      const faqCollection = collection(db, "faq"); 
      const batch = writeBatch(db);
      let count = 0;
      
      for (const item of previewData) {
        if (item.q.trim() !== "" && item.a.trim() !== "") {
          const docRef = doc(faqCollection);
          batch.set(docRef, { q: item.q.trim(), a: item.a.trim() });
          count++;
        }
      }
      
      if (count > 0) {
        await batch.commit();
        setScrapeStatus({ type: "success", text: `🎉 SUKSES! ${count} FAQ berhasil masuk ke Firestore!` });
        setPreviewData([]); 
        setScrapeUrl("");
        fetchData(); // Refresh tabel FAQ utama
      } else {
        setScrapeStatus({ type: "error", text: "Semua baris kosong, tidak ada yang disimpan." });
      }
    } catch (error) {
      console.error(error);
      setScrapeStatus({ type: "error", text: "❌ Gagal menyimpan ke database." });
    } finally {
      setIsSavingScrape(false);
    }
  };

  // ==========================================
  // KALKULASI STATISTIK & INSIGHT
  // ==========================================
  const totalFaqs = faqs.length;
  const totalLeads = leads.length;
  const totalLogs = chatLogs.length;
  const uniqueMajors = Array.from(new Set(leads.map((l) => l.minat_jurusan || "Lainnya")));
  const topMajor = Object.entries(
    leads.reduce<Record<string, number>>((acc, l) => {
      const key = l.minat_jurusan || "Lainnya";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1])[0]?.[0] || "-";

  const leadByMajor: Record<string, number> = {};
  leads.forEach((l) => {
    const key = l.minat_jurusan || "Lainnya";
    leadByMajor[key] = (leadByMajor[key] || 0) + 1;
  });
  const maxLeadCount = Math.max(1, ...Object.values(leadByMajor));

  const logsByDay: Record<string, number> = {};
  chatLogs.forEach((log) => {
    const d = log.timestamp?.toDate?.() || new Date();
    const key = d.toISOString().slice(0, 10);
    logsByDay[key] = (logsByDay[key] || 0) + 1;
  });
  const sortedDays = Object.keys(logsByDay).sort().slice(-7);
  const maxLogCount = Math.max(1, ...sortedDays.map((d) => logsByDay[d]));

  const sparklinePoints = sortedDays.map((d, idx) => {
    const x = (idx / Math.max(sortedDays.length - 1, 1)) * 100;
    const y = 40 - (logsByDay[d] / maxLogCount) * 40;
    return `${x},${y}`;
  }).join(" ");

  // ==========================================
  // FITUR EXPORT EXCEL
  // ==========================================
  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(faqs.map(({ q, a }) => ({ pertanyaan: q, jawaban: a })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "FAQ");
    XLSX.writeFile(wb, "faq_export.xlsx");
  };

  const exportLeadsToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(leads.map(({ nama, whatsapp, minat_jurusan, waktu_daftar }) => ({
      nama,
      whatsapp,
      minat_jurusan,
      waktu_daftar: waktu_daftar?.toDate ? waktu_daftar.toDate().toISOString() : "",
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Leads");
    XLSX.writeFile(wb, "leads_export.xlsx");
  };

  const exportAnalyticsToExcel = () => {
    const overviewData = [
      { Metrik: "Total Calon Mahasiswa (Leads)", Nilai: totalLeads },
      { Metrik: "Jumlah Variasi Jurusan Diminati", Nilai: uniqueMajors.length },
      { Metrik: "Total FAQ Terdaftar", Nilai: totalFaqs },
      { Metrik: "Total Riwayat Chat (Tersimpan)", Nilai: totalLogs },
      { Metrik: "Jurusan Paling Diminati", Nilai: topMajor },
    ];
    const wsOverview = XLSX.utils.json_to_sheet(overviewData);

    const leadsByMajorData = Object.entries(leadByMajor).map(([jurusan, jumlah]) => ({
      Jurusan: jurusan,
      "Jumlah Leads": jumlah
    }));
    const wsLeadsByMajor = XLSX.utils.json_to_sheet(leadsByMajorData);

    const chatsByDayData = Object.entries(logsByDay).map(([tanggal, jumlah]) => ({
      Tanggal: tanggal,
      "Jumlah Chat": jumlah
    }));
    const wsChatsByDay = XLSX.utils.json_to_sheet(chatsByDayData);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsOverview, "Overview");
    XLSX.utils.book_append_sheet(wb, wsLeadsByMajor, "Distribusi Jurusan");
    XLSX.utils.book_append_sheet(wb, wsChatsByDay, "Aktivitas Chat");

    XLSX.writeFile(wb, "laporan_analytics_admisi.xlsx");
  };

  const filteredLeads = useMemo(() => {
    if (!leadSearch.trim()) return leads;
    const term = leadSearch.toLowerCase();
    return leads.filter(
      (l) =>
        l.nama?.toLowerCase().includes(term) ||
        l.whatsapp?.toLowerCase().includes(term) ||
        l.minat_jurusan?.toLowerCase().includes(term)
    );
  }, [leadSearch, leads]);

  const sections = [
    { id: "overview", label: "Overview" },
    { id: "charts", label: "Insight" },
    { id: "scraper", label: "Auto-Scraper AI" }, // MENU BARU
    { id: "faq", label: "FAQ" },
    { id: "logs", label: "Chat Logs" },
    { id: "leads", label: "Leads" },
  ];

  if (!user) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-600">Memuat...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans">
      <Head>
        <title>Admin • Admisi UPJ</title>
      </Head>
      <header className="bg-white/95 backdrop-blur border-b border-gray-100 sticky top-0 z-30 shadow-[0_12px_30px_-18px_rgba(15,23,42,0.25)]">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/images/logo-upj.svg" alt="UPJ" className="w-10 h-10 rounded-xl bg-white border border-blue-100 p-1 shadow-sm" />
            <div>
              <h1 className="text-xl font-bold text-blue-900 tracking-tight">Admisi UPJ • Admin</h1>
              <p className="text-xs text-gray-500">Monitoring chatbot, leads, dan FAQ</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="sm:hidden px-3 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-100"
              aria-label="Toggle menu"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            

            <div className="hidden sm:flex items-center gap-4 border-l border-gray-200 pl-4">
              <div className="flex flex-col items-end leading-tight">
                <span className="text-sm font-semibold text-blue-900">{user.email}</span>
                <span className="text-[11px] text-gray-500">Super Admin</span>
              </div>
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 rounded-lg text-sm font-bold transition-colors"
              >
                Keluar
              </button>
            </div>

          </div>
        </div>
        {menuOpen && (
          <div className="sm:hidden border-t border-gray-100 bg-white px-4 pb-3 shadow-[0_14px_32px_-18px_rgba(15,23,42,0.35)]">
            <div className="flex flex-col gap-2 py-2">
              {sections.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center justify-between text-sm font-semibold text-blue-900 py-2 px-2 rounded-lg hover:bg-blue-50 border border-transparent hover:border-blue-100 transition"
                >
                  {s.label}
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </a>
              ))}
              <button
                onClick={handleLogout}
                className="mt-2 w-full px-3 py-2 bg-red-500 text-white rounded-lg text-sm font-semibold hover:bg-red-600 shadow-sm flex items-center justify-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8v8a4 4 0 004 4h6" />
                </svg>
                Keluar
              </button>
            </div>
          </div>
        )}
      </header>

      <div className={`max-w-6xl mx-auto px-4 py-6 ${styles.layout}`}>
        <aside className={styles.sidebar}>
          <nav className="flex flex-col gap-2">
            {sections.map((s) => (
              <a key={s.id} href={`#${s.id}`} className={styles.navItem}>
                {s.label}
              </a>
            ))}
          </nav>
        </aside>

        <main className={styles.main}>
          <section id="overview" className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2>Overview</h2>
                <span className={styles.subtle}>Ringkasan cepat performa chatbot</span>
              </div>
              <button onClick={exportAnalyticsToExcel} className={`${styles.btn} ${styles.btnSuccess}`}>
                Export Insight (.xlsx)
              </button>
            </div>
            <div className={styles.gridCards}>
              <div className={styles.statCard}>
                <p>Total Leads</p>
                <strong>{totalLeads}</strong>
                <span>{uniqueMajors.length} minat jurusan</span>
              </div>
              <div className={styles.statCard}>
                <p>FAQ Tersedia</p>
                <strong>{totalFaqs}</strong>
                <span>Pertanyaan terdaftar</span>
              </div>
              <div className={styles.statCard}>
                <p>Chat Log (50)</p>
                <strong>{totalLogs}</strong>
                <span>Terbaru tersimpan</span>
              </div>
              <div className={styles.statCard}>
                <p>Jurusan Teratas</p>
                <strong>{topMajor}</strong>
                <span>Minat tertinggi saat ini</span>
              </div>
            </div>
          </section>

          <section id="charts" className={styles.card}>
            <div className={styles.cardHeader}>
              <h2>Insight</h2>
              <span className={styles.subtle}>Distribusi data</span>
            </div>
            <div className={styles.charts}>
              <div className={styles.chartBlock}>
                <div className={styles.chartTitle}>Leads per Jurusan</div>
                <div className={styles.barList}>
                  {Object.keys(leadByMajor).length === 0 && (
                    <p className={styles.muted}>Belum ada data leads.</p>
                  )}
                  {Object.entries(leadByMajor).map(([major, count]) => (
                    <div key={major} className={styles.barRow}>
                      <span className={styles.barLabel}>{major}</span>
                      <div className={styles.barTrack}>
                        <div
                          className={styles.barFill}
                          style={{ width: `${(count / maxLeadCount) * 100}%` }}
                          aria-label={`${major} ${count}`}
                        />
                      </div>
                      <span className={styles.barValue}>{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className={styles.chartBlock}>
                <div className={styles.chartTitle}>Chat per Hari (7 hari)</div>
                {sortedDays.length === 0 ? (
                  <p className={styles.muted}>Belum ada log.</p>
                ) : (
                  <div className={styles.sparklineWrap}>
                    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className={styles.sparkline}>
                      <polyline
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="2.2"
                        points={sparklinePoints}
                      />
                      {sortedDays.map((d, idx) => {
                        const x = (idx / Math.max(sortedDays.length - 1, 1)) * 100;
                        const y = 40 - (logsByDay[d] / maxLogCount) * 40;
                        return <circle key={d} cx={x} cy={y} r="1.8" fill="#10b981" />;
                      })}
                    </svg>
                    <div className={styles.sparkMeta}>
                      <span className={styles.muted}>Rentang: {sortedDays[0]} s.d. {sortedDays[sortedDays.length - 1]}</span>
                      <span className={styles.sparkValue}>Puncak {maxLogCount} chat/hari</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* ========================================== */}
          {/* SECTION BARU: AUTO-SCRAPER AI */}
          {/* ========================================== */}
          <section id="scraper" className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2>Auto-Scraper AI</h2>
                <span className={styles.subtle}>Sedot info dari website kampus jadi FAQ</span>
              </div>
            </div>
            
            <div className="p-4 border border-gray-100 rounded-lg bg-white mb-4 shadow-sm">
              <label className="block text-sm font-semibold text-gray-700 mb-2">URL Target (Contoh: https://upj.ac.id/tentang-kami)</label>
              <div className="flex gap-3">
                <input
                  type="url"
                  value={scrapeUrl}
                  onChange={(e) => setScrapeUrl(e.target.value)}
                  placeholder="Masukkan link website..."
                  className="flex-1 p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                />
                <button
                  onClick={handleScrape}
                  disabled={isScraping}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-5 rounded transition-all disabled:opacity-50 text-sm whitespace-nowrap"
                >
                  {isScraping ? "Menyedot..." : "Mulai Scrape"}
                </button>
              </div>

              {scrapeStatus.text && (
                <div className={`mt-3 p-2 rounded text-sm font-medium ${scrapeStatus.type === "error" ? "bg-red-100 text-red-700" : scrapeStatus.type === "success" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
                  {scrapeStatus.text}
                </div>
              )}
            </div>

            {previewData.length > 0 && (
              <div className="border border-blue-100 rounded-lg bg-blue-50 p-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-md font-bold text-blue-900">Tabel Kurasi (Preview)</h3>
                  <button
                    onClick={handleSaveScrapeToFirestore}
                    disabled={isSavingScrape}
                    className="bg-green-600 hover:bg-green-700 text-white font-bold py-1.5 px-4 rounded text-sm transition-all disabled:opacity-50"
                  >
                    {isSavingScrape ? "Menyimpan..." : "ACC & Simpan ke Firestore"}
                  </button>
                </div>

                <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                  {previewData.map((item, index) => (
                    <div key={index} className="flex gap-3 p-3 border border-white rounded bg-white items-start shadow-sm">
                      <div className="font-bold text-gray-400 text-sm mt-1">#{index + 1}</div>
                      <div className="flex-1 space-y-2">
                        <div>
                          <input
                            type="text"
                            value={item.q}
                            onChange={(e) => handleEditScrape(index, "q", e.target.value)}
                            className="w-full p-2 border border-gray-200 rounded focus:border-blue-500 outline-none text-black font-semibold text-sm"
                            placeholder="Pertanyaan"
                          />
                        </div>
                        <div>
                          <textarea
                            value={item.a}
                            onChange={(e) => handleEditScrape(index, "a", e.target.value)}
                            rows={2}
                            className="w-full p-2 border border-gray-200 rounded focus:border-blue-500 outline-none text-black text-sm"
                            placeholder="Jawaban"
                          />
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteScrapeRow(index)}
                        className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-all mt-1"
                        title="Hapus baris ini"
                      >
                        ❌
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section id="faq" className={styles.card}>
            <div className={styles.cardHeader}>
              <h2>FAQ</h2>
              <div className={styles.cardActions}>
                <button onClick={exportToExcel} className={`${styles.btn} ${styles.btnSuccess}`}>Export FAQ</button>
                <label className={`${styles.btn} ${styles.btnPrimary} cursor-pointer`}>
                  Upload FAQ (xlsx)
                  <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                </label>
                <button onClick={handleFileUpload} disabled={!file || isUploading} className={`${styles.btn} ${styles.btnIndigo} ${(!file || isUploading) ? styles.btnDisabled : ""}`}>{isUploading ? "Uploading..." : "Upload"}</button>
              </div>
            </div>
            <div className={styles.faqGrid}>
              {faqs.map((faq) => (
                <div key={faq.id} className={`${styles.faqItem} ${editingId === faq.id ? "border-2 border-blue-500 bg-blue-50" : ""}`}>
                  {editingId === faq.id ? (
                    <>
                      <div className="space-y-2 mb-3">
                        <input
                          type="text"
                          value={editQ}
                          onChange={(e) => setEditQ(e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                          placeholder="Pertanyaan"
                        />
                        <textarea
                          value={editA}
                          onChange={(e) => setEditA(e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm h-20"
                          placeholder="Jawaban"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateFAQ(faq.id, editQ, editA)}
                          className="flex-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-semibold transition"
                        >
                          Simpan
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="flex-1 px-3 py-1.5 bg-gray-400 hover:bg-gray-500 text-white rounded text-sm font-semibold transition"
                        >
                          Batal
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className={styles.faqQuestion}>{faq.q}</div>
                      <div className={styles.faqAnswer}>{faq.a}</div>
                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => startEdit(faq)}
                          className={`flex-1 ${styles.linkInfo}`}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteFAQ(faq.id)}
                          className={`flex-1 ${styles.linkDanger}`}
                        >
                          Hapus
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
              {faqs.length === 0 && <p className={styles.muted}>Belum ada FAQ.</p>}
            </div>
            <div className={styles.formInline}>
              <input value={newQ} onChange={(e) => setNewQ(e.target.value)} placeholder="Pertanyaan" className={styles.input} />
              <textarea value={newA} onChange={(e) => setNewA(e.target.value)} placeholder="Jawaban" className={`${styles.input} h-20`} />
              <button onClick={addFAQ} className={`${styles.btn} ${styles.btnPrimary}`}>Tambah FAQ</button>
            </div>
          </section>

          <section id="logs" className={styles.card}>
            <div className={styles.cardHeader}>
              <h2>Chat Logs (50 terbaru)</h2>
              <button onClick={deleteAllChatLogs} className={`${styles.btn} ${styles.btnDanger} ${styles.btnGhost}`}>Hapus Semua</button>
            </div>
            <div className={styles.listScroll}>
              {chatLogs.map((log) => (
                <div key={log.id} className={styles.listItem}>
                  <div className="font-semibold text-gray-800">User: {log.user_message}</div>
                  <div className="text-gray-700">Bot: {log.bot_response}</div>
                  <div className="text-[11px] text-gray-500">{log.timestamp?.toDate?.().toLocaleString?.() || ""}</div>
                  <button onClick={() => deleteChatLog(log.id)} className={styles.linkDanger}>Hapus</button>
                </div>
              ))}
              {chatLogs.length === 0 && <p className={styles.muted}>Belum ada log.</p>}
            </div>
          </section>

          <section id="leads" className={styles.card}>
            <div className={styles.cardHeader}>
              <h2>Leads</h2>
              <div className={styles.cardActions}>
                <input
                  value={leadSearch}
                  onChange={(e) => setLeadSearch(e.target.value)}
                  placeholder="Cari nama / WA / jurusan"
                  className={styles.input}
                  aria-label="Cari leads"
                />
                <button onClick={exportLeadsToExcel} className={`${styles.btn} ${styles.btnSuccess}`}>Export Leads</button>
              </div>
            </div>
            <div className={styles.listScroll}>
              {filteredLeads.map((lead) => (
                <div key={lead.id} className={styles.listItem}>
                  <div className="font-semibold text-gray-800">{lead.nama}</div>
                  <div className="text-gray-700">{lead.whatsapp}</div>
                  <div className="text-gray-700">{lead.minat_jurusan}</div>
                  <div className="text-[11px] text-gray-500">{lead.waktu_daftar?.toDate?.().toLocaleString?.() || ""}</div>
                </div>
              ))}
              {filteredLeads.length === 0 && <p className={styles.muted}>Tidak ada data cocok.</p>}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}