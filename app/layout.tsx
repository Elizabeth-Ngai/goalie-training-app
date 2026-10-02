import type { Metadata } from "next";
import { Saira_Condensed, Archivo } from "next/font/google";
import Link from "next/link";
import { ClerkProvider } from "@clerk/nextjs";
import HeaderNav from "@/components/ui/HeaderNav";
import "./globals.css";

const saira = Saira_Condensed({
  weight: ["600", "700", "800"],
  subsets: ["latin"],
  variable: "--font-saira",
});

const archivo = Archivo({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-archivo",
});

export const metadata: Metadata = {
  title: "Goalie Training",
  description:
    "Upload goalkeeper training clips and get coaching notes on positioning, footwork, diving, handling, and recovery — plus a personalized training plan.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${saira.variable} ${archivo.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-ground text-ink">
        <ClerkProvider
          signInUrl="/sign-in"
          signUpUrl="/sign-up"
          appearance={{
            variables: {
              colorPrimary: "#c6f24e",
              colorBackground: "#131a17",
              colorForeground: "#eef2ee",
              colorMutedForeground: "#a9b4ad",
              colorInput: "#161d1a",
              colorInputForeground: "#eef2ee",
              colorBorder: "#25302a",
              borderRadius: "4px",
            },
          }}
        >
          <header className="border-b border-line">
            <div className="mx-auto flex h-[68px] max-w-6xl items-center justify-between px-4 sm:px-14">
              <Link href="/" className="flex items-center gap-3">
                <span aria-hidden className="h-[26px] w-[38px] border-t-[3px] border-r-[3px] border-l-[3px] border-accent" />
                <span className="font-display text-lg font-extrabold tracking-wide text-ink uppercase">
                  Goalie Training
                </span>
              </Link>
              <HeaderNav />
            </div>
          </header>

          <div className="flex-1">{children}</div>

          <footer className="border-t border-line">
            <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-muted sm:px-14">
              Built for goalkeepers who want to train smarter, one clip at a time.
            </div>
          </footer>
        </ClerkProvider>
      </body>
    </html>
  );
}
