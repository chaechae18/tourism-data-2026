"use client";

import { useState } from "react";
import Image from "next/image";
import { useI18n } from "../i18n/LanguageProvider";
import styles from "./DonggyeongGathering.module.css";
import scholar from "../../public/images/donggyeong-intro/scholar-portrait.png";
import monk from "../../public/images/donggyeong-intro/monk-portrait.png";
import warrior from "../../public/images/donggyeong-intro/warrior-portrait.png";
import courtLady from "../../public/images/donggyeong-intro/court_lady-portrait.png";
import king from "../../public/images/donggyeong-intro/king-portrait.png";
import merchant from "../../public/images/donggyeong-intro/merchant-portrait.png";

const PORTRAITS = { scholar, monk, warrior, court_lady: courtLady, king, merchant };

const COMPANIONS = [
  { role: "scholar", turn: -2, lift: -3, duration: 5.2, phase: -1.3 },
  { role: "court_lady", turn: 2, lift: -5, duration: 6.7, phase: -4.2 },
  { role: "king", turn: -1, lift: -2, duration: 5.8, phase: -2.5 },
  { role: "warrior", turn: 2, lift: -4, duration: 7.3, phase: -5.7 },
  { role: "monk", turn: -2, lift: -3, duration: 6.1, phase: -3.1 },
  { role: "merchant", turn: 1, lift: -5, duration: 8.2, phase: -1.6 },
];

export default function DonggyeongGathering() {
  const { t } = useI18n();
  const [settledImages, setSettledImages] = useState([]);
  const progress = settledImages.length / COMPANIONS.length;
  const finishImage = (role) => setSettledImages((current) => (
    current.includes(role) ? current : [...current, role]
  ));

  return (
    <div className={styles.scene}>
      <p className={styles.logo} aria-label="PLAY GYEONGJU" style={{ "--progress": `${progress * 100}%` }}>
        <span className={styles.play} aria-hidden="true">PLAY</span>
        <span aria-hidden="true">GYEONGJU</span>
      </p>
      <h1 className={styles.subtitle}>{t("intro.title")}</h1>
      <div className={styles.portraits} role="img" aria-label={t("intro.gatheringLabel")}>
        {COMPANIONS.map(({ role, turn, lift, duration, phase }, index) => (
          <div key={role} className={styles.companion} style={{
            "--turn": `${turn}deg`,
            "--lift": `${lift}px`,
            "--duration": `${duration}s`,
            "--phase": `${phase}s`,
            zIndex: index === 2 ? 7 : index + 1,
          }}>
            <Image src={PORTRAITS[role]} alt="" width={400} height={440} sizes="(max-width: 430px) 25vw, 108px" priority draggable={false} onLoad={() => finishImage(role)} onError={() => finishImage(role)} />
          </div>
        ))}
      </div>

    </div>
  );
}
