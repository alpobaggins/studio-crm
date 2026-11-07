import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Studio CRM",
  description: "CRM-lite для агентства выставочных стендов и бренд-зон",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
