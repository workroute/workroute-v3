import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import SWRegister from "./sw-register";

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "700"],
});

const body = Inter({
  subsets: ["latin"],
  variable: "--font-body",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  // Relative canonical/OpenGraph addresses resolve against the public site, so
  // Google treats workroute.com.au (not app.workroute.com.au) as the real one.
  metadataBase: new URL("https://workroute.com.au"),
  title: "WorkRoute",
  description: "An AI receptionist and diary for tradies and local services. Never miss a booking.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "WorkRoute",
  },
};

export const viewport: Viewport = {
  themeColor: "#021f59",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>
        {children}
        <SWRegister />
      </body>
    </html>
  );
}
