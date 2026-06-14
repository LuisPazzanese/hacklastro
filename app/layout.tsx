import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Lastro SDR — encontre seu imóvel",
  description: "Assistente de IA que qualifica seu perfil e mostra imóveis no mapa do Brasil.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-br">
      <body>{children}</body>
    </html>
  );
}
