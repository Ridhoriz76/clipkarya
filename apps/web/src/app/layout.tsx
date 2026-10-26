import type { Metadata, Viewport } from "next";
import { Providers } from "@/components/providers";
import { APP_NAME } from "@/lib/env";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: `${APP_NAME} — Video pendek dengan AI`, template: `%s · ${APP_NAME}` },
  description: "Buat video untuk TikTok, Reels, dan YouTube Shorts dengan bantuan AI: naskah, voiceover, subtitle, dan ekspor dalam satu workflow.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#16171c" },
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className="min-h-dvh">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
