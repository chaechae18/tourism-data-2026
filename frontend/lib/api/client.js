const DEFAULT_TIMEOUT_MS = 8000;

/**
 * Read the API origin.
 *
 * Next inlines `process.env.NEXT_PUBLIC_*` at build time wherever the literal
 * appears, so reading it inside a function is equivalent in the app while
 * letting tests point the client somewhere else.
 */
export function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
}

export class ApiError extends Error {
  constructor(message, { status = null, cause = null } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.cause = cause;
  }
}

/**
 * Read a JSON endpoint from the home API.
 *
 * The backend answers every list endpoint with a plain array, and treats an
 * unknown `lang` as Korean rather than an error, so there is nothing to
 * negotiate here beyond passing the code through.
 */
export async function fetchJson(path, { lang, signal, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    throw new ApiError("NEXT_PUBLIC_API_BASE_URL이 설정되지 않았습니다.");
  }

  const url = new URL(path, baseUrl);
  if (lang) url.searchParams.set("lang", lang);

  // Compose the caller's signal with our own timeout so an unmounted
  // component and a hung server both abort the same request.
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), timeoutMs);
  const onAbort = () => timeout.abort();
  signal?.addEventListener("abort", onAbort);

  try {
    const response = await fetch(url, {
      signal: timeout.signal,
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new ApiError(`요청이 실패했습니다 (${response.status})`, { status: response.status });
    }

    return await response.json();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error?.name === "AbortError") throw error;
    throw new ApiError("서버에 연결하지 못했습니다.", { cause: error });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}
