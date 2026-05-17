"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, getDocs, addDoc, deleteDoc, doc, writeBatch, query, orderBy, limit, updateDoc } from "firebase/firestore";
import * as XLSX from "xlsx";
import styles from "../styles/dashboard.module.css";
import Head from "next/head";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, AreaChart, Area, PieChart, Pie, Cell } from "recharts";


interface FeedbackRecap {
  id: string;
  text: string;
  isHelpful: boolean;
  timestamp: any;
}
interface FAQ { id: string; q: string; a: string; }
interface ChatLog { id: string; user_message: string; bot_response: string; timestamp: any; }
interface Lead { id: string; nama: string; whatsapp: string; minat_jurusan: string; waktu_daftar: any; }

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  // FEEDBACK STATE
  const [feedbacks, setFeedbacks] = useState<FeedbackRecap[]>([]);
  const [isLoadingFeedback, setIsLoadingFeedback] = useState(true);

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
  const [faqSearch, setFaqSearch] = useState("");
  const [chatLogSearch, setChatLogSearch] = useState("");
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
  const [scrapeScope, setScrapeScope] = useState<"exact" | "path">("exact");
  const [scrapeMetrics, setScrapeMetrics] = useState<{
    quality_score: number;
    quality_label: string;
    completeness_rate: number;
    question_format_rate: number;
    answer_completeness_rate: number;
    avg_question_length: number;
    avg_answer_length: number;
    source_text_length: number;
    source_length_score: number;
    faq_count: number;
    valid_pairs: number;
    scope: "exact" | "path";
    pages_scanned: number;
    note: string;
  } | null>(null);
  const [scrapeStatus, setScrapeStatus] = useState({ type: "", text: "" });

  // ==========================================
  // STATE KHUSUS SETTINGS API
  // ==========================================
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsStatus, setSettingsStatus] = useState({ type: "", text: "" });
  const [promptLoading, setPromptLoading] = useState(false);
  const [promptSaving, setPromptSaving] = useState(false);
  const [promptStatus, setPromptStatus] = useState({ type: "", text: "" });
  const [settingsData, setSettingsData] = useState({
    geminiApiKey1: "",
    geminiApiKey2: "",
    geminiApiKey3: "",
    geminiModelDefault: "gemini-2.5-flash",
    geminiModel1: "",
    geminiModel2: "",
    geminiModel3: "",
    currentMaskedKey1: "",
    currentMaskedKey2: "",
    currentMaskedKey3: "",
    currentModel1: "",
    currentModel2: "",
    currentModel3: "",
    isKey1Set: false,
    isKey2Set: false,
    isKey3Set: false,
  });
  const [promptText, setPromptText] = useState("");

  // FAQ show more/less state
  const [showAllFaqs, setShowAllFaqs] = useState(false);
  const [activeSection, setActiveSection] = useState("overview");


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) router.push("/login");
      else {
        setUser(currentUser);
        fetchData();
        fetchFeedbacks();
      }
    });
    return () => unsubscribe();
  }, [router]);

  // Fetch feedback recap
  const fetchFeedbacks = async () => {
    setIsLoadingFeedback(true);
    try {
      const fbQuery = query(collection(db, "chatbot_feedback"), orderBy("timestamp", "desc"), limit(50));
      const fbSnap = await getDocs(fbQuery);
      setFeedbacks(fbSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) })));
    } catch (e) {
      setFeedbacks([]);
    } finally {
      setIsLoadingFeedback(false);
    }
  };

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
        body: JSON.stringify({ url: scrapeUrl, scope: scrapeScope }),
      });

      const result = await response.json();

      if (response.ok && result.status === "success") {
        setPreviewData(result.data);
        setScrapeMetrics(result.metrics ? {
          ...result.metrics,
          scope: result.scope || scrapeScope,
          pages_scanned: typeof result.pages_scanned === "number" ? result.pages_scanned : 1,
        } : null);
        const qualityScore = typeof result.metrics?.quality_score === "number" ? result.metrics.quality_score : null;
        setScrapeStatus({
          type: "success",
          text: qualityScore !== null
            ? `✨ Berhasil menemukan ${result.data.length} FAQ! Skor kualitas scrape: ${qualityScore}/100.`
            : `✨ Berhasil menemukan ${result.data.length} FAQ! Silakan kurasi di bawah.`,
        });
      } else {
        setScrapeMetrics(result.metrics ? {
          ...result.metrics,
          scope: result.scope || scrapeScope,
          pages_scanned: typeof result.pages_scanned === "number" ? result.pages_scanned : 0,
        } : null);
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

  const handleCancelScrape = () => {
    setIsScraping(false);
    setScrapeStatus({ type: "", text: "" });
    setScrapeUrl("");
    setScrapeScope("exact");
    setPreviewData([]);
    setScrapeMetrics(null);
  };

  const fetchAdminSettings = async () => {
    setSettingsLoading(true);
    setSettingsStatus({ type: "", text: "" });
    try {
      const token = process.env.NEXT_PUBLIC_ADMIN_SECRET_TOKEN;
      if (!token) {
        setSettingsStatus({ type: "error", text: "Token admin frontend belum diatur (NEXT_PUBLIC_ADMIN_SECRET_TOKEN)." });
        return;
      }

      const res = await fetch("http://localhost:5000/api/admin/settings", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      const payload = await res.json();

      if (!res.ok || payload.status !== "success") {
        setSettingsStatus({ type: "error", text: payload.error || "Gagal mengambil pengaturan API." });
        return;
      }

      setSettingsData((prev) => ({
        ...prev,
        geminiModelDefault: payload.data?.gemini_model_default || "gemini-2.5-flash",
        currentMaskedKey1: payload.data?.gemini_api_key_1_masked || "",
        currentMaskedKey2: payload.data?.gemini_api_key_2_masked || "",
        currentMaskedKey3: payload.data?.gemini_api_key_3_masked || "",
        currentModel1: payload.data?.gemini_model_1 || "",
        currentModel2: payload.data?.gemini_model_2 || "",
        currentModel3: payload.data?.gemini_model_3 || "",
        isKey1Set: Boolean(payload.data?.gemini_api_key_1_set),
        isKey2Set: Boolean(payload.data?.gemini_api_key_2_set),
        isKey3Set: Boolean(payload.data?.gemini_api_key_3_set),
      }));
    } catch (error) {
      setSettingsStatus({ type: "error", text: "Gagal menghubungi backend settings API." });
    } finally {
      setSettingsLoading(false);
    }
  };

  const saveAdminSettings = async () => {
    setSettingsSaving(true);
    setSettingsStatus({ type: "", text: "" });
    try {
      const token = process.env.NEXT_PUBLIC_ADMIN_SECRET_TOKEN;
      if (!token) {
        setSettingsStatus({ type: "error", text: "Token admin frontend belum diatur (NEXT_PUBLIC_ADMIN_SECRET_TOKEN)." });
        return;
      }

      const body: any = {
        gemini_model_default: settingsData.geminiModelDefault,
      };

      if (settingsData.geminiApiKey1.trim()) {
        body.gemini_api_key_1 = settingsData.geminiApiKey1.trim();
      }
      if (settingsData.geminiApiKey2.trim()) {
        body.gemini_api_key_2 = settingsData.geminiApiKey2.trim();
      }
      if (settingsData.geminiApiKey3.trim()) {
        body.gemini_api_key_3 = settingsData.geminiApiKey3.trim();
      }
      if (settingsData.geminiModel1.trim()) {
        body.gemini_model_1 = settingsData.geminiModel1.trim();
      }
      if (settingsData.geminiModel2.trim()) {
        body.gemini_model_2 = settingsData.geminiModel2.trim();
      }
      if (settingsData.geminiModel3.trim()) {
        body.gemini_model_3 = settingsData.geminiModel3.trim();
      }

      const res = await fetch("http://localhost:5000/api/admin/settings", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const payload = await res.json();

      if (!res.ok || payload.status !== "success") {
        setSettingsStatus({ type: "error", text: payload.error || "Gagal menyimpan pengaturan API." });
        return;
      }

      setSettingsData((prev) => ({
        ...prev,
        geminiApiKey1: "",
        geminiApiKey2: "",
        geminiApiKey3: "",
        geminiModel1: "",
        geminiModel2: "",
        geminiModel3: "",
        currentMaskedKey1: payload.data?.gemini_api_key_1_masked || prev.currentMaskedKey1,
        currentMaskedKey2: payload.data?.gemini_api_key_2_masked || prev.currentMaskedKey2,
        currentMaskedKey3: payload.data?.gemini_api_key_3_masked || prev.currentMaskedKey3,
        currentModel1: payload.data?.gemini_model_1 || prev.currentModel1,
        currentModel2: payload.data?.gemini_model_2 || prev.currentModel2,
        currentModel3: payload.data?.gemini_model_3 || prev.currentModel3,
        isKey1Set: Boolean(payload.data?.gemini_api_key_1_set),
        isKey2Set: Boolean(payload.data?.gemini_api_key_2_set),
        isKey3Set: Boolean(payload.data?.gemini_api_key_3_set),
        geminiModelDefault: payload.data?.gemini_model_default || prev.geminiModelDefault,
      }));
      setSettingsStatus({ type: "success", text: payload.message || "Pengaturan API berhasil disimpan." });
    } catch (error) {
      setSettingsStatus({ type: "error", text: "Terjadi gangguan saat menyimpan pengaturan API." });
    } finally {
      setSettingsSaving(false);
    }
  };

  const fetchSystemPrompt = async () => {
    setPromptLoading(true);
    setPromptStatus({ type: "", text: "" });
    try {
      const token = process.env.NEXT_PUBLIC_ADMIN_SECRET_TOKEN;
      if (!token) {
        setPromptStatus({ type: "error", text: "Token admin frontend belum diatur (NEXT_PUBLIC_ADMIN_SECRET_TOKEN)." });
        return;
      }

      const res = await fetch("http://localhost:5000/api/admin/prompt", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const payload = await res.json();
      if (!res.ok || payload.status !== "success") {
        setPromptStatus({ type: "error", text: payload.error || "Gagal mengambil system prompt." });
        return;
      }

      setPromptText(payload.data?.prompt_text || "");
    } catch (error) {
      setPromptStatus({ type: "error", text: "Gagal menghubungi backend system prompt." });
    } finally {
      setPromptLoading(false);
    }
  };

  const saveSystemPrompt = async () => {
    setPromptSaving(true);
    setPromptStatus({ type: "", text: "" });
    try {
      const token = process.env.NEXT_PUBLIC_ADMIN_SECRET_TOKEN;
      if (!token) {
        setPromptStatus({ type: "error", text: "Token admin frontend belum diatur (NEXT_PUBLIC_ADMIN_SECRET_TOKEN)." });
        return;
      }

      const res = await fetch("http://localhost:5000/api/admin/prompt", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt_text: promptText }),
      });

      const payload = await res.json();
      if (!res.ok || payload.status !== "success") {
        setPromptStatus({ type: "error", text: payload.error || "Gagal menyimpan system prompt." });
        return;
      }

      setPromptStatus({ type: "success", text: payload.message || "System prompt berhasil disimpan." });
    } catch (error) {
      setPromptStatus({ type: "error", text: "Terjadi gangguan saat menyimpan system prompt." });
    } finally {
      setPromptSaving(false);
    }
  };

  useEffect(() => {
    if (activeSection === "settings") {
      fetchAdminSettings();
    }
    if (activeSection === "prompt") {
      fetchSystemPrompt();
    }
  }, [activeSection]);

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

  const leadsTodayCount = leads.filter((lead) => {
    const d = lead.waktu_daftar?.toDate?.();
    if (!d) return false;
    return d.toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10);
  }).length;

  const recentLeads7dCount = leads.filter((lead) => {
    const d = lead.waktu_daftar?.toDate?.();
    if (!d) return false;
    const now = Date.now();
    return now - d.getTime() <= 7 * 24 * 60 * 60 * 1000;
  }).length;

  const leadsWithWhatsApp = leads.filter((lead) => (lead.whatsapp || "").trim() !== "").length;
  const waCoverage = leads.length ? Math.round((leadsWithWhatsApp / leads.length) * 100) : 0;

  const filteredFaqs = useMemo(() => {
    if (!faqSearch.trim()) return faqs;
    const term = faqSearch.toLowerCase();
    return faqs.filter(
      (f) =>
        f.q?.toLowerCase().includes(term) ||
        f.a?.toLowerCase().includes(term)
    );
  }, [faqSearch, faqs]);

  const filteredChatLogs = useMemo(() => {
    if (!chatLogSearch.trim()) return chatLogs;
    const term = chatLogSearch.toLowerCase();
    return chatLogs.filter(
      (log) =>
        log.user_message?.toLowerCase().includes(term) ||
        log.bot_response?.toLowerCase().includes(term)
    );
  }, [chatLogSearch, chatLogs]);

  const sections = [
    { id: "overview", label: "Overview" },
    { id: "charts", label: "Insight" },
    { id: "feedback", label: "Feedback Chatbot" },
    { id: "scraper", label: "Auto-Scraper AI" },
    { id: "faq", label: "FAQ" },
    { id: "logs", label: "Chat Logs" },
    { id: "leads", label: "Leads" },
    { id: "settings", label: "Settings API" },
    { id: "prompt", label: "System Prompt" },
  ];

  const helpfulCount = feedbacks.filter((f) => f.isHelpful).length;
  const unhelpfulCount = feedbacks.filter((f) => !f.isHelpful).length;
  const helpfulRate = feedbacks.length ? Math.round((helpfulCount / feedbacks.length) * 100) : 0;
  const feedback7d = feedbacks.filter((f) => {
    const d = f.timestamp?.toDate?.();
    if (!d) return false;
    return Date.now() - d.getTime() <= 7 * 24 * 60 * 60 * 1000;
  }).length;
  const feedbackTone = helpfulRate >= 75 ? "Sangat Baik" : helpfulRate >= 55 ? "Cukup Baik" : "Perlu Optimasi";

  const todayKey = new Date().toISOString().slice(0, 10);
  const todayChats = chatLogs.filter((log) => {
    const d = log.timestamp?.toDate?.();
    if (!d) return false;
    return d.toISOString().slice(0, 10) === todayKey;
  }).length;
  const avgUserMsgLength = chatLogs.length
    ? Math.round(chatLogs.reduce((acc, log) => acc + (log.user_message?.length || 0), 0) / chatLogs.length)
    : 0;
  const topWord = (() => {
    const stopWords = new Set(["yang", "dan", "atau", "dengan", "untuk", "dari", "ke", "di", "saya", "aku", "kak", "mohon", "apa", "bagaimana"]);
    const counter: Record<string, number> = {};
    chatLogs.forEach((log) => {
      const words = (log.user_message || "")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length >= 4 && !stopWords.has(w));
      words.forEach((w) => {
        counter[w] = (counter[w] || 0) + 1;
      });
    });
    return Object.entries(counter).sort((a, b) => b[1] - a[1])[0]?.[0] || "-";
  })();

  const leadChartData = Object.entries(leadByMajor).map(([major, value]) => ({ major, value }));
  const chatTrendData = sortedDays.map((day) => ({
    day: day.slice(5),
    chats: logsByDay[day],
  }));
  const feedbackChartData = [
    { name: "Membantu", value: helpfulCount, color: "#10b981" },
    { name: "Tidak", value: unhelpfulCount, color: "#fb7185" },
  ];

  const busiestDay = sortedDays.length
    ? sortedDays.reduce((prev, curr) => (logsByDay[curr] > logsByDay[prev] ? curr : prev), sortedDays[0])
    : "-";
  const logsPerLead = totalLeads > 0 ? (totalLogs / totalLeads).toFixed(1) : "0";
  const insightStrength = Math.min(100, Math.round((helpfulRate * 0.5) + (Math.min(totalLogs, 50) * 1)));

  if (!user) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-600">Memuat...</div>;
  }

  return (
    <div className={`${styles.pageShell} min-h-screen text-gray-800 font-sans`}>
      <div className={styles.bgLayer} aria-hidden="true">
        <div className={`${styles.bgOrb} ${styles.bgOrbA}`} />
        <div className={`${styles.bgOrb} ${styles.bgOrbB}`} />
        <div className={`${styles.bgGrid}`} />
      </div>
      <Head>
        <title>Admin • Admisi UPJ</title>
      </Head>
      <header className={`${styles.topbar} sticky top-0 z-30`}>
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={styles.logoWrap}>
              <img src="/images/logo-upj.svg" alt="UPJ" className="w-9 h-9 rounded-lg bg-white p-1" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight truncate">Dashboard Admisi UPJ</h1>
              <p className="text-[11px] sm:text-xs text-slate-500 truncate">Kelola chatbot, data calon mahasiswa, dan insight harian</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="sm:hidden px-3 py-2 rounded-xl border border-slate-200 bg-white/80 text-slate-700 hover:bg-white"
              aria-label="Toggle menu"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <div className="hidden sm:flex items-center gap-3 border-l border-slate-200 pl-3">
              <div className={styles.profileBadge}>
                <div className={styles.profileDot} />
                <div className="flex flex-col leading-tight">
                  <span className="text-sm font-semibold text-slate-900">{user.email}</span>
                  <span className="text-[11px] text-slate-500">Admin Aktif</span>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 bg-white text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl text-sm font-bold transition-colors"
              >
                Keluar
              </button>
            </div>
          </div>
        </div>
        {menuOpen && (
          <div className="sm:hidden border-t border-slate-100 bg-white/95 backdrop-blur px-4 pb-3 shadow-[0_14px_32px_-18px_rgba(15,23,42,0.35)]">
            <div className="flex flex-col gap-2 py-2">
              {sections.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setActiveSection(s.id);
                    setMenuOpen(false);
                  }}
                  className="flex items-center justify-between text-sm font-semibold text-slate-800 py-2 px-3 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 transition"
                >
                  {s.label}
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
              <button
                onClick={handleLogout}
                className="mt-2 w-full px-3 py-2 bg-rose-500 text-white rounded-xl text-sm font-semibold hover:bg-rose-600 shadow-sm flex items-center justify-center gap-2"
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

      <div className={`max-w-7xl mx-auto px-4 py-6 relative z-10 ${styles.layout}`}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHead}>
            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500 font-semibold">Navigasi Cepat</p>
            <h3 className="text-base font-bold text-slate-900 mt-1">Menu Admin</h3>
          </div>
          <nav className="flex flex-col gap-2">
            {sections.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveSection(s.id)}
                className={`${styles.navItem} text-left ${activeSection === s.id ? styles.navItemActive : ""}`}
              >
                {s.label}
              </button>
            ))}
          </nav>
          <div className={styles.sidebarFoot}>
            <p className="text-xs text-slate-600">Saran alur kerja:</p>
            <ol className="text-xs text-slate-500">
              <li>1. Cek overview harian</li>
              <li>2. Review feedback</li>
              <li>3. Update FAQ/scraper</li>
            </ol>
          </div>
        </aside>

        <main className={styles.main}>
          {activeSection === "overview" && (
          <section className={`${styles.card} ${styles.heroCard}`}>
            <div className={styles.heroTop}>
              <div>
                <p className={styles.eyebrow}>Ringkasan Operasional</p>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Pusat Kendali Admisi</h2>
                <p className="text-sm text-slate-600 mt-1">Pantau performa chatbot, kualitas jawaban, dan potensi pendaftar dalam satu layar.</p>
              </div>
              <button onClick={exportAnalyticsToExcel} className={`${styles.btn} ${styles.btnSuccess}`}>
                Export Insight (.xlsx)
              </button>
            </div>

            <div className={styles.gridCards}>
              <div className={styles.statCard}>
                <p>Total Leads</p>
                <strong>{totalLeads}</strong>
                <span>{uniqueMajors.length} variasi minat jurusan</span>
              </div>
              <div className={styles.statCard}>
                <p>FAQ Aktif</p>
                <strong>{totalFaqs}</strong>
                <span>Siap dipakai chatbot</span>
              </div>
              <div className={styles.statCard}>
                <p>Feedback Positif</p>
                <strong>{helpfulRate}%</strong>
                <span>{helpfulCount} membantu, {unhelpfulCount} belum membantu</span>
              </div>
              <div className={styles.statCard}>
                <p>Jurusan Teratas</p>
                <strong>{topMajor}</strong>
                <span>Paling sering dipilih calon mahasiswa</span>
              </div>
            </div>

            <div className={styles.heroInsights}>
              <div className={styles.insightItem}>
                <span className={styles.insightLabel}>Aktivitas Chat 7 Hari</span>
                <span className={styles.insightValue}>Puncak {maxLogCount} chat/hari</span>
              </div>
              <div className={styles.insightItem}>
                <span className={styles.insightLabel}>Chat Log Tersimpan</span>
                <span className={styles.insightValue}>{totalLogs} log terbaru</span>
              </div>
              <div className={styles.insightItem}>
                <span className={styles.insightLabel}>Kualitas Jawaban</span>
                <span className={styles.insightValue}>{feedbacks.length === 0 ? "Belum ada penilaian" : `${helpfulRate}% dinilai membantu`}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
              <div className="rounded-2xl border border-sky-100 bg-white p-4 h-[290px]">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Grafik Minat Jurusan</p>
                {leadChartData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm text-slate-400">Belum ada data leads.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={leadChartData} margin={{ top: 6, right: 8, left: 0, bottom: 32 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="major" angle={-25} textAnchor="end" interval={0} height={54} tick={{ fontSize: 11, fill: "#475569" }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#475569" }} />
                      <Tooltip />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="#0ea5e9" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="rounded-2xl border border-emerald-100 bg-white p-4 h-[290px]">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Tren Percakapan Harian</p>
                {chatTrendData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm text-slate-400">Belum ada data chat.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chatTrendData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                      <defs>
                        <linearGradient id="chatFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#475569" }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#475569" }} />
                      <Tooltip />
                      <Area type="monotone" dataKey="chats" stroke="#059669" fill="url(#chatFill)" strokeWidth={2.4} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-rose-100 bg-white p-4 h-[260px] mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Komposisi Feedback</p>
              {feedbacks.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-slate-400">Belum ada feedback pengguna.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={feedbackChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={58} outerRadius={88} paddingAngle={4}>
                      {feedbackChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </section>
          )}

          {activeSection === "charts" && (
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <h2>Insight</h2>
              <span className={styles.subtle}>Analitik mendalam untuk evaluasi tim admisi</span>
            </div>

            <div className={styles.insightTopGrid}>
              <div className={styles.insightMiniCard}>
                <p>Hari Terpadat</p>
                <strong>{busiestDay === "-" ? "-" : busiestDay.slice(5)}</strong>
                <span>{busiestDay === "-" ? "Belum ada data" : `${logsByDay[busiestDay]} chat`}</span>
              </div>
              <div className={styles.insightMiniCard}>
                <p>Log per Lead</p>
                <strong>{logsPerLead}</strong>
                <span>Rasio interaksi terhadap calon mahasiswa</span>
              </div>
              <div className={styles.insightMiniCard}>
                <p>Kualitas Feedback</p>
                <strong>{helpfulRate}%</strong>
                <span>{helpfulCount} positif vs {unhelpfulCount} negatif</span>
              </div>
              <div className={styles.insightMiniCard}>
                <p>Insight Score</p>
                <strong>{insightStrength}</strong>
                <span>Skor komposit kualitas operasional</span>
              </div>
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
                        stroke="#0f766e"
                        strokeWidth="2.2"
                        points={sparklinePoints}
                      />
                      {sortedDays.map((d, idx) => {
                        const x = (idx / Math.max(sortedDays.length - 1, 1)) * 100;
                        const y = 40 - (logsByDay[d] / maxLogCount) * 40;
                        return <circle key={d} cx={x} cy={y} r="1.8" fill="#0f766e" />;
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

            <div className={styles.insightBottomGrid}>
              <div className={styles.insightPanel}>
                <div className={styles.chartTitle}>Aktivitas Harian (7 Hari)</div>
                {sortedDays.length === 0 ? (
                  <p className={styles.muted}>Belum ada aktivitas chat.</p>
                ) : (
                  <div className={styles.dayPillWrap}>
                    {sortedDays.map((day) => {
                      const count = logsByDay[day];
                      const intensity = maxLogCount > 0 ? count / maxLogCount : 0;
                      return (
                        <div key={day} className={styles.dayPillItem}>
                          <span className={styles.dayPillDate}>{day.slice(5)}</span>
                          <div className={styles.dayPillTrack}>
                            <div className={styles.dayPillFill} style={{ width: `${Math.max(8, intensity * 100)}%` }} />
                          </div>
                          <span className={styles.dayPillCount}>{count}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className={styles.insightPanel}>
                <div className={styles.chartTitle}>Komposisi Jurusan Top 4</div>
                {leadChartData.length === 0 ? (
                  <p className={styles.muted}>Belum ada data jurusan.</p>
                ) : (
                  <div className={styles.progressList}>
                    {leadChartData
                      .sort((a, b) => b.value - a.value)
                      .slice(0, 4)
                      .map((item) => (
                        <div key={item.major} className={styles.progressRow}>
                          <span className={styles.progressLabel}>{item.major}</span>
                          <div className={styles.progressTrack}>
                            <div className={styles.progressFill} style={{ width: `${(item.value / maxLeadCount) * 100}%` }} />
                          </div>
                          <span className={styles.progressValue}>{item.value}</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </section>
          )}

          {activeSection === "feedback" && (
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <h2>Feedback Chatbot</h2>
              <span className={styles.subtle}>Pemantauan kepuasan pengguna terhadap kualitas jawaban chatbot</span>
            </div>
            {isLoadingFeedback ? (
              <div className="py-8 text-center text-gray-400">Memuat data feedback...</div>
            ) : (
              <>
                <div className={styles.feedbackTopGrid}>
                  <div className={styles.feedbackMetricGrid}>
                    <div className={styles.feedbackMetricCard}>
                      <p>Total Feedback</p>
                      <strong>{feedbacks.length}</strong>
                      <span>Seluruh penilaian pengguna</span>
                    </div>
                    <div className={styles.feedbackMetricCard}>
                      <p>Positif (👍)</p>
                      <strong>{helpfulCount}</strong>
                      <span>Respons dinilai membantu</span>
                    </div>
                    <div className={styles.feedbackMetricCard}>
                      <p>Negatif (👎)</p>
                      <strong>{unhelpfulCount}</strong>
                      <span>Perlu evaluasi respons</span>
                    </div>
                    <div className={styles.feedbackMetricCard}>
                      <p>Feedback 7 Hari</p>
                      <strong>{feedback7d}</strong>
                      <span>Aktivitas minggu berjalan</span>
                    </div>
                  </div>

                  <div className={styles.feedbackHighlightCard}>
                    <div>
                      <p className="text-xs uppercase tracking-[0.14em] text-slate-500 font-semibold">Skor Kepuasan</p>
                      <h3 className="text-3xl font-bold text-slate-900 mt-1">{helpfulRate}%</h3>
                      <p className="text-sm text-slate-600 mt-1">Status: <span className="font-semibold text-slate-800">{feedbackTone}</span></p>
                    </div>
                    <div className={styles.feedbackDonutWrap}>
                      {feedbacks.length === 0 ? (
                        <div className="text-sm text-slate-400">Belum ada data</div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={feedbackChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={44} outerRadius={64} paddingAngle={3}>
                              {feedbackChartData.map((entry, index) => (
                                <Cell key={`feedback-cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>

                  <div className={styles.feedbackMeterRow}>
                    <div className={styles.feedbackMeterItem}>
                      <span className={styles.feedbackMeterLabel}>Membantu</span>
                      <div className={styles.feedbackMeterTrack}>
                        <div className={styles.feedbackMeterPositive} style={{ width: `${feedbacks.length ? (helpfulCount / feedbacks.length) * 100 : 0}%` }} />
                      </div>
                      <span className={styles.feedbackMeterValue}>{helpfulCount}</span>
                    </div>
                    <div className={styles.feedbackMeterItem}>
                      <span className={styles.feedbackMeterLabel}>Tidak Membantu</span>
                      <div className={styles.feedbackMeterTrack}>
                        <div className={styles.feedbackMeterNegative} style={{ width: `${feedbacks.length ? (unhelpfulCount / feedbacks.length) * 100 : 0}%` }} />
                      </div>
                      <span className={styles.feedbackMeterValue}>{unhelpfulCount}</span>
                    </div>
                  </div>
                </div>

                <div className={styles.feedbackListWrap}>
                  {feedbacks.slice(0, 12).map((fb, idx) => (
                    <div key={fb.id} className={styles.feedbackListItem}>
                      <div className={styles.feedbackListLeft}>
                        <div className={styles.feedbackRank}>#{idx + 1}</div>
                        <div>
                          <p className={styles.feedbackText}>{fb.text}</p>
                          <p className={styles.feedbackTime}>{fb.timestamp?.toDate?.().toLocaleString?.() || "-"}</p>
                        </div>
                      </div>
                      <div className={styles.feedbackBadgeWrap}>
                        {fb.isHelpful ? (
                          <span className={styles.feedbackBadgePositive}>👍 Membantu</span>
                        ) : (
                          <span className={styles.feedbackBadgeNegative}>👎 Tidak Membantu</span>
                        )}
                      </div>
                    </div>
                  ))}
                  {feedbacks.length === 0 && <p className={styles.muted}>Belum ada feedback.</p>}
                </div>
              </>
            )}
          </section>
          )}

          {activeSection === "settings" && (
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <h2>Settings API</h2>
              <span className={styles.subtle}>Kelola konfigurasi Gemini tanpa edit file .env manual</span>
            </div>

            <div className={styles.settingsGrid}>
              <div className={styles.settingsInfoCard}>
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500 font-semibold">Status Saat Ini</p>
                <div className="mt-3 space-y-2 text-sm">
                  <p><span className="font-semibold text-slate-700">GEMINI_API_KEY_1:</span> {settingsData.isKey1Set ? "Tersimpan" : "Belum diatur"}</p>
                  <p><span className="font-semibold text-slate-700">GEMINI_API_KEY_2:</span> {settingsData.isKey2Set ? "Tersimpan" : "Belum diatur"}</p>
                  <p><span className="font-semibold text-slate-700">GEMINI_API_KEY_3:</span> {settingsData.isKey3Set ? "Tersimpan" : "Belum diatur"}</p>
                  <p><span className="font-semibold text-slate-700">Key 1:</span> {settingsData.currentMaskedKey1 || "-"}</p>
                  <p><span className="font-semibold text-slate-700">Key 2:</span> {settingsData.currentMaskedKey2 || "-"}</p>
                  <p><span className="font-semibold text-slate-700">Key 3:</span> {settingsData.currentMaskedKey3 || "-"}</p>
                  <p><span className="font-semibold text-slate-700">Model Default:</span> {settingsData.geminiModelDefault || "gemini-2.5-flash"}</p>
                  <p><span className="font-semibold text-slate-700">Model 1:</span> {settingsData.currentModel1 || settingsData.geminiModelDefault || "gemini-2.5-flash"}</p>
                  <p><span className="font-semibold text-slate-700">Model 2:</span> {settingsData.currentModel2 || settingsData.geminiModelDefault || "gemini-2.5-flash"}</p>
                  <p><span className="font-semibold text-slate-700">Model 3:</span> {settingsData.currentModel3 || settingsData.geminiModelDefault || "gemini-2.5-flash"}</p>
                </div>
                <button
                  type="button"
                  onClick={fetchAdminSettings}
                  disabled={settingsLoading}
                  className={`${styles.btn} ${styles.btnIndigo} mt-4`}
                >
                  {settingsLoading ? "Memuat..." : "Refresh Status"}
                </button>
              </div>

              <div className={styles.settingsFormCard}>
                <label className="text-xs font-semibold text-slate-700">GEMINI API KEY 1</label>
                <input
                  type="password"
                  value={settingsData.geminiApiKey1}
                  onChange={(e) => setSettingsData((prev) => ({ ...prev, geminiApiKey1: e.target.value }))}
                  placeholder="Masukkan API key utama (kosongkan jika tidak diubah)"
                  className={styles.input}
                />
                <label className="text-xs font-semibold text-slate-700 mt-3">GEMINI API KEY 2</label>
                <input
                  type="password"
                  value={settingsData.geminiApiKey2}
                  onChange={(e) => setSettingsData((prev) => ({ ...prev, geminiApiKey2: e.target.value }))}
                  placeholder="Masukkan key cadangan kedua"
                  className={styles.input}
                />
                <label className="text-xs font-semibold text-slate-700 mt-3">GEMINI API KEY 3</label>
                <input
                  type="password"
                  value={settingsData.geminiApiKey3}
                  onChange={(e) => setSettingsData((prev) => ({ ...prev, geminiApiKey3: e.target.value }))}
                  placeholder="Masukkan key cadangan ketiga"
                  className={styles.input}
                />

                <label className="text-xs font-semibold text-slate-700 mt-3">Model Default Gemini</label>
                <input
                  type="text"
                  value={settingsData.geminiModelDefault}
                  onChange={(e) => setSettingsData((prev) => ({ ...prev, geminiModelDefault: e.target.value }))}
                  placeholder="Contoh: gemini-2.5-flash"
                  className={styles.input}
                />

                <label className="text-xs font-semibold text-slate-700 mt-3">Model Key 1 (opsional)</label>
                <input
                  type="text"
                  value={settingsData.geminiModel1}
                  onChange={(e) => setSettingsData((prev) => ({ ...prev, geminiModel1: e.target.value }))}
                  placeholder="Contoh: gemini-2.5-flash"
                  className={styles.input}
                />
                <label className="text-xs font-semibold text-slate-700 mt-3">Model Key 2 (opsional)</label>
                <input
                  type="text"
                  value={settingsData.geminiModel2}
                  onChange={(e) => setSettingsData((prev) => ({ ...prev, geminiModel2: e.target.value }))}
                  placeholder="Contoh: gemini-2.5-flash"
                  className={styles.input}
                />
                <label className="text-xs font-semibold text-slate-700 mt-3">Model Key 3 (opsional)</label>
                <input
                  type="text"
                  value={settingsData.geminiModel3}
                  onChange={(e) => setSettingsData((prev) => ({ ...prev, geminiModel3: e.target.value }))}
                  placeholder="Contoh: gemini-2.5-flash"
                  className={styles.input}
                />

                <div className="mt-3 p-3 rounded-xl border border-amber-100 bg-amber-50 text-[12px] text-amber-800">
                  Setelah disimpan, backend akan reload konfigurasi runtime otomatis. Urutan fallback: key 1 → key 2 → key 3. Setiap key dapat memiliki model berbeda; model default berlaku jika model key khusus tidak diisi.
                </div>

                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={saveAdminSettings}
                    disabled={settingsSaving}
                    className={`${styles.btn} ${styles.btnPrimary}`}
                  >
                    {settingsSaving ? "Menyimpan..." : "Simpan Pengaturan"}
                  </button>
                </div>
              </div>
            </div>

            {settingsStatus.text && (
              <div className={`mt-4 p-3 rounded-xl text-sm font-medium ${settingsStatus.type === "error" ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                {settingsStatus.text}
              </div>
            )}
          </section>
          )}

          {activeSection === "prompt" && (
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2>System Prompt</h2>
                <span className={styles.subtle}>Ubah teks prompt sistem yang dipakai Gemini saat menjawab.</span>
              </div>
            </div>

            <div className="space-y-4">
              <textarea
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                placeholder="Masukkan system prompt untuk Gemini..."
                className="w-full min-h-[260px] p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
              />

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-slate-600">
                  System prompt ini akan disimpan ke file <code>prompt_rules.txt</code> dan digunakan oleh backend saat memformat percakapan.
                </div>
                <button
                  type="button"
                  onClick={saveSystemPrompt}
                  disabled={promptSaving}
                  className={`${styles.btn} ${styles.btnPrimary}`}
                >
                  {promptSaving ? "Menyimpan..." : "Simpan System Prompt"}
                </button>
              </div>

              {promptStatus.text && (
                <div className={`rounded-xl p-3 text-sm font-medium ${promptStatus.type === "error" ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                  {promptStatus.text}
                </div>
              )}
            </div>
          </section>
          )}

          {/* ========================================== */}
          {/* SECTION BARU: AUTO-SCRAPER AI */}
          {/* ========================================== */}
          {activeSection === "scraper" && (
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2>Auto-Scraper AI</h2>
                <span className={styles.subtle}>Sedot info dari website kampus jadi FAQ</span>
              </div>
            </div>
            
            <div className="p-4 border border-gray-100 rounded-lg bg-white mb-4 shadow-sm">
              <label className="block text-sm font-semibold text-gray-700 mb-2">URL Target (Contoh: https://upj.ac.id/tentang-kami)</label>
              <div className="mb-3">
                <label className="block text-xs font-semibold text-gray-500 mb-1">Scope Scrape</label>
                <select
                  value={scrapeScope}
                  onChange={(e) => setScrapeScope(e.target.value as "exact" | "path")}
                  className="w-full sm:max-w-xs p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"
                >
                  <option value="exact">Halaman ini saja</option>
                  <option value="path">Semua halaman dalam path yang sama</option>
                </select>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  type="url"
                  value={scrapeUrl}
                  onChange={(e) => setScrapeUrl(e.target.value)}
                  placeholder="Masukkan link website..."
                  className="w-full flex-1 p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                />
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    onClick={handleScrape}
                    disabled={isScraping}
                    className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-5 rounded transition-all disabled:opacity-50 text-sm whitespace-nowrap"
                  >
                    {isScraping ? "Menyedot..." : "Mulai Scrape"}
                  </button>
                  <button
                    onClick={handleCancelScrape}
                    disabled={isScraping}
                    className="w-full sm:w-auto bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-5 rounded transition-all disabled:opacity-50 text-sm whitespace-nowrap"
                  >
                    Batal
                  </button>
                </div>
              </div>

              {scrapeStatus.text && (
                <div className={`mt-3 p-2 rounded text-sm font-medium ${scrapeStatus.type === "error" ? "bg-red-100 text-red-700" : scrapeStatus.type === "success" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
                  {scrapeStatus.text}
                </div>
              )}
            </div>

            {previewData.length > 0 && (
              <div className="border border-blue-100 rounded-lg bg-blue-50 p-3 sm:p-4">
                {scrapeMetrics && (
                  <div className="mb-4 rounded-xl border border-blue-100 bg-white p-3 sm:p-4 shadow-sm">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between mb-3">
                      <div>
                        <h3 className="text-md font-bold text-slate-900">Metrik Scrape</h3>
                        <p className="text-xs text-slate-500">Skor ini heuristik, dipakai untuk bantu cek hasil scrape cepat.</p>
                      </div>
                      <div className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-sm font-bold text-blue-700">
                        {scrapeMetrics.quality_score}/100 · {scrapeMetrics.quality_label}
                      </div>
                    </div>

                    <div className="mb-3 flex flex-wrap gap-2 text-xs text-slate-600">
                      <span className="rounded-full bg-slate-100 px-3 py-1">Scope: {scrapeMetrics.scope === "path" ? "Path" : "Exact"}</span>
                      <span className="rounded-full bg-slate-100 px-3 py-1">Pages scanned: {scrapeMetrics.pages_scanned}</span>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="rounded-xl bg-slate-50 p-3">
                        <div className="text-xs text-slate-500">Kelengkapan FAQ</div>
                        <div className="mt-1 text-lg font-bold text-slate-900">{scrapeMetrics.completeness_rate}%</div>
                        <div className="text-xs text-slate-500">{scrapeMetrics.valid_pairs}/{scrapeMetrics.faq_count} pasangan valid</div>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3">
                        <div className="text-xs text-slate-500">Format pertanyaan</div>
                        <div className="mt-1 text-lg font-bold text-slate-900">{scrapeMetrics.question_format_rate}%</div>
                        <div className="text-xs text-slate-500">Pertanyaan yang terlihat seperti pertanyaan</div>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3">
                        <div className="text-xs text-slate-500">Kedalaman jawaban</div>
                        <div className="mt-1 text-lg font-bold text-slate-900">{scrapeMetrics.avg_answer_length} char</div>
                        <div className="text-xs text-slate-500">Rata-rata panjang jawaban</div>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3">
                        <div className="text-xs text-slate-500">Teks sumber</div>
                        <div className="mt-1 text-lg font-bold text-slate-900">{scrapeMetrics.source_text_length} char</div>
                        <div className="text-xs text-slate-500">Kualitas konten halaman asal</div>
                      </div>
                    </div>

                    <div className="mt-3 text-xs text-slate-500">{scrapeMetrics.note}</div>
                  </div>
                )}

                <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center mb-4">
                  <h3 className="text-md font-bold text-blue-900">Tabel Kurasi (Preview)</h3>
                  <button
                    onClick={handleSaveScrapeToFirestore}
                    disabled={isSavingScrape}
                    className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 px-4 rounded-xl text-sm transition-all disabled:opacity-50"
                  >
                    {isSavingScrape ? "Menyimpan..." : "ACC & Simpan ke Firestore"}
                  </button>
                </div>

                <div className="space-y-3 max-h-[32rem] overflow-y-auto pr-1 sm:pr-2">
                  {previewData.map((item, index) => (
                    <div key={index} className="flex flex-col gap-2 p-3 sm:p-4 border border-white rounded-lg bg-white items-stretch shadow-sm sm:flex-row sm:items-start sm:gap-3">
                      <div className="flex items-center justify-between sm:flex-col sm:justify-start sm:items-start sm:w-10 shrink-0">
                        <div className="font-bold text-gray-400 text-sm">#{index + 1}</div>
                        <button
                          onClick={() => handleDeleteScrapeRow(index)}
                          className="sm:hidden p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-all"
                          title="Hapus baris ini"
                        >
                          ❌
                        </button>
                      </div>
                      <div className="flex-1 space-y-2 min-w-0">
                        <div>
                          <input
                            type="text"
                            value={item.q}
                            onChange={(e) => handleEditScrape(index, "q", e.target.value)}
                            className="w-full p-2.5 border border-gray-200 rounded-lg focus:border-blue-500 outline-none text-black font-semibold text-sm"
                            placeholder="Pertanyaan"
                          />
                        </div>
                        <div>
                          <textarea
                            value={item.a}
                            onChange={(e) => handleEditScrape(index, "a", e.target.value)}
                            rows={2}
                            className="w-full p-2.5 border border-gray-200 rounded-lg focus:border-blue-500 outline-none text-black text-sm resize-y"
                            placeholder="Jawaban"
                          />
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteScrapeRow(index)}
                        className="hidden sm:inline-flex self-end sm:self-start p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-all mt-1"
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
          )}

          {activeSection === "faq" && (
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <h2>FAQ</h2>
              <div className={styles.cardActions}>
                <input
                  value={faqSearch}
                  onChange={(e) => setFaqSearch(e.target.value)}
                  placeholder="Cari FAQ (pertanyaan/jawaban)"
                  className={styles.input}
                  aria-label="Cari FAQ"
                />
                <button onClick={exportToExcel} className={`${styles.btn} ${styles.btnSuccess}`}>Export FAQ</button>
                <label className={`${styles.btn} ${styles.btnPrimary} cursor-pointer`}>
                  Upload FAQ (xlsx)
                  <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                </label>
                <button onClick={handleFileUpload} disabled={!file || isUploading} className={`${styles.btn} ${styles.btnIndigo} ${(!file || isUploading) ? styles.btnDisabled : ""}`}>{isUploading ? "Uploading..." : "Upload"}</button>
              </div>
            </div>

            <div className={styles.formInline}>
              <p className="text-sm font-semibold text-slate-700">Tambah FAQ Baru</p>
              <input value={newQ} onChange={(e) => setNewQ(e.target.value)} placeholder="Pertanyaan" className={styles.input} />
              <textarea value={newA} onChange={(e) => setNewA(e.target.value)} placeholder="Jawaban" className={`${styles.input} h-20`} />
              <button onClick={addFAQ} className={`${styles.btn} ${styles.btnPrimary}`}>Tambah FAQ</button>
            </div>

            <div className={styles.faqListSection}>
              <div className={styles.faqListHead}>
                <h3 className="text-sm font-bold text-slate-800">Daftar FAQ</h3>
                <span className="text-xs text-slate-500">{filteredFaqs.length} item</span>
              </div>

            <div className={styles.faqGrid}>
              {(showAllFaqs ? filteredFaqs : filteredFaqs.slice(0, 3)).map((faq) => (
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
                      <div className={styles.faqActionsRight}>
                        <button
                          onClick={() => updateFAQ(faq.id, editQ, editA)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition"
                        >
                          Simpan
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-sm font-semibold transition"
                        >
                          Batal
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className={styles.faqRow}>
                      <div className={styles.faqBody}>
                        <div className={styles.faqQuestion}>{faq.q}</div>
                        <div className={styles.faqAnswer}>{faq.a}</div>
                      </div>
                      <div className={styles.faqActionsRight}>
                        <button
                          onClick={() => startEdit(faq)}
                          className={styles.actionBtnInfo}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteFAQ(faq.id)}
                          className={styles.actionBtnDanger}
                        >
                          Hapus
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {faqs.length === 0 && <p className={styles.muted}>Belum ada FAQ.</p>}
              {faqs.length > 0 && filteredFaqs.length === 0 && <p className={styles.muted}>FAQ tidak ditemukan untuk kata kunci tersebut.</p>}
            </div>
            {filteredFaqs.length > 3 && (
              <div className="flex justify-center mt-4">
                <button
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-semibold transition"
                  onClick={() => setShowAllFaqs((v) => !v)}
                >
                  {showAllFaqs ? "Tampilkan Lebih Sedikit" : "Selengkapnya"}
                </button>
              </div>
            )}
            </div>
          </section>
          )}

          {activeSection === "logs" && (
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <h2>Chat Logs (50 terbaru)</h2>
              <div className={styles.cardActions}>
                <input
                  value={chatLogSearch}
                  onChange={(e) => setChatLogSearch(e.target.value)}
                  placeholder="Cari di pesan user / jawaban bot"
                  className={styles.input}
                  aria-label="Cari chat logs"
                />
                <button onClick={deleteAllChatLogs} className={`${styles.btn} ${styles.btnDanger} ${styles.btnGhost}`}>Hapus Semua</button>
              </div>
            </div>

            <div className={styles.logStatsRow}>
              <div className={styles.logStatCard}>
                <p>Total Log</p>
                <strong>{chatLogs.length}</strong>
                <span>Data percakapan tersimpan</span>
              </div>
              <div className={styles.logStatCard}>
                <p>Chat Hari Ini</p>
                <strong>{todayChats}</strong>
                <span>Interaksi tanggal sekarang</span>
              </div>
              <div className={styles.logStatCard}>
                <p>Rata-rata Panjang Pesan</p>
                <strong>{avgUserMsgLength}</strong>
                <span>Karakter per pesan user</span>
              </div>
              <div className={styles.logStatCard}>
                <p>Topik Teratas</p>
                <strong>{topWord}</strong>
                <span>Kata dominan dari user</span>
              </div>
            </div>

            <div className={styles.listScroll}>
              {filteredChatLogs.map((log) => (
                <div key={log.id} className={`${styles.listItem} ${styles.logItem}`}>
                  <div className={styles.logBody}>
                    <div className={styles.logBubbleUser}><span className="font-semibold text-slate-800">User:</span> {log.user_message}</div>
                    <div className={styles.logBubbleBot}><span className="font-semibold text-slate-800">Bot:</span> {log.bot_response}</div>
                    <div className="text-[11px] text-gray-500">{log.timestamp?.toDate?.().toLocaleString?.() || ""}</div>
                  </div>
                  <div className={styles.logActions}>
                    <button onClick={() => deleteChatLog(log.id)} className={styles.actionBtnDanger}>Hapus</button>
                  </div>
                </div>
              ))}
              {chatLogs.length === 0 && <p className={styles.muted}>Belum ada log.</p>}
              {chatLogs.length > 0 && filteredChatLogs.length === 0 && <p className={styles.muted}>Log tidak ditemukan untuk kata kunci tersebut.</p>}
            </div>
          </section>
          )}

          {activeSection === "leads" && (
          <section className={styles.card}>
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

            <div className={styles.logStatsRow}>
              <div className={styles.logStatCard}>
                <p>Total Leads</p>
                <strong>{leads.length}</strong>
                <span>Semua calon mahasiswa masuk</span>
              </div>
              <div className={styles.logStatCard}>
                <p>Leads Hari Ini</p>
                <strong>{leadsTodayCount}</strong>
                <span>Lead baru pada tanggal ini</span>
              </div>
              <div className={styles.logStatCard}>
                <p>Leads 7 Hari</p>
                <strong>{recentLeads7dCount}</strong>
                <span>Tren minat seminggu terakhir</span>
              </div>
              <div className={styles.logStatCard}>
                <p>Coverage WhatsApp</p>
                <strong>{waCoverage}%</strong>
                <span>{leadsWithWhatsApp} dari {leads.length} lead punya nomor aktif</span>
              </div>
            </div>

            <div className={styles.listScroll}>
              {filteredLeads.map((lead) => (
                <div key={lead.id} className={`${styles.listItem} ${styles.leadItem}`}>
                  <div className={styles.leadIdentity}>
                    <div className={styles.leadAvatar}>
                      {lead.nama?.trim()?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                    <div className={styles.leadMainText}>
                      <div className="font-semibold text-slate-800">{lead.nama || "Tanpa Nama"}</div>
                      <div className="text-[12px] text-slate-500">{lead.whatsapp || "Nomor belum tersedia"}</div>
                    </div>
                  </div>
                  <div className={styles.leadMetaRight}>
                    <span className={styles.leadMajorChip}>{lead.minat_jurusan || "Lainnya"}</span>
                    <span className="text-[11px] text-gray-500">{lead.waktu_daftar?.toDate?.().toLocaleString?.() || ""}</span>
                  </div>
                </div>
              ))}
              {filteredLeads.length === 0 && <p className={styles.muted}>Tidak ada data cocok.</p>}
            </div>
          </section>
          )}
        </main>
      </div>
    </div>
  );
}