import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "QOLC",
  description: "介護施設向け決済SaaS",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
