import type { Metadata, Viewport } from "next";
import { DM_Sans, DM_Serif_Display } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import GoogleAnalytics from "@/components/GoogleAnalytics";
import AppVersionGuard from "@/components/AppVersionGuard";
import PushBootstrap from "@/components/PushBootstrap";
import MaintenanceGate from "@/components/MaintenanceGate";

const dmSans = DM_Sans({
  subsets:  ["latin"],
  variable: "--font-dm-sans",
});

const dmSerif = DM_Serif_Display({
  weight:   "400",
  subsets:  ["latin"],
  variable: "--font-dm-serif",
  style:    ["normal", "italic"],
});

export const metadata: Metadata = {
  title:       "The Valeo Experience | Caribbean Mental Health Platform",
  description: "Expert psychological support rooted in Caribbean understanding. Individual therapy, resilience coaching, and workplace wellness with Dr. Jozelle Miller, PhD.",
  metadataBase: new URL("https://www.valeoexperience.com"),
  manifest: "/manifest.webmanifest",
  applicationName: "Valeo Experience",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Valeo",
  },
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    type:        "website",
    url:         "https://www.valeoexperience.com",
    title:       "The Valeo Experience | Caribbean Mental Health Platform",
    description: "Expert psychological support rooted in Caribbean understanding. Individual therapy, resilience coaching, and workplace wellness with Dr. Jozelle Miller, PhD.",
    siteName:    "The Valeo Experience",
    images: [
      {
        url:    "/images/og-image.png",
        width:  1200,
        height: 630,
        alt:    "The Valeo Experience — Caribbean Mental Health Platform",
      },
    ],
  },
  twitter: {
    card:        "summary_large_image",
    title:       "The Valeo Experience | Caribbean Mental Health Platform",
    description: "Expert psychological support rooted in Caribbean understanding. Individual therapy, resilience coaching, and workplace wellness with Dr. Jozelle Miller, PhD.",
    images:      ["/images/og-image.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#2A4A1A",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${dmSans.variable} ${dmSerif.variable} font-sans antialiased`}>
        <GoogleAnalytics />
        <AuthProvider>
          <MaintenanceGate>
            {children}
          </MaintenanceGate>
          <AppVersionGuard />
          <PushBootstrap />
        </AuthProvider>
      </body>
    </html>
  );
}
