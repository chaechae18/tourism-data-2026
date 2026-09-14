"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, RotateCw } from "lucide-react";
import { docentAudioUrl, fetchDocentScript } from "../../lib/api/docent";
import AppModal from "../ui/AppModal";

// 건너뛰기 버튼 한 번에 움직이는 초
const SKIP_SECONDS = 15;
const SPEEDS = [1, 1.25, 1.5];

// 초를 "1:05" 형태로
function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "0:00";
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

// 장소 설명(PLACE.TEXT)을 읽어 주는 재생 시트.
// 음성은 서버가 요청받은 그 자리에서 만들어 보내 주고, 파일로 저장되지 않는다.
export default function DocentPlayer({ onClose, place }) {
  const audioRef = useRef(null);
  const [script, setScript] = useState(null);
  const [scriptError, setScriptError] = useState("");
  const [audioError, setAudioError] = useState("");
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);  // 음성이 만들어져 재생할 수 있는 상태
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);

  const placeId = place?.placeId;

  // 원고 불러오기 (장소가 바뀌면 다시)
  useEffect(() => {
    if (!placeId) return undefined;

    const controller = new AbortController();
    setScript(null);
    setScriptError("");
    fetchDocentScript(placeId, { signal: controller.signal })
      .then(setScript)
      .catch((error) => {
        if (error.name === "AbortError") return;
        setScriptError(error.message || "도슨트를 불러오지 못했어요.");
      });
    return () => controller.abort();
  }, [placeId]);

  // 재생 속도는 <audio> 에 직접 반영해야 한다.
  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed, ready]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      // 음성을 만드는 데 몇 초 걸릴 수 있어 실패해도 조용히 멈춘다.
      audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    } else {
      audio.pause();
      setPlaying(false);
    }
  };

  const skip = (seconds) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.min(Math.max(0, audio.currentTime + seconds), audio.duration || 0);
  };

  const seek = (event) => {
    const audio = audioRef.current;
    if (!audio) return;
    const next = Number(event.target.value);
    audio.currentTime = next;
    setCurrentTime(next);
  };

  return (
    <AppModal open={Boolean(place)} onClose={onClose} title="도슨트">
      <div className="space-y-5">
        <div>
          <p className="text-[10px] font-bold tracking-[0.12em] text-[#a09a8c]">지금 듣는 곳</p>
          <p className="mt-0.5 text-lg font-bold text-[#343235]">{place?.name}</p>
        </div>

        {/* 재생 컨트롤 */}
        <div className="rounded-2xl border border-[#e7e0cf] bg-[#fdfaf3] p-4">
          {placeId && (
            <audio
              ref={audioRef}
              src={docentAudioUrl(placeId)}
              preload="auto"
              data-testid="docent-audio"
              onCanPlay={() => setReady(true)}
              onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
              onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
              onEnded={() => setPlaying(false)}
              onError={() => {
                setReady(false);
                setPlaying(false);
                setAudioError("음성을 만들지 못했어요. 잠시 후 다시 시도해 주세요.");
              }}
            />
          )}

          <div className="flex items-center justify-center gap-4">
            <button
              type="button"
              aria-label={`${SKIP_SECONDS}초 뒤로`}
              onClick={() => skip(-SKIP_SECONDS)}
              disabled={!ready}
              className="flex h-11 w-11 items-center justify-center rounded-full text-[#626762] transition-colors disabled:opacity-40"
            >
              <RotateCcw size={20} />
            </button>
            <button
              type="button"
              aria-label={playing ? "일시정지" : "도슨트 재생"}
              onClick={togglePlay}
              disabled={!ready}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-brand text-white shadow-[0_8px_20px_rgb(var(--color-brand)/0.35)] transition-colors disabled:opacity-45"
            >
              {playing ? <Pause size={26} /> : <Play size={26} className="ml-0.5" />}
            </button>
            <button
              type="button"
              aria-label={`${SKIP_SECONDS}초 앞으로`}
              onClick={() => skip(SKIP_SECONDS)}
              disabled={!ready}
              className="flex h-11 w-11 items-center justify-center rounded-full text-[#626762] transition-colors disabled:opacity-40"
            >
              <RotateCw size={20} />
            </button>
          </div>

          {/* 진행바 */}
          <div className="mt-4 flex items-center gap-2">
            <span className="w-9 text-right text-[11px] font-semibold tabular-nums text-[#8a8d89]">{formatTime(currentTime)}</span>
            <input
              type="range"
              aria-label="재생 위치"
              min="0"
              max={duration || 0}
              step="1"
              value={currentTime}
              onChange={seek}
              disabled={!ready}
              className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-[#e5e2d7] accent-brand disabled:opacity-50"
            />
            <span className="w-9 text-[11px] font-semibold tabular-nums text-[#8a8d89]">{formatTime(duration)}</span>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <p className="text-[11px] font-semibold text-[#8a8d89]" role="status">
              {audioError || (ready ? "" : "음성을 준비하고 있어요…")}
            </p>
            <button
              type="button"
              onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])}
              className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-[#626762] shadow-sm"
            >
              {speed}x
            </button>
          </div>
        </div>

        {/* 원고 (소리를 못 켜는 곳에서도 읽을 수 있게) */}
        <div>
          <p className="mb-2 text-[10px] font-bold tracking-[0.12em] text-[#a09a8c]">도슨트 원고</p>
          {scriptError && <p className="text-sm text-[#9f4a2c]">{scriptError}</p>}
          {!scriptError && !script && <p className="text-sm text-[#8a8d89]">원고를 불러오는 중이에요…</p>}
          {script && (
            <>
              <p className="whitespace-pre-line text-sm leading-7 text-[#4f504f]">{script.text}</p>
              <p className="mt-3 text-[11px] text-[#a09a8c]">출처: {script.source}</p>
            </>
          )}
        </div>
      </div>
    </AppModal>
  );
}
