import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { useEffect, useState } from "react";
import { LineLiff } from "@/app/components/LineLiff";


const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Pocket Drive - Liff",
  description: "Created by DKKs",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const lineLiffId = process.env.NEXT_PUBLIC_LINE_LIFF_ID

  return (
    <html lang="en">
      <body className={inter.className}>
      <LineLiff liffId={lineLiffId}>
        {children}
      </LineLiff>
      </body>
    </html>
  );
}
