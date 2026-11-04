import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage" });
const instrument = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-instrument" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  title: { default: "FOTOSQR Eventos", template: "%s · FOTOSQR" },
  description: "Fotos y videos de tus invitados, en vivo en la pantalla del evento.",
};

export const viewport: Viewport = { themeColor: "#0f0e0c" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-AR" className={`${bricolage.variable} ${instrument.variable} ${jetbrains.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
