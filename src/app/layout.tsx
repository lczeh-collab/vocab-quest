import type { Metadata } from "next";
import Link from "next/link";
import PlayerBadge from "@/components/PlayerBadge";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vocab Quest",
  description: "Snap your vocabulary notebook and play to learn it.",
};

const NAV = [
  { href: "/", label: "🏠 Home" },
  { href: "/scan", label: "📸 Scan" },
  { href: "/words", label: "📚 Words" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <header className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2 px-4 py-4">
          <Link href="/" className="text-2xl font-black text-grape">
            Vocab<span className="text-bubble">Quest</span> ✨
          </Link>
          <nav className="flex gap-1 text-sm font-bold sm:gap-3 sm:text-base">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="rounded-xl px-2 py-1 hover:bg-white/70 sm:px-3">
                {n.label}
              </Link>
            ))}
          </nav>
          <PlayerBadge />
        </header>
        <main className="mx-auto max-w-4xl px-4 pb-16">{children}</main>
      </body>
    </html>
  );
}
