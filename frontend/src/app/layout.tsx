import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MediBot",
  description: "AI-driven Healthcare Assistant.",
};

export const viewport: Viewport = {
  themeColor: "#F4F9FF",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased bg-white sm:bg-slate-100 flex items-center justify-center min-h-[100dvh]">
        {/* Mobile emulation container for desktop viewport, full screen for mobile devices */}
        <div className="w-full h-[100dvh] bg-[#F4F9FF] relative sm:h-[820px] sm:max-w-[400px] sm:rounded-[48px] sm:border-[10px] sm:border-slate-800 sm:shadow-2xl overflow-hidden flex flex-col">
          {children}
        </div>
      </body>
    </html>
  );
}
