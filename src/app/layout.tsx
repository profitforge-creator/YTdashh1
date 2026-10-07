import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: { default: "DevMint", template: "%s · DevMint" },
  description: "Research, plan, build, staff and grow Roblox games.",
  applicationName: "DevMint",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "DevMint", statusBarStyle: "black-translucent" },
  icons: { icon: "/icons/icon.svg", apple: "/icons/icon-192.png" },
};

export const viewport: Viewport = {
  themeColor: "#09090a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        {children}
        <Toaster
          theme="dark"
          position="top-center"
          toastOptions={{ style: { background: "#17171a", border: "1px solid #26262b", color: "#f4f4f5" } }}
        />
      </body>
    </html>
  );
}
