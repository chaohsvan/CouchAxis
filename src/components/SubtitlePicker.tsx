import {
  Captions,
  CaptionsOff,
  FileText,
  Folder,
  FolderOpen,
  LoaderCircle,
  RefreshCw,
  Undo2,
  X,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { displayPath } from "../lib/format";
import { useI18n } from "../i18n";

export interface SubtitlePickerItem {
  name: string;
  path: string;
  kind: "none" | "parent" | "folder" | "subtitle";
  extension: string | null;
}

interface SubtitlePickerProps {
  path: string;
  items: SubtitlePickerItem[];
  selectedIndex: number;
  loading: boolean;
  error: string;
  onSelect: (index: number) => void;
  onActivate: (item: SubtitlePickerItem) => void;
  onClose: () => void;
  onRetry: () => void;
}

export function SubtitlePicker({
  path,
  items,
  selectedIndex,
  loading,
  error,
  onSelect,
  onActivate,
  onClose,
  onRetry,
}: SubtitlePickerProps) {
  const { t } = useI18n();
  const selectedRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  return (
    <section className="subtitle-picker" aria-label={t("subtitle.title")}>
      <header className="subtitle-picker-header">
        <div className="subtitle-picker-title">
          <span className="subtitle-picker-mark"><Captions aria-hidden="true" /></span>
          <div>
            <span>{t("subtitle.title")}</span>
            <h2 title={path}>{displayPath(path)}</h2>
          </div>
        </div>
        <button type="button" className="icon-button" onClick={onClose} title={t("subtitle.close")}><X aria-hidden="true" /></button>
      </header>

      <div className="subtitle-picker-content">
        {loading ? (
          <div className="center-state"><LoaderCircle className="spin" aria-hidden="true" /><span>{t("common.loading")}</span></div>
        ) : error ? (
          <div className="error-state">
            <strong>{t("browser.openFailed")}</strong>
            <span>{error}</span>
            <button type="button" onClick={onRetry}><RefreshCw aria-hidden="true" />{t("common.retry")}</button>
          </div>
        ) : items.length === 0 ? (
          <div className="center-state"><FolderOpen aria-hidden="true" /><span>{t("subtitle.empty")}</span></div>
        ) : (
          <div className="subtitle-list" role="listbox" aria-label={t("subtitle.files")}>
            {items.map((item, index) => {
              const selected = selectedIndex === index;
              const Icon = item.kind === "none" ? CaptionsOff : item.kind === "parent" ? Undo2 : item.kind === "folder" ? Folder : FileText;
              return (
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={selected ? `subtitle-row ${item.kind} selected` : `subtitle-row ${item.kind}`}
                  key={`${item.kind}:${item.path}`}
                  ref={selected ? selectedRef : undefined}
                  onMouseEnter={() => onSelect(index)}
                  onFocus={() => onSelect(index)}
                  onClick={() => onActivate(item)}
                >
                  <span className="subtitle-entry-icon"><Icon aria-hidden="true" /></span>
                  <span className="subtitle-entry-copy">
                    <strong>{item.name}</strong>
                    <small>{item.kind === "none" ? t("subtitle.noneHint") : item.kind === "parent" ? t("common.directory") : item.kind === "folder" ? t("common.folder") : item.extension}</small>
                  </span>
                  {item.kind === "subtitle" && <Captions className="subtitle-type-icon" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <footer className="subtitle-picker-footer">
        <span>{t("subtitle.count", { count: items.filter((item) => item.kind === "subtitle").length })}</span>
        <span>SRT / ASS / SSA</span>
      </footer>
    </section>
  );
}
