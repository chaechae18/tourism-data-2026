"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Check, Footprints, MapPin, Sparkles, X } from "lucide-react";
import QuestConfetti from "./QuestConfetti";
import styles from "./QuestResultModal.module.css";

export default function QuestResultModal({ result, onClose }) {
  const panel = useRef(null);
  const success = result.type === "success";
  const nearby = result.type === "nearby";
  const title = success ? "퀘스트 완료!" : nearby ? "조금만 더 가까이 와주세요" : "위치를 확인해 주세요";

  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.querySelector("button")?.focus();
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);

  const handleKeyDown = (event) => {
    if (event.key === "Escape") onClose();
    if (event.key !== "Tab") return;
    const buttons = panel.current.querySelectorAll("button");
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first.focus();
    }
  };

  return createPortal(
    <div className={styles.backdrop} onClick={onClose}>
      {success && <QuestConfetti />}
      <section ref={panel} className={styles.card} role="dialog" aria-modal="true" aria-label={title}
        aria-describedby="quest-result-description" onKeyDown={handleKeyDown} onClick={(event) => event.stopPropagation()}>
        <button className={styles.close} aria-label="닫기" onClick={onClose}><X size={20} /></button>
        <div className={styles.art} aria-hidden="true">
          <span className={`${styles.halo} ${success ? styles.success : ""}`}>
            {success ? <Check size={43} strokeWidth={2.6} /> : <MapPin size={39} strokeWidth={1.7} />}
          </span>
          <span className={styles.smallIcon}>{success ? <Sparkles size={20} /> : <Footprints size={20} />}</span>
        </div>
        <p className={styles.eyebrow}>{success ? (result.demo ? "심사·시연용 체험" : "오늘의 발자취 하나 더") : "발걸음이 모여 완성되는 여행"}</p>
        <h2 className={styles.title}>{title}</h2>
        <p id="quest-result-description" className={styles.description}>
          {success ? (result.demo ? <>현장 방문 없이 완료 기능을 체험했어요.<br />현재 코스에 완료 상태가 저장됐어요.</> : <>경주에서의 멋진 발걸음을 남겼어요.<br />다음 퀘스트도 함께해요!</>) : nearby
            ? <>아직 도착 전이에요.<br />장소에 방문해서 퀘스트를 완성해 주세요.</> : result.message}
        </p>
        <div className={styles.place}>
          <MapPin size={16} aria-hidden="true" />
          <span>{result.name}</span>
          <span className={styles.badge}>{success ? "방문 완료" : "100m 이내에서 완료"}</span>
        </div>
        <button className={styles.confirm} onClick={onClose}>{success ? "좋아, 계속 탐험하기" : nearby ? "좋아요, 방문할게요" : "확인"}</button>
      </section>
    </div>, document.body,
  );
}
