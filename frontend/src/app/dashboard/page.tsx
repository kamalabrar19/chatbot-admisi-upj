"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "../../lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, getDocs, addDoc, deleteDoc, doc, writeBatch } from "firebase/firestore";
import * as XLSX from "xlsx";

// Tipe data FAQ kita
interface FAQ {
  id: string;
  q: string;
  a: string;
}

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  // State untuk FAQ
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [isLoadingFaqs, setIsLoadingFaqs] = useState(true);
  
  // State untuk form manual
  const [newQ, setNewQ] = useState("");
  const [newA, setNewA] = useState("");
  
  // State untuk upload Excel
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [isUploading, setIsUploading] = useState(false);

  // 1. Cek Login
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.push("/login");
      } else {
        setUser(currentUser);
        fetchFaqs();
      }
    });
    return () => unsubscribe();
  }, [router]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  // 2. READ: Ambil Data dari Firebase Firestore
  const fetchFaqs = async () => {
    setIsLoadingFaqs(true);
    try {
      const querySnapshot = await getDocs(collection(db, "faqs"));
      const faqList: FAQ[] = [];
      querySnapshot.forEach((doc) => {
        faqList.push({ id: doc.id, q: doc.data().q, a: doc.data().a });
      });
      setFaqs(faqList);
    } catch (error) {
      console.error("Gagal memuat FAQ:", error);
    } finally {
      setIsLoadingFaqs(false);
    }
  };

  // 3. CREATE: Tambah FAQ Manual
  const handleAddFaq = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQ.trim() || !newA.trim()) return;

    try {
      await addDoc(collection(db, "faqs"), {
        q: newQ,
        a: newA
      });
      setNewQ("");
      setNewA("");
      fetchFaqs(); // Refresh tabel
    } catch (error) {
      console.error("Gagal menambah FAQ:", error);
      alert("Gagal menyimpan data ke Firebase.");
    }
  };

  // 4. DELETE: Hapus FAQ
  const handleDelete = async (id: string) => {
    if (!confirm("Yakin ingin menghapus pertanyaan ini?")) return;
    try {
      await deleteDoc(doc(db, "faqs", id));
      fetchFaqs(); // Refresh tabel
    } catch (error) {
      console.error("Gagal menghapus:", error);
    }
  };

  // 5. UPLOAD: Baca Excel dan simpan ke Firebase (Batch Write)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setStatus({ type: "", message: "" });
    }
  };

  const handleUploadExcel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setStatus({ type: "error", message: "Pilih file Excel (.xlsx) terlebih dahulu!" });
      return;
    }

    setIsUploading(true);
    setStatus({ type: "", message: "" });

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0]; // Ambil sheet pertama
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert Excel ke JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

        // Siapkan batch Firebase (Biar nyimpen datanya sekalian banyak)
        const batch = writeBatch(db);
        let count = 0;

        jsonData.forEach((row) => {
          // Pastikan nama kolom di excel sesuai: "Pertanyaan" dan "Jawaban"
          const pertanyaan = row["Pertanyaan"];
          const jawaban = row["Jawaban"];
          
          if (pertanyaan && jawaban) {
            const newDocRef = doc(collection(db, "faqs"));
            batch.set(newDocRef, { q: String(pertanyaan), a: String(jawaban) });
            count++;
          }
        });

        if (count > 0) {
          await batch.commit(); // Eksekusi simpan ke Firebase
          setStatus({ type: "success", message: `✅ Berhasil mengimpor ${count} data dari Excel ke Database!` });
          setFile(null);
          fetchFaqs(); // Refresh tabel
        } else {
          setStatus({ type: "error", message: "❌ Gagal! Pastikan nama kolom di Excel adalah 'Pertanyaan' dan 'Jawaban'." });
        }

      } catch (error) {
        console.error("Error reading Excel:", error);
        setStatus({ type: "error", message: "❌ Terjadi kesalahan saat membaca file Excel." });
      } finally {
        setIsUploading(false);
      }
    };
    
    // Mulai membaca file
    reader.readAsArrayBuffer(file);
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-pulse text-blue-600 font-bold">Memuat Dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans pb-10">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 text-white p-2 rounded-lg">⚙️</div>
          <h1 className="text-xl font-bold text-gray-800">Admin Dashboard</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600 hidden md:block">{user.email}</span>
          <button onClick={handleLogout} className="text-sm font-semibold text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg transition-colors">
            Keluar
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto mt-8 px-4 grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* KOLOM KIRI: Form Tambah Manual & Upload Excel */}
        <div className="md:col-span-1 space-y-6">
          
          {/* PANEL TAMBAH MANUAL */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Tambah Data Manual</h2>
            <form onSubmit={handleAddFaq} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Pertanyaan (Q)</label>
                <textarea 
                  required
                  value={newQ}
                  onChange={(e) => setNewQ(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                  rows={2} 
                  placeholder="Contoh: Apa itu beasiswa Jaya?" 
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Jawaban (A)</label>
                <textarea 
                  required
                  value={newA}
                  onChange={(e) => setNewA(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                  rows={4} 
                  placeholder="Jawaban dari asisten AI..." 
                />
              </div>
              <button type="submit" className="w-full bg-blue-600 text-white font-bold py-2.5 rounded-lg hover:bg-blue-700 transition-colors">
                Simpan ke Database
              </button>
            </form>
          </div>

          {/* PANEL UPLOAD EXCEL */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-2">Import dari Excel</h2>
            <p className="text-xs text-gray-500 mb-4">Unggah file <strong className="text-gray-700">.xlsx</strong> dengan kolom "Pertanyaan" dan "Jawaban".</p>
            
            <form onSubmit={handleUploadExcel} className="space-y-4">
              <input
                type="file"
                accept=".xlsx"
                onChange={handleFileChange}
                className="block w-full text-xs text-gray-500 file:mr-3 file:py-2 file:px-3 file:rounded-full file:border-0 file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer border border-gray-200 rounded-lg"
              />
              {status.message && (
                <div className={`p-3 rounded-lg text-xs font-semibold ${status.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                  {status.message}
                </div>
              )}
              <button
                type="submit"
                disabled={isUploading || !file}
                className="w-full bg-gray-800 text-white font-bold py-2.5 rounded-lg hover:bg-gray-900 transition-colors disabled:opacity-50"
              >
                {isUploading ? "Memproses Data..." : "Upload Excel"}
              </button>
            </form>
          </div>
        </div>

        {/* KOLOM KANAN: Tabel Data Firestore */}
        <div className="md:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col h-[80vh]">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-gray-800">Database FAQ Firestore</h2>
            <span className="bg-blue-100 text-blue-800 text-xs font-bold px-3 py-1 rounded-full">
              {faqs.length} Data
            </span>
          </div>

          <div className="flex-1 overflow-auto border border-gray-200 rounded-xl">
            {isLoadingFaqs ? (
              <div className="flex items-center justify-center h-full text-gray-500 font-medium animate-pulse">
                Mengambil data dari Firebase...
              </div>
            ) : faqs.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-400 font-medium">
                Database masih kosong.
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase w-1/3">Pertanyaan</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Jawaban</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase w-16">Aksi</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {faqs.map((faq) => (
                    <tr key={faq.id} className="hover:bg-blue-50/50 transition-colors">
                      <td className="px-4 py-3 text-sm text-gray-800 align-top break-words">{faq.q}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 align-top break-words whitespace-pre-wrap">{faq.a}</td>
                      <td className="px-4 py-3 text-center align-top">
                        <button 
                          onClick={() => handleDelete(faq.id)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-md transition-colors"
                          title="Hapus Data"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </main>
    </div>
  );
}