import type { Metadata, Viewport } from "next";
import "./globals.css";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

export const metadata: Metadata = {
  title: { default: "Financial Management System", template: "%s · Financial Management System" },
  description: "Financial Management System internal Trilogika Edutama",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        {/* Menentukan tema sebelum cat pertama (tanpa kedip); atribut data-theme dipasang di sini, bukan oleh React. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
