import { Inter } from "next/font/google";
import "./globals.css";
import AppShellClient from "@/components/AppShellClient";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "TMT Tech Manager",
  description: "Gestão de Automação Estratégica para Empresas",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <AppShellClient>
          {children}
        </AppShellClient>
      </body>
    </html>
  );
}
