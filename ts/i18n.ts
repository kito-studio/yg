type Lang = "ja" | "en";
type LangPref = "auto" | Lang;

type Vars = Record<string, string | number>;

const JA: Record<string, string> = {
  app_title: "やること撃破！",
  stage_map_alt: "ステージ選択地図",
  mode_toggle_aria: "閲覧モードと編集モードの切り替え",
  add_stage_aria: "ステージ追加",
  db_download_aria: "データベース全体をダウンロード",
  db_upload_aria: "データベースバックアップをアップロード",
  settings_aria: "設定画面へ移動",
  stage_settings_title: "ステージ設定",
  stage_settings_sub: "ステージの状態と基本情報を編集できます。",
  stage_tab_basic: "基本",
  stage_tab_image: "画像",
  stage_progress_label: "撃破状態（進捗）",
  hp_label: "HP",
  stage_name_label: "名称（nm）",
  stage_color_label: "基本色",
  stage_desc_label: "説明（desc）",
  stage_image_label: "ステージ画像",
  map_image_label: "マップ画像",
  current_file_label: "現在:",
  pick_registered_image: "登録済みから選択",
  image_picker_title: "登録済み画像から選択",
  image_picker_filter_placeholder: "名前(nm)で絞り込み",
  image_picker_ext_all: "拡張子: すべて",
  image_picker_close: "閉じる",
  image_picker_empty: "該当する画像がありません",
  image_picker_count: "{count} 件",
  upload_cancel: "キャンセル",
  upload_save: "保存",
  cancel: "キャンセル",
  save: "保存",
  stage_no_desc: "説明なし",
  stage_object_aria: "ステージオブジェクト {name}",
  stage_settings_suffix: "設定",
  restore_success: "YGデータベースをリストアしました。",
  restore_failed: "リストアに失敗しました。",

  settings_title: "YG 設定",
  settings_heading: "設定",
  language_label: "言語設定",
  language_auto: "ブラウザ設定に合わせる",
  language_ja: "日本語",
  language_en: "English",

  db_maint_title: "YG データメンテ",
  home: "ホーム",
  stage_select: "ステージ選択",
  backup: "⬇️ バックアップ",
  restore: "⬆️ リストア",
  table_label: "テーブル：",
  bulk_delete: "🗑️ 選択削除",
  clear_records: "🗑️ レコード全削除",
  delete_header: "削",
  select_header: "選",
  row_delete_title: "行削除",
  record_count: "{count}件",
  usage_text: "容量(概算): {size}",
  confirm_clear_table: "{table} の全レコードを削除しますか？",
  confirm_delete_row: "このレコードを削除しますか？ ({pk})",
  confirm_delete_selected: "選択中 {count} 件を削除しますか？",
  bulk_delete_with_count: "🗑️ 選択削除 ({count})",
};

const EN: Record<string, string> = {
  app_title: "Task Buster!",
  stage_map_alt: "Stage Selection Map",
  mode_toggle_aria: "Toggle view mode and edit mode",
  add_stage_aria: "Add stage",
  db_download_aria: "Download whole database",
  db_upload_aria: "Upload database backup",
  settings_aria: "Go to settings page",
  stage_settings_title: "Stage Settings",
  stage_settings_sub: "Edit stage status and basic information.",
  stage_tab_basic: "Basic",
  stage_tab_image: "Images",
  stage_progress_label: "Defeat Progress",
  hp_label: "HP",
  stage_name_label: "Name (nm)",
  stage_color_label: "Base Color",
  stage_desc_label: "Description (desc)",
  stage_image_label: "Stage Image",
  map_image_label: "Map Image",
  current_file_label: "Current:",
  pick_registered_image: "Pick from registered",
  image_picker_title: "Select from registered images",
  image_picker_filter_placeholder: "Filter by name (nm)",
  image_picker_ext_all: "Extension: all",
  image_picker_close: "Close",
  image_picker_empty: "No matching images",
  image_picker_count: "{count} items",
  upload_cancel: "Clear",
  upload_save: "Save",
  cancel: "Cancel",
  save: "Save",
  stage_no_desc: "No description",
  stage_object_aria: "Stage object {name}",
  stage_settings_suffix: "Settings",
  restore_success: "YG database has been restored.",
  restore_failed: "Failed to restore backup.",

  settings_title: "YG Settings",
  settings_heading: "Settings",
  language_label: "Language",
  language_auto: "Use browser setting",
  language_ja: "Japanese",
  language_en: "English",

  db_maint_title: "YG Data Maintenance",
  home: "Home",
  stage_select: "Stage Select",
  backup: "⬇️ Backup",
  restore: "⬆️ Restore",
  table_label: "Table:",
  bulk_delete: "🗑️ Delete Selected",
  clear_records: "🗑️ Delete All Records",
  delete_header: "Del",
  select_header: "Sel",
  row_delete_title: "Delete row",
  record_count: "{count} records",
  usage_text: "Approx size: {size}",
  confirm_clear_table: "Delete all records in {table}?",
  confirm_delete_row: "Delete this record? ({pk})",
  confirm_delete_selected: "Delete {count} selected records?",
  bulk_delete_with_count: "🗑️ Delete Selected ({count})",
};

