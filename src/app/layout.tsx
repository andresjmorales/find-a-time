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
      <body className="bg-gray-50 min-h-screen font-sans">
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <a href="/" className="text-xl font-bold text-emerald-600">
              Find a Time
            </a>
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
