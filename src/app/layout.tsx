import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta" });

export const metadata: Metadata = {
  title: { default: "FOTOSQR Eventos", template: "%s · FOTOSQR" },
  description: "Fotos y videos de tus invitados, en vivo en la pantalla del evento.",
};

export const viewport: Viewport = { themeColor: "#0b0814" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-AR" className={jakarta.variable}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
