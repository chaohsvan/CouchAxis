import { ArrowUpLeft, ArrowUpRight, BookOpen, Captions, ChevronLeft, Eye, EyeOff, FolderOpen, Languages, Rocket, Settings2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { useI18n } from "../i18n";
import { displayPath } from "../lib/format";
import type { AppLanguage, AppPreferences, MangaStartSide, StartupView, SubtitleFontSize } from "../types";

interface SettingsPanelProps {
  preferences: AppPreferences;
  selectedRow: number;
  saveState: "idle" | "saving" | "saved" | "error";
  onSelectRow: (row: number) => void;
  onStartupViewChange: (view: StartupView) => void;
  onShowHiddenFilesChange: (show: boolean) => void;
  onLanguageChange: (language: AppLanguage) => void;
  onOpenScreenshotDirectory: () => void;
  onMangaStartSideChange: (side: MangaStartSide) => void;
  onSubtitleFontSizeChange: (size: SubtitleFontSize) => void;
  onClose: () => void;
}

export function SettingsPanel({
  preferences,
  selectedRow,
  saveState,
  onSelectRow,
  onStartupViewChange,
  onShowHiddenFilesChange,
  onLanguageChange,
  onOpenScreenshotDirectory,
  onMangaStartSideChange,
  onSubtitleFontSizeChange,
  onClose,
}: SettingsPanelProps) {
  const { t } = useI18n();
  const selectedRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest" });
  }, [selectedRow]);
  const status = saveState === "saving"
    ? t("settings.saving")
    : saveState === "error"
      ? t("settings.saveError")
      : t("settings.saved");

  return (
    <section className="settings-panel" aria-label={t("settings.title")}>
      <header className="settings-header">
        <button type="button" className="icon-button" onClick={onClose} title={t("common.back")}>
          <ChevronLeft aria-hidden="true" />
        </button>
        <span className="settings-mark"><Settings2 aria-hidden="true" /></span>
        <div>
          <span>{t("settings.subtitle")}</span>
          <h1>{t("settings.title")}</h1>
        </div>
        <small className={saveState === "error" ? "save-state error" : "save-state"}>{status}</small>
      </header>

      <div className="settings-list">
        <div
          ref={selectedRow === 0 ? selectedRef : undefined}
          className={selectedRow === 0 ? "setting-row selected" : "setting-row"}
          onMouseEnter={() => onSelectRow(0)}
        >
          <span className="setting-icon"><Rocket aria-hidden="true" /></span>
          <div className="setting-copy"><strong>{t("settings.startup")}</strong></div>
          <div className="segmented-control" role="radiogroup" aria-label={t("settings.startup")}>
            {([
              ["lastPath", t("settings.startup.lastPath")],
              ["drives", t("settings.startup.drives")],
              ["favorites", t("settings.startup.favorites")],
            ] as Array<[StartupView, string]>).map(([value, label]) => (
              <button
                type="button"
                role="radio"
                aria-checked={preferences.startupView === value}
                className={preferences.startupView === value ? "active" : ""}
                key={value}
                onFocus={() => onSelectRow(0)}
                onClick={() => onStartupViewChange(value)}
              >{label}</button>
            ))}
          </div>
        </div>

        <div
          ref={selectedRow === 1 ? selectedRef : undefined}
          className={selectedRow === 1 ? "setting-row selected" : "setting-row"}
          onMouseEnter={() => onSelectRow(1)}
        >
          <span className="setting-icon">{preferences.showHiddenFiles ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}</span>
          <div className="setting-copy"><strong>{t("settings.hidden")}</strong></div>
          <button
            type="button"
            role="switch"
            aria-checked={preferences.showHiddenFiles}
            className={preferences.showHiddenFiles ? "switch-control active" : "switch-control"}
            onFocus={() => onSelectRow(1)}
            onClick={() => onShowHiddenFilesChange(!preferences.showHiddenFiles)}
          >
            <span aria-hidden="true" />
            <b>{preferences.showHiddenFiles ? t("settings.hidden.on") : t("settings.hidden.off")}</b>
          </button>
        </div>

        <div
          ref={selectedRow === 2 ? selectedRef : undefined}
          className={selectedRow === 2 ? "setting-row selected" : "setting-row"}
          onMouseEnter={() => onSelectRow(2)}
        >
          <span className="setting-icon"><Languages aria-hidden="true" /></span>
          <div className="setting-copy"><strong>{t("settings.language")}</strong></div>
          <div className="segmented-control compact" role="radiogroup" aria-label={t("settings.language")}>
            {([
              ["zh-CN", t("settings.language.zh")],
              ["en-US", t("settings.language.en")],
            ] as Array<[AppLanguage, string]>).map(([value, label]) => (
              <button
                type="button"
                role="radio"
                aria-checked={preferences.language === value}
                className={preferences.language === value ? "active" : ""}
                key={value}
                onFocus={() => onSelectRow(2)}
                onClick={() => onLanguageChange(value)}
              >{label}</button>
            ))}
          </div>
        </div>

        <div
          ref={selectedRow === 3 ? selectedRef : undefined}
          className={selectedRow === 3 ? "setting-row selected" : "setting-row"}
          onMouseEnter={() => onSelectRow(3)}
        >
          <span className="setting-icon"><FolderOpen aria-hidden="true" /></span>
          <div className="setting-copy">
            <strong>{t("settings.screenshotDirectory")}</strong>
            <small title={preferences.screenshotDirectory}>{displayPath(preferences.screenshotDirectory)}</small>
          </div>
          <button
            type="button"
            className="directory-control"
            onFocus={() => onSelectRow(3)}
            onClick={onOpenScreenshotDirectory}
          >
            <FolderOpen aria-hidden="true" />
            <span>{t("settings.chooseDirectory")}</span>
          </button>
        </div>

        <div
          ref={selectedRow === 4 ? selectedRef : undefined}
          className={selectedRow === 4 ? "setting-row selected" : "setting-row"}
          onMouseEnter={() => onSelectRow(4)}
        >
          <span className="setting-icon"><BookOpen aria-hidden="true" /></span>
          <div className="setting-copy">
            <strong>{t("settings.mangaStartSide")}</strong>
            <small>{t("settings.mangaStartHint")}</small>
          </div>
          <div className="segmented-control compact" role="radiogroup" aria-label={t("settings.mangaStartSide")}>
            {([
              ["left", t("settings.mangaStartLeft"), ArrowUpLeft],
              ["right", t("settings.mangaStartRight"), ArrowUpRight],
            ] as const).map(([value, label, Icon]) => (
              <button
                type="button"
                role="radio"
                aria-checked={preferences.mangaStartSide === value}
                className={preferences.mangaStartSide === value ? "active" : ""}
                key={value}
                onFocus={() => onSelectRow(4)}
                onClick={() => onMangaStartSideChange(value)}
              ><Icon aria-hidden="true" /><span>{label}</span></button>
            ))}
          </div>
        </div>

        <div
          ref={selectedRow === 5 ? selectedRef : undefined}
          className={selectedRow === 5 ? "setting-row selected" : "setting-row"}
          onMouseEnter={() => onSelectRow(5)}
        >
          <span className="setting-icon"><Captions aria-hidden="true" /></span>
          <div className="setting-copy"><strong>{t("settings.subtitleFontSize")}</strong></div>
          <div className="segmented-control compact" role="radiogroup" aria-label={t("settings.subtitleFontSize")}>
            {([
              ["small", t("settings.subtitleFontSize.small")],
              ["medium", t("settings.subtitleFontSize.medium")],
              ["large", t("settings.subtitleFontSize.large")],
            ] as Array<[SubtitleFontSize, string]>).map(([value, label]) => (
              <button
                type="button"
                role="radio"
                aria-checked={preferences.subtitleFontSize === value}
                className={preferences.subtitleFontSize === value ? "active" : ""}
                key={value}
                onFocus={() => onSelectRow(5)}
                onClick={() => onSubtitleFontSizeChange(value)}
              >{label}</button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
