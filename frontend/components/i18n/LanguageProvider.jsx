"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getUserPreferences, updateUserLanguage } from "../../lib/api/users";
import { createTranslator, SUPPORTED_LANGUAGES } from "../../lib/i18n";


const fallbackValue = {
  language: "ko",
  saving: false,
  t: createTranslator("ko"),
  changeLanguage: async () => undefined,
};

const LanguageContext = createContext(fallbackValue);

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState("ko");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    getUserPreferences()
      .then((preferences) => {
        if (active && SUPPORTED_LANGUAGES.includes(preferences.language)) {
          setLanguage(preferences.language);
        }
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const changeLanguage = useCallback(async (nextLanguage) => {
    if (saving || nextLanguage === language || !SUPPORTED_LANGUAGES.includes(nextLanguage)) return;
    const previousLanguage = language;
    setLanguage(nextLanguage);
    setSaving(true);
    try {
      const preferences = await updateUserLanguage(nextLanguage);
      setLanguage(preferences.language);
    } catch (error) {
      setLanguage(previousLanguage);
      throw error;
    } finally {
      setSaving(false);
    }
  }, [language, saving]);

  const t = useMemo(() => createTranslator(language), [language]);

  const value = useMemo(() => ({
    language,
    saving,
    t,
    changeLanguage,
  }), [changeLanguage, language, saving, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useI18n() {
  return useContext(LanguageContext);
}
