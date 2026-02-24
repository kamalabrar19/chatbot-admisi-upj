import "./globals.css"; // <-- INI YANG PALING PENTING
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Chatbot Admisi UPJ",
  description: "Layanan Asisten Virtual Admisi UPJ",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}