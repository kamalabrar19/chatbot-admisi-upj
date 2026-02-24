"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth } from "../../lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [isUploading, setIsUploading] = useState(false);
  
  // STATE BARU: Menyimpan data FAQ
  const [faqs, setFaqs] = useState<{q: string, a: string}[]>([]);
  const [isLoadingFaqs, setIsLoadingFaqs] = useState(true);
  
  const router = useRouter();

  // Fungsi untuk mengambil data FAQ dari Flask
  const fetchFaqs = async () => {
    setIsLoadingFaqs(true);
    try {
      const res = await fetch("http://127.0.0.1:5000/api/faqs");
      if (res.ok) {
        const data = await res.json();
        setFaqs(data.faqs);
      }
    } catch (error) {
      console.error("Gagal memuat data FAQ", error);
    } finally {
      setIsLoadingFaqs(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.push("/login"); 
      } else {
        setUser(currentUser);
        fetchFaqs(); // Ambil data saat user berhasil login
      }
    });
    return () => unsubscribe();
  }, [router]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setStatus({ type: "", message: "" }); 
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setStatus({ type: "error", message: "Pilih file Excel (.xlsx) terlebih dahulu!" });
      return;
    }

    setIsUploading(true);
    setStatus({ type: "", message: "" });

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("http://127.0.0.1:5000/api/upload", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        setStatus({ type: "success", message: "✅ File FAQ berhasil diperbarui! Pengetahuan AI sudah bertambah." });
        setFile(null); 
        fetchFaqs(); // REFRESH TABEL SETELAH UPLOAD BERHASIL
      } else {
        setStatus({ type: "error", message: "❌ Gagal mengunggah file. Pastikan formatnya .xlsx" });
      }
    } catch (error) {
      setStatus({ type: "error", message: "⚠️ Gagal terhubung ke server. Pastikan backend Flask sudah menyala." });
    } finally {
      setIsUploading(false);
    }
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
      {/* Navbar Admin */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 text-white p-2 rounded-lg">⚙️</div>
          <h1 className="text-xl font-bold text-gray-800">Admin Dashboard</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600 hidden md:block">{user.email}</span>
          <button
            onClick={handleLogout}
            className="text-sm font-semibold text-red-600 hover:text-red-800 px-4 py-2 bg-red-50 rounded-lg transition-colors"
          >
            Keluar
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto mt-10 px-6 grid grid-cols-1 gap-8">
        
        {/* PANEL UPLOAD */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Update Data Chatbot</h2>
          <p className="text-gray-500 mb-8">
            Unggah file <strong className="text-gray-700">faq_admisi.xlsx</strong> terbaru untuk memperbarui basis pengetahuan AI secara otomatis.
          </p>

          <form onSubmit={handleUpload} className="space-y-6">
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:bg-gray-50 transition-colors">
              <input
                type="file"
                accept=".xlsx"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
              />
            </div>

            {status.message && (
              <div className={`p-4 rounded-xl text-sm font-semibold ${status.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {status.message}
              </div>
            )}

            <button
              type="submit"
              disabled={isUploading || !file}
              className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
            >
              {isUploading ? "Mengunggah..." : "Upload File Excel"}
            </button>
          </form>
        </div>

        {/* PANEL DATABASE (TABEL FAQ) */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 overflow-hidden">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-800">Database Saat Ini</h2>
            <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-3 py-1 rounded-full">
              Total: {faqs.length} Data
            </span>
          </div>

          {isLoadingFaqs ? (
            <div className="text-center py-10 text-gray-500 animate-pulse">Memuat data dari server...</div>
          ) : faqs.length === 0 ? (
            <div className="text-center py-10 text-gray-500 border-2 border-dashed border-gray-200 rounded-xl">
              Belum ada data FAQ. Silakan unggah file Excel di atas.
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto border border-gray-200 rounded-xl">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/3">Pertanyaan (Q)</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-2/3">Jawaban (A)</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {faqs.map((faq, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900 align-top">{faq.q}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 align-top">{faq.a}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </main>
    </div>
  );
}