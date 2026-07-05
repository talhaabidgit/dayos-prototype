import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ImageKit — Offline Static Image Tools",
  description: "Resize, compress, and enhance images right in your browser. No uploads, fully offline-capable, with workflow automation.",
  keywords: ["image tools", "image resizer", "image compressor", "image enhancer", "offline", "static website"],
  authors: [{ name: "ImageKit" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "ImageKit — Offline Static Image Tools",
    description: "Resize, compress, and enhance images in your browser. No uploads needed.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ImageKit — Offline Static Image Tools",
    description: "Resize, compress, and enhance images in your browser.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
