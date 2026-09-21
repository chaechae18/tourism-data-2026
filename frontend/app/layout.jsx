import "./globals.css";
import { LanguageProvider } from "../components/i18n/LanguageProvider";

// 링크 미리보기 이미지는 절대 주소여야 한다. 배포에서는 API 주소가 곧 사이트 주소다.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL
  || (/^https?:\/\//.test(process.env.NEXT_PUBLIC_API_BASE_URL || "") ? process.env.NEXT_PUBLIC_API_BASE_URL : "")
  || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

const TITLE = "플레이 경주 | 동경이와 걷는 신라의 하루";
const DESCRIPTION = "신라 인물이 되어 경주 하루 코스를 받고, 문화유산 해설을 들으며 방문 보상을 모으는 여행 앱";

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: "Play Gyeongju",
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: "/images/og-image.jpg", width: 1200, height: 628, alt: "고분, 동궁과 월지, 첨성대가 어우러진 경주 풍경" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/images/og-image.jpg"],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body><LanguageProvider>{children}</LanguageProvider></body>
    </html>
  );
}
