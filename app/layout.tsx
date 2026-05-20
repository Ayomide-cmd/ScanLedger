import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ScanLedger",
  description: "Retail operations system for stock, checkout, and profit tracking"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
