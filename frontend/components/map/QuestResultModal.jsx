"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Crown, Footprints, Gift, Hand, Image, MapPin, Shirt, Sparkles, X } from "lucide-react";
import QuestConfetti from "./QuestConfetti";
import styles from "./QuestResultModal.module.css";

export default function QuestResultModal({ result, onClose }) {
  const panel = useRef(null);
  const [showReward, setShowReward] = useState(false);
  const success = result.type === "success";
  const nearby = result.type === "nearby";
  const reward = success ? result.reward : null;
  const rewardObject = { hat: "모자를", top: "상의를", bottom: "하의를", effect: "배경을" }[reward?.slot];
  const title = showReward ? (rewardObject ? `${rewardObject} 얻었어요!` : `${reward.name} 획득!`)
    : success ? "퀘스트 완료!" : nearby ? "조금만 더 가까이 와주세요" : "위치를 확인해 주세요";
  const RewardIcon = { hat: Crown, top: Shirt, bottom: Shirt, hand: Hand, effect: Image }[reward?.slot] || Gift;
  const advance = () => {
    if (reward && !showReward) setShowReward(true);
    else onClose();
  };

  useEffect(() => {
    if (!reward || showReward) return undefined;
    const timer = window.setTimeout(() => setShowReward(true), 2200);
    return () => window.clearTimeout(timer);
  }, [reward, showReward]);

  useEffect(() => { panel.current?.querySelector("button")?.focus(); }, [showReward]);

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
    if (event.key === "Escape") advance();
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
    <div className={styles.backdrop} onClick={advance}>
      {success && !showReward && <QuestConfetti />}
      <section ref={panel} className={styles.card} role="dialog" aria-modal="true" aria-label={title}
        aria-describedby="quest-result-description" onKeyDown={handleKeyDown} onClick={(event) => event.stopPropagation()}>
        <button className={styles.close} aria-label="닫기" onClick={advance}><X size={20} /></button>
        <div className={styles.art} aria-hidden="true">
          <span className={`${styles.halo} ${success ? styles.success : ""}`}>
            {showReward ? <RewardIcon size={43} strokeWidth={1.7} /> : success ? <Check size={43} strokeWidth={2.6} /> : <MapPin size={39} strokeWidth={1.7} />}
          </span>
          <span className={styles.smallIcon}>{success ? <Sparkles size={20} /> : <Footprints size={20} />}</span>
        </div>
        <p className={styles.eyebrow}>{showReward ? "동경이의 새로운 아이템" : success ? (result.demo ? "심사·시연용 체험" : "오늘의 발자취 하나 더") : "발걸음이 모여 완성되는 여행"}</p>
        <h2 className={styles.title}>{title}</h2>
        <p id="quest-result-description" className={styles.description}>
          {showReward ? <>내 동경이의 보유 아이템에 추가됐어요.<br />동경이 꾸미기에서 착용해 보세요!</> : success ? (result.demo ? <>현장 방문 없이 완료 기능을 체험했어요.<br />현재 코스에 완료 상태가 저장됐어요.</> : <>경주에서의 멋진 발걸음을 남겼어요.<br />다음 퀘스트도 함께해요!</>) : nearby
            ? <>아직 도착 전이에요.<br />장소에 방문해서 퀘스트를 완성해 주세요.</> : result.message}
        </p>
        <div className={styles.place}>
          {showReward ? <Gift size={16} aria-hidden="true" /> : <MapPin size={16} aria-hidden="true" />}
          <span>{showReward ? reward.name : result.name}</span>
          <span className={styles.badge}>{showReward ? "획득 완료" : success ? "방문 완료" : "100m 이내에서 완료"}</span>
        </div>
        <button className={styles.confirm} onClick={advance}>{reward && !showReward ? "보상 확인하기" : success ? "좋아, 계속 탐험하기" : nearby ? "좋아요, 방문할게요" : "확인"}</button>
      </section>
    </div>, document.body,
  );
}
