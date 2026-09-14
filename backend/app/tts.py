
from base64 import b64decode
from dataclasses import dataclass
import re

import httpx


GOOGLE_TTS_URL = "https://texttospeech.googleapis.com/v1/text:synthesize"
# 원고 언어에 맞는 목소리. 한국어 목소리로 영어를 읽히면 발음이 무너진다.
VOICES = {
    "ko": ("ko-KR", "ko-KR-Neural2-A"),
    "en": ("en-US", "en-US-Neural2-F"),
    "ja": ("ja-JP", "ja-JP-Neural2-B"),
    # 구글은 중국어 표준어를 cmn-CN 으로 부른다.
    "zh": ("cmn-CN", "cmn-CN-Wavenet-A"),
}
DEFAULT_TTS_LANGUAGE = "ko"


def voice_for(language: str) -> tuple[str, str]:
    """언어 코드 -> (구글 languageCode, 목소리 이름)."""
    return VOICES.get(language, VOICES[DEFAULT_TTS_LANGUAGE])
# 구글 요청 한도는 5,000바이트
MAX_REQUEST_BYTES = 4000
# 문장 끝(마침표/물음표/느낌표), 줄바꿈에서 변경
SENTENCE_BOUNDARY = re.compile(r"(?<=[.!?。])\s+|\n+")


class TtsNotConfiguredError(RuntimeError):
    """GOOGLE_TTS_API_KEY 가 없다."""


@dataclass
class TtsUpstreamError(RuntimeError):
   # 구글 TTS API 호출 실패

    status_code: int | None = None
    # 실패 원인
    detail: str = ""


def split_for_request(text: str, max_bytes: int = MAX_REQUEST_BYTES) -> list[str]:
    # 한 번에 보낼 수 있는 크기로 나눔
    pieces: list[str] = []
    for sentence in SENTENCE_BOUNDARY.split(text.strip()):
        sentence = sentence.strip()
        if not sentence:
            continue
        # 한 문장이 이미 한도를 넘으면 그 문장만 글자 수로 다시 자르기
        while len(sentence.encode("utf-8")) > max_bytes:
            cut = max_bytes // 3  
            pieces.append(sentence[:cut])
            sentence = sentence[cut:]
        if not sentence:
            continue
        if pieces and len(f"{pieces[-1]} {sentence}".encode("utf-8")) <= max_bytes:
            pieces[-1] = f"{pieces[-1]} {sentence}"
        else:
            pieces.append(sentence)
    return pieces


class GoogleTextToSpeechClient:
    def __init__(
        self,
        api_key: str,
        *,
        voice: str,
        speaking_rate: float,
        language_code: str = "ko-KR",
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self.api_key = api_key
        self.voice = voice
        self.speaking_rate = speaking_rate
        self.language_code = language_code
        self.client = client

    async def synthesize(self, text: str, language: str | None = None) -> bytes:
        if not self.api_key:
            raise TtsNotConfiguredError

        chunks = split_for_request(text)
        if not chunks:
            raise TtsUpstreamError()

        # 원고 언어를 주면 그 언어 목소리로 읽는다. 없으면 만들 때 정한 목소리다.
        language_code, voice = (
            voice_for(language) if language else (self.language_code, self.voice)
        )

        # 조각들의 mp3 를 이어 붙임
        audio = bytearray()
        for chunk in chunks:
            audio.extend(await self._synthesize_chunk(chunk, language_code, voice))
        return bytes(audio)

    async def _synthesize_chunk(self, text: str, language_code: str, voice: str) -> bytes:
        payload = {
            "input": {"text": text},
            "voice": {"languageCode": language_code, "name": voice},
            "audioConfig": {
                "audioEncoding": "MP3",
                "speakingRate": self.speaking_rate,
            },
        }
        try:
            if self.client:
                response = await self.client.post(
                    GOOGLE_TTS_URL,
                    params={"key": self.api_key},
                    json=payload,
                )
            else:
                async with httpx.AsyncClient(timeout=20.0) as client:
                    response = await client.post(
                        GOOGLE_TTS_URL,
                        params={"key": self.api_key},
                        json=payload,
                    )
            response.raise_for_status()
        except httpx.HTTPStatusError as error:
            raise TtsUpstreamError(
                error.response.status_code,
                _error_detail(error.response),
            ) from error
        except httpx.HTTPError as error:
            raise TtsUpstreamError(detail=str(error)) from error

        content = response.json().get("audioContent")
        if not content:
            raise TtsUpstreamError(detail="응답에 음성이 없습니다.")
        return b64decode(content)


def _error_detail(response: httpx.Response) -> str:
    # 구글 에러 본문에서 사람이 읽을 부분만
    try:
        error = response.json().get("error", {})
    except ValueError:
        return response.text[:200]
    reason = (error.get("details") or [{}])[0].get("reason", "")
    return " ".join(part for part in (error.get("status"), reason, error.get("message")) if part)[:300]
