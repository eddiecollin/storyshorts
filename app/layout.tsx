import type { Metadata } from "next";
import Link from "next/link";
import { Clapperboard, Settings, Sparkles } from "lucide-react";
import "./globals.css";

export const metadata: Metadata = {
  title: "StoryShorts",
  description: "Generate vertical Reddit-style short-form videos with narration, captions, and gameplay footage."
};

const navItems = [
  { href: "/", label: "Editor", icon: Clapperboard },
  { href: "/templates", label: "Templates", icon: Sparkles },
  { href: "/settings", label: "Settings", icon: Settings }
];

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen bg-[var(--color-bg)] text-white">
          <header className="sticky top-0 z-40 border-b border-white/10 bg-neutral-950/88 backdrop-blur-xl">
            <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
              <Link href="/" className="flex items-center gap-3" aria-label="StoryShorts editor">
                <span className="grid size-9 place-items-center rounded-lg border border-white/12 bg-white text-neutral-950">
                  <Clapperboard size={19} strokeWidth={2.5} />
                </span>
                <span className="text-lg font-semibold tracking-normal">StoryShorts</span>
              </Link>
              <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] p-1">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-neutral-300 transition hover:bg-white/10 hover:text-white"
                  >
                    <item.icon size={16} />
                    <span className="hidden sm:inline">{item.label}</span>
                  </Link>
                ))}
              </div>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
