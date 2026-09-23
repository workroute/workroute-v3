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
  title: "WorkRoute",
  description: "Job capture for tradies — log the job before you forget it.",
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
