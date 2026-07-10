import "./globals.css";

export const metadata = {
  title: "Play Gyeongju | Donggyeong",
  description: "A Three.js Donggyeong mascot for Play Gyeongju.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
