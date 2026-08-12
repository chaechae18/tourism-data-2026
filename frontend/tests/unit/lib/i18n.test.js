import { createTranslator, MESSAGES, SUPPORTED_LANGUAGES } from "../../../lib/i18n";

function leafKeys(value, prefix = "") {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof child === "string" ? [path] : leafKeys(child, path);
  });
}

describe("i18n", () => {
  it("defines the same message keys for every supported language", () => {
    const koreanKeys = leafKeys(MESSAGES.ko).sort();

    for (const language of SUPPORTED_LANGUAGES) {
      expect(leafKeys(MESSAGES[language]).sort()).toEqual(koreanKeys);
    }
  });

  it("interpolates translated values", () => {
    expect(createTranslator("en")("play.courseReady", { name: "King" }))
      .toBe("The King course is now on the map.");
  });
});
