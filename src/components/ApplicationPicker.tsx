import { AppWindow, ChevronLeft, Folder, HardDrive, LoaderCircle, RefreshCw, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { useI18n } from "../i18n";
import { displayPath } from "../lib/format";

export interface ApplicationPickerItem {
  name: string;
  path: string;
  kind: "root" | "folder" | "application";
}

interface ApplicationPickerProps {
  path: string;
  items: ApplicationPickerItem[];
  selectedIndex: number;
  loading: boolean;
  error: string;
  onSelect: (index: number) => void;
  onActivate: (item: ApplicationPickerItem) => void;
  onBack: () => void;
  onClose: () => void;
  onRetry: () => void;
}

export function ApplicationPicker({
  path,
  items,
  selectedIndex,
  loading,
  error,
  onSelect,
  onActivate,
  onBack,
  onClose,
  onRetry,
}: ApplicationPickerProps) {
  const { t } = useI18n();
  const selectedRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  return (
    <section className="folder-picker application-picker" aria-label={t("applicationPicker.title")}>
      <header className="folder-picker-header">
        <div className="folder-picker-title">
          <button type="button" className="icon-button" onClick={onBack} title={t("common.back")}><ChevronLeft aria-hidden="true" /></button>
          <span className="folder-picker-mark"><AppWindow aria-hidden="true" /></span>
          <div>
            <span>{t("applicationPicker.title")}</span>
            <h2 title={path}>{path ? displayPath(path) : t("applicationPicker.drives")}</h2>
          </div>
        </div>
        <button type="button" className="icon-button" onClick={onClose} title={t("common.close")}><X aria-hidden="true" /></button>
      </header>

      <div className="folder-picker-content">
        {loading ? (
          <div className="center-state"><LoaderCircle className="spin" aria-hidden="true" /><span>{t("common.loading")}</span></div>
        ) : error ? (
          <div className="error-state">
            <strong>{t("browser.openFailed")}</strong>
            <span>{error}</span>
            <button type="button" onClick={onRetry}><RefreshCw aria-hidden="true" />{t("common.retry")}</button>
          </div>
        ) : items.length === 0 ? (
          <div className="center-state"><AppWindow aria-hidden="true" /><span>{t("applicationPicker.empty")}</span></div>
        ) : (
          <div className="folder-picker-list" role="listbox" aria-label={t("applicationPicker.items")}>
            {items.map((item, index) => {
              const selected = selectedIndex === index;
              const Icon = item.kind === "root" ? HardDrive : item.kind === "folder" ? Folder : AppWindow;
              return (
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={selected ? `folder-picker-row ${item.kind} selected` : `folder-picker-row ${item.kind}`}
                  key={`${item.kind}:${item.path}`}
                  ref={selected ? selectedRef : undefined}
                  onMouseEnter={() => onSelect(index)}
                  onFocus={() => onSelect(index)}
                  onClick={() => onActivate(item)}
                >
                  <span className="folder-picker-entry-icon"><Icon aria-hidden="true" /></span>
                  <span className="folder-picker-entry-copy">
                    <strong>{item.name}</strong>
                    <small>{item.kind === "application" ? t("applicationPicker.application") : item.kind === "root" ? t("nav.fileSystem") : t("common.folder")}</small>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <footer className="folder-picker-footer">
        <span>{t("applicationPicker.footer")}</span>
      </footer>
    </section>
  );
}
