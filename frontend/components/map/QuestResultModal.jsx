"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Crown, Footprints, Gift, Hand, Image, MapPin, Shirt, Sparkles, X } from "lucide-react";
import { useI18n } from "../i18n/LanguageProvider";
import QuestConfetti from "./QuestConfetti";
import styles from "./QuestResultModal.module.css";

export default function QuestResultModal({ result, onClose }) {
  const { t } = useI18n();
  const panel = useRef(null);
  const [showReward, setShowReward] = useState(false);
  const success = result.type === "success";
  const nearby = result.type === "nearby";
  const reward = success ? result.reward : null;
  const rewardTitleKey = { hat: "titleHat", top: "titleTop", bottom: "titleBottom", effect: "titleEffect" }[reward?.slot];
  // 아이템 이름은 서버가 한국어로 준다. 번역이 있으면 그걸 쓴다.
  const itemKey = `itemNames.${reward?.id}`;
  const rewardName = reward && (t(itemKey) === itemKey ? reward.name : t(itemKey));
  const title = showReward ? (rewardTitleKey ? t(`questResult.${rewardTitleKey}`) : t("questResult.titleItem", { name: rewardName }))
    : t(success ? "questResult.titleSuccess" : nearby ? "questResult.titleNear" : "questResult.titleLocation");
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
        <button className={styles.close} aria-label={t("common.close")} onClick={advance}><X size={20} /></button>
        <div className={styles.art} aria-hidden="true">
          <span className={`${styles.halo} ${success ? styles.success : ""}`}>
            {showReward ? <RewardIcon size={43} strokeWidth={1.7} /> : success ? <Check size={43} strokeWidth={2.6} /> : <MapPin size={39} strokeWidth={1.7} />}
          </span>
          <span className={styles.smallIcon}>{success ? <Sparkles size={20} /> : <Footprints size={20} />}</span>
        </div>
        <p className={styles.eyebrow}>{t(showReward ? "questResult.eyebrowReward" : success ? (result.demo ? "questResult.eyebrowDemo" : "questResult.eyebrowSuccess") : "questResult.eyebrowPending")}</p>
        <h2 className={styles.title}>{title}</h2>
        <p id="quest-result-description" className={styles.description}>
          {(() => {
            const body = showReward ? "Reward" : success ? (result.demo ? "Demo" : "Success") : nearby ? "Near" : null;
            return body ? <>{t(`questResult.body${body}1`)}<br />{t(`questResult.body${body}2`)}</> : result.message;
          })()}
        </p>
        <div className={styles.place}>
          {showReward ? <Gift size={16} aria-hidden="true" /> : <MapPin size={16} aria-hidden="true" />}
          <span>{showReward ? rewardName : result.name}</span>
          <span className={styles.badge}>{t(showReward ? "questResult.badgeReward" : success ? "questResult.badgeVisited" : "questResult.badgeRadius")}</span>
        </div>
        <button className={styles.confirm} onClick={advance}>{t(reward && !showReward ? "questResult.ctaReward" : success ? "questResult.ctaSuccess" : nearby ? "questResult.ctaNear" : "questResult.ctaOk")}</button>
      </section>
    </div>, document.body,
  );
}
