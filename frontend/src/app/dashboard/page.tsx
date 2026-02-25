"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "../../lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, getDocs, addDoc, deleteDoc, doc, writeBatch, query, orderBy, limit } from "firebase/firestore";
import * as XLSX from "xlsx";

interface FAQ { id: string; q: string; a: string; }
interface ChatLog { id: string; user_message: string; bot_response: string; timestamp: any; }
// Tipe data baru untuk Leads
interface Lead { id: string; nama: string; whatsapp: string; minat_jurusan: string; waktu_daftar: any; }

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [chatLogs, setChatLogs] = useState<ChatLog[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]); // State baru untuk menyimpan data Leads
  
  const [isLoading, setIsLoading] = useState(true);
  const [newQ, setNewQ] = useState("");
  const [newA, setNewA] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [isUploading, setIsUploading] = useState(false);

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

  // Tarik Data FAQ, Analitik, dan Leads bersamaan
  const fetchData = async () => {
    setIsLoading(true);
    try {
      // 1. Ambil FAQ
      const faqSnapshot = await getDocs(collection(db, "faqs"));
      const faqList: FAQ[] = [];
      faqSnapshot.forEach((doc) => faqList.push({ id: doc.id, q: doc.data().q, a: doc.data().a }));
      setFaqs(faqList);

      // 2. Ambil 50 Chat Terakhir (Chat Logs)
      const qLogs = query(collection(db, "chat_logs"), orderBy("timestamp", "desc"), limit(50));
      const logSnapshot = await getDocs(qLogs);
      const logList: ChatLog[] = [];
      logSnapshot.forEach((doc) => {
        logList.push({ id: doc.id, user_message: doc.data().user_message, bot_response: doc.data().bot_response, timestamp: doc.data().timestamp });
      });
      setChatLogs(logList);

      // 3. Ambil Data Leads (Calon Mahasiswa)
      const qLeads = query(collection(db, "leads"), orderBy("waktu_daftar", "desc"));
      const leadSnapshot = await getDocs(qLeads);
      const leadList: Lead[] = [];
      leadSnapshot.forEach((doc) => {
        leadList.push({ 
          id: doc.id, 
          nama: doc.data().nama, 
          whatsapp: doc.data().whatsapp, 
          minat_jurusan: doc.data().minat_jurusan, 
          waktu_daftar: doc.data().waktu_daftar 
        });
      });
      setLeads(leadList);

    } catch (error) {
      console.error("Gagal memuat data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => { await signOut(auth); router.push("/login"); };

  // CRUD Tambah Manual
  const handleAddFaq = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQ.trim() || !newA.trim()) return;
    try {
      await addDoc(collection(db, "faqs"), { q: newQ, a: newA });
      setNewQ(""); setNewA(""); fetchData();
    } catch (error) { alert("Gagal menyimpan data."); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Yakin hapus?")) return;
    await deleteDoc(doc(db, "faqs", id));
    fetchData();
  };

  // Upload Excel Batch
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) { setFile(e.target.files[0]); setStatus({ type: "", message: "" }); }
  };

  const handleUploadExcel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) { setStatus({ type: "error", message: "Pilih file Excel!" }); return; }
    setIsUploading(true); setStatus({ type: "", message: "" });

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "array" });
        const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]) as any[];
        const batch = writeBatch(db);
        let count = 0;

        jsonData.forEach((row) => {
          if (row["Pertanyaan"] && row["Jawaban"]) {
            batch.set(doc(collection(db, "faqs")), { q: String(row["Pertanyaan"]), a: String(row["Jawaban"]) });
            count++;
          }
        });

        if (count > 0) {
          await batch.commit();
          setStatus({ type: "success", message: `✅ Berhasil import ${count} data!` });
          setFile(null); fetchData();
        } else setStatus({ type: "error", message: "❌ Gagal! Pastikan kolom 'Pertanyaan' & 'Jawaban' ada." });
      } catch (error) { setStatus({ type: "error", message: "❌ Error baca Excel." }); } 
      finally { setIsUploading(false); }
    };
    reader.readAsArrayBuffer(file);
  };

  if (!user) return <div className="min-h-screen flex items-center justify-center font-bold animate-pulse text-blue-600">Memuat...</div>;

  return (
    <div className="min-h-screen bg-gray-50 font-sans pb-10">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center shadow-sm sticky top-0 z-10">
        <h1 className="text-xl font-bold text-gray-800">⚙️ Admin Dashboard & Analytics</h1>
        <button onClick={handleLogout} className="text-sm font-semibold text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg transition-colors">Keluar</button>
      </header>

      <main className="max-w-7xl mx-auto mt-8 px-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* KOLOM KIRI: Form Data & Statistik */}
        <div className="lg:col-span-1 space-y-6">
          
          <div className="bg-gradient-to-br from-green-500 to-green-700 rounded-2xl shadow-sm p-6 text-white flex justify-between items-center">
            <div>
              <p className="text-green-100 text-sm font-semibold mb-1">Total Calon Mahasiswa</p>
              <h2 className="text-4xl font-extrabold">{leads.length}</h2>
            </div>
            <div className="text-5xl opacity-50">📝</div>
          </div>

          <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl shadow-sm p-6 text-white flex justify-between items-center">
            <div>
              <p className="text-blue-100 text-sm font-semibold mb-1">Total Interaksi Chat</p>
              <h2 className="text-4xl font-extrabold">{chatLogs.length}+</h2>
            </div>
            <div className="text-5xl opacity-50">💬</div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Tambah Data Manual</h2>
            <form onSubmit={handleAddFaq} className="space-y-4">
              <textarea required value={newQ} onChange={(e) => setNewQ(e.target.value)} className="w-full border rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none" rows={2} placeholder="Pertanyaan (Q)" />
              <textarea required value={newA} onChange={(e) => setNewA(e.target.value)} className="w-full border rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none" rows={4} placeholder="Jawaban (A)" />
              <button type="submit" className="w-full bg-blue-600 text-white font-bold py-2.5 rounded-lg hover:bg-blue-700">Simpan Data</button>
            </form>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-2">Import Excel (.xlsx)</h2>
            <form onSubmit={handleUploadExcel} className="space-y-4 mt-4">
              <input type="file" accept=".xlsx" onChange={handleFileChange} className="block w-full text-xs text-gray-500 file:mr-3 file:py-2 file:px-3 file:rounded-full file:border-0 file:font-semibold file:bg-blue-50 file:text-blue-700 border border-gray-200 rounded-lg" />
              {status.message && <div className={`p-3 rounded-lg text-xs font-semibold ${status.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{status.message}</div>}
              <button type="submit" disabled={isUploading || !file} className="w-full bg-gray-800 text-white font-bold py-2.5 rounded-lg hover:bg-gray-900 disabled:opacity-50">Upload Excel</button>
            </form>
          </div>
        </div>

        {/* KOLOM KANAN: Tabel Leads, Analytics, & FAQ */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* TABEL LEADS (TARGET MARKETING) */}
          <div className="bg-white rounded-2xl shadow-sm border border-green-200 p-6 flex flex-col h-[400px]">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-green-800">🎯 Daftar Prospek (Calon Mahasiswa)</h2>
              <span className="bg-green-100 text-green-800 text-xs font-bold px-3 py-1 rounded-full">{leads.length} Orang</span>
            </div>
            <div className="flex-1 overflow-auto border border-gray-200 rounded-xl">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-green-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-green-800 uppercase">Nama</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-green-800 uppercase">WhatsApp</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-green-800 uppercase">Minat Jurusan</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {leads.map((lead, idx) => (
                    <tr key={idx} className="hover:bg-green-50/30">
                      <td className="px-4 py-3 text-sm font-semibold text-gray-800">{lead.nama}</td>
                      <td className="px-4 py-3 text-sm text-blue-600 font-medium hover:underline cursor-pointer">
                        <a href={`https://wa.me/${lead.whatsapp.replace(/^0/, '62')}`} target="_blank" rel="noreferrer">
                          {lead.whatsapp} ↗
                        </a>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        <span className="bg-gray-100 px-2 py-1 rounded-md text-xs font-medium">{lead.minat_jurusan}</span>
                      </td>
                    </tr>
                  ))}
                  {leads.length === 0 && <tr><td colSpan={3} className="p-4 text-center text-gray-400">Belum ada data calon mahasiswa masuk.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {/* TABEL ANALITIK (CHAT LOGS) */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col h-[350px]">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Mata-Mata AI (Riwayat Chat) 👀</h2>
            <div className="flex-1 overflow-auto border border-gray-200 rounded-xl">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-blue-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-blue-800 uppercase w-1/2">Calon Maba Bertanya</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-blue-800 uppercase">AI Menjawab</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {chatLogs.map((log, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-800 align-top font-semibold">"{log.user_message}"</td>
                      <td className="px-4 py-3 text-xs text-gray-500 align-top line-clamp-3">{log.bot_response.substring(0, 100)}...</td>
                    </tr>
                  ))}
                  {chatLogs.length === 0 && <tr><td colSpan={2} className="p-4 text-center text-gray-400">Belum ada obrolan hari ini.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {/* TABEL DATABASE FAQ */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col h-[350px]">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-gray-800">Database Pengetahuan (FAQ)</h2>
              <span className="bg-gray-100 text-gray-800 text-xs font-bold px-3 py-1 rounded-full">{faqs.length} Data</span>
            </div>
            <div className="flex-1 overflow-auto border border-gray-200 rounded-xl">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Pertanyaan</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase w-16">Aksi</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {faqs.map((faq) => (
                    <tr key={faq.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-800">{faq.q}</td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => handleDelete(faq.id)} className="text-red-500 hover:text-red-700 text-lg">🗑️</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}