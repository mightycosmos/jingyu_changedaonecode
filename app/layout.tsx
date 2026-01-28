import type { Metadata } from "next";
import "./globals.css";
import { FolderProvider } from "@/contexts/FolderContext";

export const metadata: Metadata = {
  title: "Aone - AI 학습 파트너",
  description: "강의 녹음과 자료를 자유롭게 정리하는 AI 학습 파트너",
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className="antialiased">
        <FolderProvider>
          {children}
        </FolderProvider>
      </body>
    </html>
  );
}

