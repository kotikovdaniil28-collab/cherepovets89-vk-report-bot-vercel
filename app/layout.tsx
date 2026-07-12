import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Manrope, Unbounded, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "sonner";
import "./globals.css";

const manrope = Manrope({ subsets: ["latin", "cyrillic"], variable: "--font-manrope" });
const unbounded = Unbounded({
  subsets: ["latin", "cyrillic"],
  variable: "--font-unbounded",
  weight: ["400", "600", "800"],
});
const mono = JetBrains_Mono({ subsets: ["latin", "cyrillic"], variable: "--font-jbmono" });

export const metadata: Metadata = {
  title: "CHEREPOVETS · Модерация",
  description: "Рабочее пространство модерации Discord-сервера CHEREPOVETS",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f8f5" },
    { media: "(prefers-color-scheme: dark)", color: "#131a15" },
  ],
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html
      lang="ru"
      suppressHydrationWarning
      className={`bg-background ${manrope.variable} ${unbounded.variable} ${mono.variable}`}
    >
      <body className="font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          {children}
          <Toaster richColors position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
