import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Goal Machine Agent OS",
  description: "Goal Machine Agent OS"
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
