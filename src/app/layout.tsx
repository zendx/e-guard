import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "S-Trends - X Impression/Views booster",
  description: "Country-based X trend discovery to boost impressions and views.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