const LANG_PREF_KEY = "yg.lang";

function readLangPreference(): LangPref {
  try {
    const raw = String(
      localStorage.getItem(LANG_PREF_KEY) || "auto",
    ).toLowerCase();
    if (raw === "ja" || raw === "en") {
      return raw;
    }
  } catch {
    // noop: fallback to browser language
  }
  return "auto";
}

function detectLangByBrowser(): Lang {
  const languages = [
    ...(navigator.languages || []),
    navigator.language || "",
    (navigator as { userLanguage?: string }).userLanguage || "",
  ];

  for (const lang of languages) {
    const norm = String(lang).toLowerCase();
    if (norm.startsWith("ja")) {
      return "ja";
    }
  }
  return "en";
}

const langPref: LangPref = readLangPreference();
const currentLang: Lang =
  langPref === "auto" ? detectLangByBrowser() : langPref;
const dict = currentLang === "ja" ? JA : EN;

export function getLang(): Lang {
  return currentLang;
}

export function getLangPreference(): LangPref {
  return langPref;
}

export function setLangPreference(lang: LangPref): void {
  try {
    if (lang === "auto") {
      localStorage.removeItem(LANG_PREF_KEY);
      return;
    }
    localStorage.setItem(LANG_PREF_KEY, lang);
  } catch {
    // noop: keep runtime behavior without persistence
  }
}

export function t(key: string, vars?: Vars): string {
  const template = dict[key] || JA[key] || key;
  if (!vars) {
    return template;
  }

  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, name: string) => {
    if (!Object.prototype.hasOwnProperty.call(vars, name)) {
      return `{${name}}`;
    }
    return String(vars[name]);
  });
}

export function applyI18n(root: ParentNode = document): void {
  document.documentElement.lang = currentLang;

  const textNodes = root.querySelectorAll<HTMLElement>("[data-i18n]");
  for (const el of textNodes) {
    const key = el.dataset.i18n;
    if (!key) {
      continue;
    }
    el.textContent = t(key);
  }

  const ariaNodes = root.querySelectorAll<HTMLElement>(
    "[data-i18n-aria-label]",
  );
  for (const el of ariaNodes) {
    const key = el.dataset.i18nAriaLabel;
    if (!key) {
      continue;
    }
    el.setAttribute("aria-label", t(key));
  }

  const titleNodes = root.querySelectorAll<HTMLElement>("[data-i18n-title]");
  for (const el of titleNodes) {
    const key = el.dataset.i18nTitle;
    if (!key) {
      continue;
    }
    el.setAttribute("title", t(key));
  }

  const placeholderNodes = root.querySelectorAll<HTMLElement>(
    "[data-i18n-placeholder]",
  );
  for (const el of placeholderNodes) {
    const key = el.dataset.i18nPlaceholder;
    if (!key) {
      continue;
    }
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      el.placeholder = t(key);
    }
  }

  const valueNodes = root.querySelectorAll<HTMLElement>("[data-i18n-value]");
  for (const el of valueNodes) {
    const key = el.dataset.i18nValue;
    if (!key) {
      continue;
    }
    if (el instanceof HTMLInputElement || el instanceof HTMLButtonElement) {
      el.value = t(key);
    }
  }

  const altNodes = root.querySelectorAll<HTMLElement>("[data-i18n-alt]");
  for (const el of altNodes) {
    const key = el.dataset.i18nAlt;
    if (!key) {
      continue;
    }
    if (el instanceof HTMLImageElement) {
      el.alt = t(key);
    }
  }

  const titleEl = document.querySelector("title[data-i18n-title]");
  if (titleEl instanceof HTMLTitleElement) {
    const key = titleEl.dataset.i18nTitle;
    if (key) {
      titleEl.textContent = t(key);
    }
  }
}
