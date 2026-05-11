import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stellar-Guard | CAP-0077 Command Center",
  description: "UI-driven interface for Quorum Freeze — quarantine compromised RWA assets",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-stellar-dark text-white min-h-screen">{children}</body>
    </html>
  );
}
