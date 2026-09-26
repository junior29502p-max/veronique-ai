import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";
import { ProfileProvider } from "@/lib/profile-context";
import { AppHeader } from "@/components/app-header";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Véronique AI — Assistante vocale",
  description:
    "Véronique, votre assistante vocale personnelle : conversation naturelle, ouverture d'applications, appels et contrôle de l'appareil à la voix. Orbe 3D fluide réactive en temps réel.",
  keywords: [
    "Véronique",
    "assistant vocal",
    "IA",
    "voice assistant",
    "STT",
    "TTS",
    "function calling",
    "3D orb",
    "WebGL",
  ],
  authors: [{ name: "Véronique AI" }],
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-black text-foreground overflow-hidden`}
      >
        <ThemeProvider>
          <ProfileProvider>
            <div className="flex h-[100dvh] flex-col overflow-hidden">
              <AppHeader />
              <main className="flex flex-1 flex-col overflow-hidden">{children}</main>
            </div>
            <Toaster />
          </ProfileProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
