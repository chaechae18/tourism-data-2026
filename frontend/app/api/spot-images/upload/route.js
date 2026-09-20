import { handleUpload } from "@vercel/blob/client";

export const runtime = "nodejs";

class UploadError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export async function POST(request) {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      throw new UploadError("이미지 저장소가 연결되지 않았습니다.", 503);
    }
    const body = await request.json();
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        // The backend owns the signed session and checks that the user is active.
        const base = process.env.BACKEND_API_BASE_URL
          || process.env.NEXT_PUBLIC_API_BASE_URL
          || (process.env.VERCEL ? new URL(request.url).origin : "http://localhost:8001");
        const auth = await fetch(`${base.replace(/\/$/, "")}/api/v1/auth/me`, {
          headers: { cookie: request.headers.get("cookie") || "" },
          cache: "no-store",
          redirect: "error",
        });
        if (!auth.ok) {
          throw new UploadError(
            auth.status === 401 ? "로그인이 필요합니다." : "로그인 정보를 확인하지 못했습니다.",
            auth.status === 401 ? 401 : 502,
          );
        }
        const { user } = await auth.json();
        if (!Number.isInteger(user?.user_no) || user.user_no < 1) {
          throw new UploadError("로그인이 필요합니다.", 401);
        }
        if (!/^spots\/[a-f0-9-]{36}\.(jpg|png|webp)$/.test(pathname)) {
          throw new UploadError("올바른 이미지 경로가 아닙니다.", 400);
        }
        return {
          allowedContentTypes: ["image/jpeg", "image/png", "image/webp"],
          maximumSizeInBytes: 10 * 1024 * 1024,
          addRandomSuffix: true,
          allowOverwrite: false,
          validUntil: Date.now() + 5 * 60 * 1000,
          tokenPayload: JSON.stringify({ userNo: user.user_no }),
        };
      },
      // handleUpload verifies the Blob callback signature. The post API saves
      // the URL with the caption after the browser finishes uploading.
      onUploadCompleted: async () => {},
    });
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof UploadError ? error.message : "이미지 업로드 요청을 처리하지 못했습니다." },
      { status: error instanceof UploadError ? error.status : 400 },
    );
  }
}
