import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Find a Time",
  description: "Find the best time for everyone to meet",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-slate-50 min-h-screen font-sans antialiased">
        <header className="bg-white/90 backdrop-blur border-b border-slate-200 sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 py-3">
            <a
              href="/"
              className="text-lg font-bold text-violet-600 hover:text-violet-700 transition-colors"
            >
              Find a Time
            </a>
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-4 py-6 sm:py-8">{children}</main>
      </body>
    </html>
  );
}
