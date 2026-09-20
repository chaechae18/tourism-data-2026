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

  it.each([
    ["en", "My Travel Tickets", "Places I visited"],
    ["ja", "私の旅行チケット", "訪問した場所"],
    ["zh", "我的旅行票", "我去过的地方"],
  ])("keeps visited-place messages in %s without Korean fallback", (language, title, visited) => {
    const t = createTranslator(language);

    expect(t("myPage.visited")).toBe(visited);
    expect(t("myPage.visitedPlaces.ticketTitle")).toBe(title);
    for (const key of leafKeys(MESSAGES.ko.myPage.visitedPlaces)) {
      const path = `myPage.visitedPlaces.${key}`;
      expect(t(path)).not.toBe(path);
      expect(t(path)).not.toMatch(/[가-힣]/);
    }
  });
});
