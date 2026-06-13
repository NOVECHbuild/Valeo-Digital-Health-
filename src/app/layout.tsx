import type { Metadata } from "next";
import { DM_Sans, DM_Serif_Display } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import GoogleAnalytics from "@/components/GoogleAnalytics";

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
  openGraph: {
    type:        "website",
    url:         "https://www.valeoexperience.com",
    title:       "The Valeo Experience | Caribbean Mental Health Platform",
    description: "Expert psychological support rooted in Caribbean understanding. Individual therapy, resilience coaching, and workplace wellness with Dr. Jozelle Miller, PhD.",
    siteName:    "The Valeo Experience",
    images: [
      {
        url:    "/images/og-image.jpg",
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
    images:      ["/images/og-image.jpg"],
  },
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
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}