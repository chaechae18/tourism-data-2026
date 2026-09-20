"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Download, RefreshCw, SwitchCamera } from "lucide-react";
import { useI18n } from "../i18n/LanguageProvider";
import AppButton from "../ui/AppButton";
import AppModal from "../ui/AppModal";
import Donggyeong3D from "./Donggyeong3D";

// Use the same placement in the live preview and the saved image.
const AVATAR = { left: 0.5, top: 0.4, width: 0.5, height: 0.6 };

export default function DonggyeongCamera({ items, onClose }) {
  const { t } = useI18n();
  const videoRef = useRef(null);
  const viewerRef = useRef(null);
  const [facing, setFacing] = useState("user");
  const [mirrored, setMirrored] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [cameraReady, setCameraReady] = useState(false);
  const [avatarReady, setAvatarReady] = useState(false);
  const [error, setError] = useState(null);
  const [photo, setPhoto] = useState(null);

  useEffect(() => {
    if (photo) return;
    let cancelled = false;
    let stream;
    const video = videoRef.current;
    setCameraReady(false);
    setError(null);
    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("camera.unsupported");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: facing }, width: { ideal: 1080 }, height: { ideal: 1440 } },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        const actualFacing = stream.getVideoTracks()[0]?.getSettings().facingMode || facing;
        setMirrored(actualFacing === "user");
        video.srcObject = stream;
        await video.play();
      } catch (cause) {
        stream?.getTracks().forEach((track) => track.stop());
        if (!cancelled) setError(cause.name === "NotAllowedError" ? "camera.denied" : cause.name === "NotFoundError" ? "camera.notFound" : "camera.failed");
      }
    };
    void start();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
    };
  }, [facing, attempt, photo]);

  const takePhoto = () => {
    const video = videoRef.current;
    if (!cameraReady || !avatarReady || !video.videoWidth || !video.videoHeight) return;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 1080;
      canvas.height = 1440;
      const context = canvas.getContext("2d");
      // Match the preview's object-fit: cover crop; mirror only the selfie camera.
      const scale = Math.max(canvas.width / video.videoWidth, canvas.height / video.videoHeight);
      const width = video.videoWidth * scale;
      const height = video.videoHeight * scale;
      context.save();
      if (mirrored) {
        context.translate(canvas.width, 0);
        context.scale(-1, 1);
      }
      context.drawImage(video, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
      context.restore();
      if (!viewerRef.current?.drawTo(context, AVATAR.left * canvas.width, AVATAR.top * canvas.height, AVATAR.width * canvas.width, AVATAR.height * canvas.height)) return;
      setPhoto(canvas.toDataURL("image/png"));
      setError(null);
    } catch {
      setError("donggyeong.photoError");
    }
  };

  const savePhoto = () => {
    try {
      const link = document.createElement("a");
      link.href = photo;
      link.download = "my-donggyeong.png";
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      setError("donggyeong.photoError");
    }
  };

  return (
    <AppModal open variant="dialog" onClose={onClose} title={t("camera.title")}>
      <p className="mb-4 text-sm text-[#747579]">{t(photo ? "camera.review" : "camera.guide")}</p>
      <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-[#18272f]">
        {photo ? <img src={photo} alt={t("camera.preview")} className="h-full w-full object-cover" /> : <>
          <video ref={videoRef} autoPlay muted playsInline onPlaying={() => setCameraReady(true)} aria-label={t("camera.live")} className={`absolute inset-0 h-full w-full object-cover ${mirrored ? "-scale-x-100" : ""}`} />
          {cameraReady && <div className="pointer-events-none absolute" style={{ left: `${AVATAR.left * 100}%`, top: `${AVATAR.top * 100}%`, width: `${AVATAR.width * 100}%`, height: `${AVATAR.height * 100}%` }}>
            <Donggyeong3D ref={viewerRef} className="absolute inset-0" items={items.filter((item) => item.slot !== "effect")} interactive={false} transparent onReadyChange={setAvatarReady} />
          </div>}
          {!cameraReady && <div className="absolute inset-0 flex items-center justify-center px-5 text-center text-sm text-white">{error ? <Camera size={40} aria-hidden="true" /> : <p role="status">{t("camera.loading")}</p>}</div>}
        </>}
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-[#9f4a2c]">{t(error)}</p>}
      <div className="mt-4 flex flex-wrap justify-center gap-3">
        {photo ? <>
          <AppButton icon={RefreshCw} variant="outline" onClick={() => { setAvatarReady(false); setPhoto(null); }}>{t("camera.retake")}</AppButton>
          <AppButton icon={Download} onClick={savePhoto}>{t("camera.save")}</AppButton>
        </> : <>
          <AppButton icon={SwitchCamera} variant="outline" disabled={!cameraReady} onClick={() => { setCameraReady(false); setAvatarReady(false); setFacing((current) => current === "user" ? "environment" : "user"); }}>{t("camera.switch")}</AppButton>
          <AppButton icon={Camera} disabled={!cameraReady || !avatarReady || Boolean(error)} onClick={takePhoto}>{t("camera.shutter")}</AppButton>
          {error && <AppButton variant="outline" onClick={() => setAttempt((current) => current + 1)}>{t("camera.retry")}</AppButton>}
        </>}
      </div>
    </AppModal>
  );
}
