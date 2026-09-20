"use client";

import { useState } from "react";

import { translateText } from "../../lib/api/translations";
import { useI18n } from "../i18n/LanguageProvider";


export default function TranslatableText({
  targetType,
  targetId,
  sourceLanguage,
  name,
  nameClassName,
  text,
  className,
}) {
  const { language, t } = useI18n();
  const [translation, setTranslation] = useState(null);
  const [showingTranslation, setShowingTranslation] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  // 작성 언어를 남기기 전에 올라온 글은 한국어로 본다.
  const translatable = Boolean(text) && (sourceLanguage || "ko") !== language;
  // 화면 언어를 바꾸면 들고 있던 번역은 버리고 다시 받는다.
  const translated = translation?.language === language ? translation : null;
  const showing = showingTranslation && translated;

  async function toggleTranslation() {
    if (loading) return;
    if (translated) {
      setShowingTranslation(!showingTranslation);
      return;
    }
    setLoading(true);
    setFailed(false);
    try {
      setTranslation(await translateText(targetType, targetId, language));
      setShowingTranslation(true);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {name !== undefined && (
        <h2 className={nameClassName}>
          {showing && translated.placeName ? translated.placeName : name}
        </h2>
      )}
      <p className={className}>{showing ? translated.text : text}</p>
      {translatable && (
        <button
          type="button"
          onClick={toggleTranslation}
          disabled={loading}
          className="mt-1 text-xs font-bold text-[#8a7d71] underline disabled:opacity-60"
        >
          {loading
            ? t("spots.translating")
            : showing
              ? t("spots.showOriginal")
              : t("spots.translate")}
        </button>
      )}
      {failed && (
        <p className="mt-1 text-xs text-[#a8463d]">{t("spots.translateFailed")}</p>
      )}
    </>
  );
}
