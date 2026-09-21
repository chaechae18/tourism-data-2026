"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, RotateCw } from "lucide-react";
import { docentAudioUrl, fetchDocentScript } from "../../lib/api/docent";
import AppModal from "../ui/AppModal";
import { useI18n } from "../i18n/LanguageProvider";

const SKIP_SECONDS = 15;

// iOS 는 audio.volume 을 무시한다(항상 1). 그런 기기에서는 Web Audio 의 GainNode 로 음량을 낮춘다.
function volumeMode() {
  if (typeof Audio === "undefined") return "element";
  const probe = new Audio();
  probe.volume = 0.5;
  if (probe.volume === 0.5) return "element";
  return window.AudioContext || window.webkitAudioContext ? "webaudio" : "none";
}
const SPEEDS = [1, 1.25, 1.5];

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "0:00";
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

export default function DocentPlayer({ onClose, place }) {
  const { t,language } = useI18n();
  const audioRef = useRef(null);
  const animFrameRef = useRef(null);

  const [script, setScript] = useState(null);
  const [scriptError, setScriptError] = useState("");
  const [audioError, setAudioError] = useState("");
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [volume, setVolume] = useState(1);
  const [volumeControl] = useState(volumeMode);
  const webAudioRef = useRef(null);
  const [audioSrc, setAudioSrc] = useState(""); // 🟢 Blob URL 상태

  const placeId = place?.placeId;

  // 원고 불러오기
  useEffect(() => {
    if (!placeId) return undefined;

    const controller = new AbortController();
    setScript(null);
    setScriptError("");
    fetchDocentScript(placeId, { language, signal: controller.signal })
      .then(setScript)
      .catch((error) => {
        if (error.name === "AbortError") return;
        setScriptError(t("map.scriptFailed"));
      });
    return () => controller.abort();
  }, [language, placeId]);

// 🟢 재시도 로직이 포함된 안전한 오디오 로드 함수
  useEffect(() => {
    if (!placeId) return;

    let objectUrl = "";
    const controller = new AbortController();

    setReady(false);
    setAudioError("");
    setAudioSrc("");

    const loadAudioWithRetry = async (retries = 2, delay = 1000) => {
      for (let attempt = 0; attempt <= retries; attempt++) {
        if (controller.signal.aborted) return;

        try {
          const response = await fetch(docentAudioUrl(placeId, language), {
            signal: controller.signal,
          });

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const blob = await response.blob();
          if (controller.signal.aborted) return;

          objectUrl = URL.createObjectURL(blob);
          setAudioSrc(objectUrl);
          return; // 성공 시 종료
        } catch (error) {
          if (error.name === "AbortError") return; // 취소된 경우 무시

          console.warn(`음성 로드 시도 ${attempt + 1}회 실패:`, error);

          // 마지막 시도까지 실패한 경우
          if (attempt === retries) {
            if (!controller.signal.aborted) {
              setAudioError(t("map.audioFailed"));
            }
          } else {
            // 재시도 전 잠시 대기 (서버가 TTS를 만들 시간 벌기)
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
      }
    };

    loadAudioWithRetry();

    return () => {
      controller.abort();
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [placeId, language]);

  // 볼륨 및 재생 속도 반영
  useEffect(() => {
    if (audioRef.current) {
      if (volumeControl === "element") audioRef.current.volume = volume;
      audioRef.current.playbackRate = speed;
    }
    if (webAudioRef.current) webAudioRef.current.gain.gain.value = volume;
  }, [volume, speed, ready, volumeControl]);

  useEffect(() => () => { webAudioRef.current?.context.close(); }, []);

  // 재생 버튼을 누른 순간(사용자 동작 안)에 연결해야 iOS 가 소리를 낸다.
  const connectGain = (audio) => {
    if (volumeControl !== "webaudio") return;
    let graph = webAudioRef.current;
    if (!graph) {
      // 무음 모드인 아이폰에서도 일반 audio 처럼 들리게 재생용 세션으로 둔다(iOS 16.4+).
      if (navigator.audioSession) navigator.audioSession.type = "playback";
      const Context = window.AudioContext || window.webkitAudioContext;
      const context = new Context();
      const gain = context.createGain();
      gain.connect(context.destination);
      graph = { context, gain, element: null };
      webAudioRef.current = graph;
    }
    if (graph.element !== audio) {
      graph.context.createMediaElementSource(audio).connect(graph.gain);
      graph.element = audio;
    }
    graph.gain.gain.value = volume;
    if (graph.context.state !== "running") graph.context.resume();
  };

  const startProgressLoop = () => {
    cancelAnimationFrame(animFrameRef.current);

    const update = () => {
      const audio = audioRef.current;
      if (audio && !audio.paused && !audio.ended) {
        setCurrentTime(audio.currentTime);
        if (Number.isFinite(audio.duration) && audio.duration > duration) {
          setDuration(audio.duration);
        }
        animFrameRef.current = requestAnimationFrame(update);
      }
    };

    animFrameRef.current = requestAnimationFrame(update);
  };

  const stopProgressLoop = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }
  };

  useEffect(() => {
    return () => stopProgressLoop();
  }, []);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio || !ready) return;

    try {
      if (audio.paused) {
        connectGain(audio);
        await audio.play();
      } else {
        audio.pause();
      }
    } catch (error) {
      console.error("도슨트 재생 실패:", error);
      setPlaying(false);
      setAudioError(t("map.audioPlayFailed"));
    }
  };

  const skip = (seconds) => {
    const audio = audioRef.current;
    if (!audio) return;
    const targetTime = Math.min(Math.max(0, audio.currentTime + seconds), audio.duration || 0);
    audio.currentTime = targetTime;
    setCurrentTime(targetTime);
  };

  const seek = (event) => {
    const audio = audioRef.current;
    if (!audio) return;
    const next = Number(event.target.value);
    audio.currentTime = next;
    setCurrentTime(next);
  };

  const changeVolume = (event) => {
    const next = Number(event.target.value);
    setVolume(next);
    if (webAudioRef.current) webAudioRef.current.gain.gain.value = next;
    else if (audioRef.current) audioRef.current.volume = next;
  };

  return (
    <AppModal open={Boolean(place)} onClose={onClose} title={t("map.docentTitle2")}>
      <div className="space-y-5">
        <div>
          <p className="text-[10px] font-bold tracking-[0.12em] text-[#a09a8c]">{t("map.currentPlace")}</p>
          <p className="mt-0.5 text-lg font-bold text-[#343235]">{place?.name}</p>
        </div>

        {/* 재생 컨트롤 */}
        <div className="rounded-2xl border border-[#e7e0cf] bg-[#fdfaf3] p-4">
          {audioSrc && (
            <audio
              key={audioSrc}
              ref={audioRef}
              src={audioSrc}
              preload="auto"
              data-testid="docent-audio"
              
              onLoadedMetadata={(event) => {
                const audio = event.currentTarget;
                if (Number.isFinite(audio.duration) && audio.duration > 0) {
                  setDuration(audio.duration);
                }
              }}

              onCanPlayThrough={() => {
                setReady(true);
                setAudioError("");
              }}

              onPlay={() => {
                setPlaying(true);
                setAudioError("");
                startProgressLoop();
              }}

              onPause={() => {
                setPlaying(false);
                stopProgressLoop();
              }}

              onTimeUpdate={(event) => {
                const audio = event.currentTarget;
                setCurrentTime(audio.currentTime);
                if (Number.isFinite(audio.duration) && audio.duration > duration) {
                  setDuration(audio.duration);
                }
              }}

              onEnded={() => {
                setPlaying(false);
                setCurrentTime(0);
                stopProgressLoop();
              }}

              onError={(e) => {
                console.error("오디오 로딩/재생 에러:", e);
                setAudioError(t("map.audioFailed"));
                setReady(false);
                stopProgressLoop();
              }}
            />
          )}

          <div className="flex items-center justify-center gap-4">
            <button
              type="button"
              aria-label={t("map.skipBack", { seconds: SKIP_SECONDS })}
              onClick={() => skip(-SKIP_SECONDS)}
              disabled={!ready}
              className="flex min-h-11 w-16 flex-col items-center justify-center gap-1 rounded-lg text-[#626762] transition-colors disabled:opacity-40"
            >
              <RotateCcw size={20} aria-hidden="true" />
              <span className="text-[10px] font-semibold">{t("map.skipBack", { seconds: SKIP_SECONDS })}</span>
            </button>
            <button
              type="button"
              aria-label={t(playing ? "map.pause" : "map.play")}
              onClick={togglePlay}
              disabled={!ready}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-brand text-white shadow-[0_8px_20px_rgb(var(--color-brand)/0.35)] transition-colors disabled:opacity-45"
            >
              {playing ? <Pause size={26} /> : <Play size={26} className="ml-0.5" />}
            </button>
            <button
              type="button"
              aria-label={t("map.skipForward", { seconds: SKIP_SECONDS })}
              onClick={() => skip(SKIP_SECONDS)}
              disabled={!ready}
              className="flex min-h-11 w-16 flex-col items-center justify-center gap-1 rounded-lg text-[#626762] transition-colors disabled:opacity-40"
            >
              <RotateCw size={20} aria-hidden="true" />
              <span className="text-[10px] font-semibold">{t("map.skipForward", { seconds: SKIP_SECONDS })}</span>
            </button>
          </div>

          {/* 진행바 */}
          <div className="mt-4 flex items-center gap-2">
            <span className="w-9 text-right text-[11px] font-semibold tabular-nums text-[#8a8d89]">
              {formatTime(currentTime)}
            </span>
            <input
              type="range"
              aria-label={t("map.seek")}
              min="0"
              max={duration > 0 ? duration : 100}
              step="0.1"
              value={currentTime}
              onChange={seek}
              disabled={!ready}
              className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-[#e5e2d7] accent-brand disabled:opacity-50"
            />
            <span className="w-9 text-[11px] font-semibold tabular-nums text-[#8a8d89]">{formatTime(duration)}</span>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <p
              className="min-w-0 flex-1 text-[11px] font-semibold text-[#8a8d89]"
              role="status"
            >
              {audioError || (ready ? "" : t("map.audioPreparing"))}
            </p>

            {/* 볼륨 */}
            {volumeControl !== "none" ? (
              <div className="flex items-center gap-2">
                <span className="text-[13px]" aria-hidden="true">
                  {volume === 0 ? "🔇" : "🔊"}
                </span>

                <input
                  type="range"
                  aria-label={t("map.volume")}
                  min="0"
                  max="1"
                  step="0.05"
                  value={volume}
                  onChange={changeVolume}
                  className="h-1.5 w-20 cursor-pointer appearance-none rounded-full bg-[#e5e2d7] accent-brand"
                />
              </div>
            ) : (
              <span className="text-[10px] font-medium text-[#a09a8c]">🔊 {t("map.volumeHint")}</span>
            )}

            {/* 재생 속도 */}
            <button
              type="button"
              onClick={() =>
                setSpeed(
                  SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]
                )
              }
              className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-[#626762] shadow-sm"
            >
              {speed}x
            </button>
          </div>
        </div>

        {/* 원고 카드 */}
        <div className="mt-1">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#f5ead8]">
                <span className="text-sm">📖</span>
              </div>
              <div>
                <p className="text-sm font-bold text-[#343235]">{t("map.docentTitle")}</p>
                <p className="mt-0.5 text-[10px] text-[#aaa397]">{t("map.docentSubtitle")}</p>
              </div>
            </div>
            <span className="rounded-full bg-[#f7f3ea] px-2.5 py-1 text-[10px] font-semibold text-[#a09a8c]">
              TEXT
            </span>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-[#ebe4d5] bg-white shadow-[0_4px_16px_rgba(80,65,40,0.04)]">
            <div className="absolute bottom-0 left-0 top-0 w-1 bg-brand/60" />
            <div className="max-h-[70vh] overflow-y-auto px-5 py-5 pl-6">
              {scriptError && (
                <div className="rounded-xl bg-[#fff4ef] px-4 py-3 text-sm leading-6 text-[#9f4a2c]">
                  {scriptError}
                </div>
              )}

              {!scriptError && !script && (
                <div className="flex items-center gap-2 py-5 text-sm text-[#8a8d89]">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-brand" />
                  {t("map.scriptLoading")}
                </div>
              )}

              {script && (
                <>
                  <div className="mb-3 text-2xl leading-none text-[#d9c9ad]">“</div>
                  <p className="whitespace-pre-line text-[14px] leading-[1.9] tracking-[-0.01em] text-[#4f504f]">
                    {script.text}
                  </p>
                  <div className="mt-5 flex items-center justify-between border-t border-[#f0ece4] pt-3">
                    <span className="text-[10px] font-medium text-[#b0aa9e]">{t("map.source")}</span>
                    <span className="rounded-full bg-[#faf7f0] px-2.5 py-1 text-[10px] font-medium text-[#918b80]">
                      {t("map.kto")}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppModal>
  );
}