import type { Metadata } from "next";
import {
  Geist,
  Geist_Mono,
} from "next/font/google";

import "./globals.css";

import AuctionPageTransition from
  "../components/AuctionPageTransition";


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});


const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});


export const metadata: Metadata = {
  title: "Fantasy AI",
  description:
    "Assistente intelligente per l'asta del fantacalcio.",
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="it"
      className={`
        ${geistSans.variable}
        ${geistMono.variable}
        h-full antialiased
      `}
    >
      <body className="min-h-full overflow-x-clip">
        {/*
         * Contenuto della pagina corrente:
         * Home, modalità asta, confronto, ecc.
         */}
        {children}


        {/*
         * Overlay globale mantenuto montato
         * durante il cambio tra le pagine.
         */}
        <AuctionPageTransition />
      </body>
    </html>
  );
}