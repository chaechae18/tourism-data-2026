import "./globals.css";
import { LanguageProvider } from "../components/i18n/LanguageProvider";

export const metadata = {
  title: "Play Gyeongju | Donggyeong",
  description: "A Three.js Donggyeong mascot for Play Gyeongju.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body><LanguageProvider>{children}</LanguageProvider></body>
    </html>
  );
}
