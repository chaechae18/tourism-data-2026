import "./globals.css";

export const metadata = {
  title: "Play Gyeongju | Donggyeong",
  description: "A Three.js Donggyeong mascot for Play Gyeongju.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preload" as="image" href="/images/cheomseongdae-paper-cut-day.webp" fetchPriority="high" />
        <link rel="preload" as="image" href="/images/cheomseongdae-paper-cut-night.webp" />
      </head>
      <body>{children}</body>
    </html>
  );
}
