import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FinHive",
  description: "Finance tracking for any organization -- churches, studios, businesses.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
