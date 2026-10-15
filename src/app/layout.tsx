import type { Metadata, Viewport } from "next";
import { Bebas_Neue, Inter, Sora, Geist_Mono } from "next/font/google";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import { SiteChrome } from "@/components/layout/SiteChrome";
import { BRAND } from "@/lib/brand";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const bebas = Bebas_Neue({
  variable: "--font-bebas",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: `${BRAND.name} — ${BRAND.tagline}`,
    template: `%s | ${BRAND.name}`,
  },
  description:
    "Predict congestion at Indian export ports and convert the delay into rupees before you book. Risk score, port comparison and demurrage exposure for MSME exporters.",
  applicationName: BRAND.name,
  icons: {
    icon: "/favicon.png",
    apple: "/brand/port-sense-mark.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#07111f",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${sora.variable} ${bebas.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body
        className="flex min-h-full flex-col overflow-x-hidden bg-surface-1 text-ink"
        suppressHydrationWarning
      >
        <a
          href="#main"
          className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-4 focus-visible:top-4 focus-visible:z-[100] focus-visible:rounded-full focus-visible:bg-brand-orange focus-visible:px-4 focus-visible:py-2 focus-visible:text-small focus-visible:font-semibold focus-visible:text-white"
        >
          Skip to content
        </a>
        <SiteChrome>{children}</SiteChrome>
      </body>
    </html>
  );
}
