import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "OPSAL — Manutenções AL",
  description: "Gestão de manutenções de alojamento local",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-PT">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
