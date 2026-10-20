import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BreadBit Projects",
  description: "Private project storage and shared circuit snapshots for BreadBit.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
