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
    "Upload goalkeeper training videos and get instant AI feedback on stance, footwork, diving form, and recovery.",
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
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <header className="border-b border-border">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-foreground text-sm font-bold">
                GK
              </span>
              <span>Goalie Training</span>
            </Link>
            <nav className="flex items-center gap-6 text-sm text-muted">
              <Link href="/" className="transition-colors hover:text-foreground">
                Home
              </Link>
              <Link
                href="/upload"
                className="rounded-lg bg-surface-raised px-3 py-1.5 font-medium text-foreground transition-colors hover:bg-border"
              >
                Analyze a Video
              </Link>
            </nav>
          </div>
        </header>

        <div className="flex-1">{children}</div>

        <footer className="border-t border-border">
          <div className="mx-auto max-w-5xl px-6 py-6 text-sm text-muted">
            Built for goalkeepers who want sharper ready stances, one rep at a time.
          </div>
        </footer>
      </body>
    </html>
  );
}
