"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getUserPreferences, updateUserLanguage } from "../../lib/api/users";
import { createTranslator, SUPPORTED_LANGUAGES } from "../../lib/i18n";


const fallbackValue = {
  language: "ko",
  saving: false,
  t: createTranslator("ko"),
  changeLanguage: async () => undefined,
  reloadLanguage: async () => undefined,
  resetLanguage: () => undefined,
};

const LanguageContext = createContext(fallbackValue);

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState("ko");
  const [saving, setSaving] = useState(false);
  const requestId = useRef(0);

  const reloadLanguage = useCallback(async () => {
    const currentRequest = ++requestId.current;
    const preferences = await getUserPreferences();
    if (currentRequest === requestId.current && SUPPORTED_LANGUAGES.includes(preferences.language)) {
      setLanguage(preferences.language);
    }
  }, []);

  const resetLanguage = useCallback(() => {
    requestId.current += 1;
    setLanguage("ko");
    setSaving(false);
  }, []);

  useEffect(() => {
    reloadLanguage().catch(() => undefined);
    return () => { requestId.current += 1; };
  }, [reloadLanguage]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const changeLanguage = useCallback(async (nextLanguage) => {
    if (saving || nextLanguage === language || !SUPPORTED_LANGUAGES.includes(nextLanguage)) return;
    const previousLanguage = language;
    const currentRequest = ++requestId.current;
    setLanguage(nextLanguage);
    setSaving(true);
    try {
      const preferences = await updateUserLanguage(nextLanguage);
      if (currentRequest === requestId.current) setLanguage(preferences.language);
    } catch (error) {
      if (currentRequest === requestId.current) setLanguage(previousLanguage);
      throw error;
    } finally {
      if (currentRequest === requestId.current) setSaving(false);
    }
  }, [language, saving]);

  const t = useMemo(() => createTranslator(language), [language]);

  const value = useMemo(() => ({
    language,
    saving,
    t,
    changeLanguage,
    reloadLanguage,
    resetLanguage,
  }), [changeLanguage, language, reloadLanguage, resetLanguage, saving, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useI18n() {
  return useContext(LanguageContext);
}
