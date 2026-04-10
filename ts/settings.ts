import { applyI18n, getLangPreference, setLangPreference } from "./i18n";

type LangPref = "auto" | "ja" | "en";

const LANG_SELECT_ID = "langSelect";

const langSelect = document.getElementById(
  LANG_SELECT_ID,
) as HTMLSelectElement | null;

initSettingsPage();

function initSettingsPage(): void {
  applyI18n(document);

  if (!langSelect) {
    return;
  }

  langSelect.value = getLangPreference();
  langSelect.addEventListener("change", () => {
    const selected = langSelect.value as LangPref;
    if (selected !== "auto" && selected !== "ja" && selected !== "en") {
      return;
    }
    setLangPreference(selected);
    window.location.reload();
  });
}
