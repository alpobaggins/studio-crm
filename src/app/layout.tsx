import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Ось opsz: на крупных кеглях Inter становится плотнее (как Inter Display), мелкий текст остаётся читаемым.
const inter = Inter({
  subsets: ["latin", "cyrillic"],
  axes: ["opsz"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Studio CRM",
    template: "%s — Studio CRM",
  },
  description: "CRM-lite для агентства выставочных стендов и бренд-зон",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
