import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Store Manager",
  description: "Track and report on Google Maps reviews across your stores.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="border-b border-[var(--border)] bg-white">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link href="/" className="text-lg font-semibold">
              Store Manager
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/" className="text-[var(--muted)] hover:text-[var(--ink)]">
                Dashboard
              </Link>
              <Link href="/stores/new" className="btn btn-primary">
                + Add Store
              </Link>
            </nav>
          </div>
        </header>
        <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
