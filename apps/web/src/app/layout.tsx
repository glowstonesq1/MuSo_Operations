import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MuSo Ops Command Center",
  description: "Operations orchestration for Museum of Solutions, Mumbai",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-100 text-slate-900">{children}</body>
    </html>
  );
}
