import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Goalie Training App",
  description:
    "AI-powered feedback for soccer goalkeepers — stance, footwork, diving form, and recovery, analyzed from your own training clips.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <Link href="/" className="flex items-center gap-2 font-bold text-slate-900">
              <span className="text-xl">🧤</span>
              <span>Goalie Training</span>
            </Link>
            <Link
              href="/upload"
              className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500"
            >
              Start Training
            </Link>
          </div>
        </header>

        <div className="flex-1">{children}</div>

        <footer className="border-t border-slate-200 bg-white py-6 text-center text-sm text-slate-500">
          Pose detection runs entirely on-device — your videos never leave your browser.
        </footer>
      </body>
    </html>
  );
}
