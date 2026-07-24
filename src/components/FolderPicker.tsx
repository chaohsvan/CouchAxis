import { Check, ChevronLeft, Folder, FolderOpen, HardDrive, LoaderCircle, RefreshCw, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { useI18n } from "../i18n";
import { displayPath } from "../lib/format";

export interface FolderPickerItem {
  name: string;
  path: string;
  kind: "select" | "root" | "folder";
}

interface FolderPickerProps {
  path: string;
  items: FolderPickerItem[];
  selectedIndex: number;
  loading: boolean;
  error: string;
  onSelect: (index: number) => void;
  onActivate: (item: FolderPickerItem) => void;
  onBack: () => void;
  onClose: () => void;
  onRetry: () => void;
}

export function FolderPicker({
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
}: FolderPickerProps) {
  const { t } = useI18n();
  const selectedRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  return (
    <section className="folder-picker" aria-label={t("folderPicker.title")}>
      <header className="folder-picker-header">
        <div className="folder-picker-title">
          <button type="button" className="icon-button" onClick={onBack} title={t("common.back")}><ChevronLeft aria-hidden="true" /></button>
          <span className="folder-picker-mark"><FolderOpen aria-hidden="true" /></span>
          <div>
            <span>{t("folderPicker.title")}</span>
            <h2 title={path}>{path ? displayPath(path) : t("folderPicker.drives")}</h2>
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
          <div className="center-state"><HardDrive aria-hidden="true" /><span>{t("app.noDrives")}</span></div>
        ) : (
          <div className="folder-picker-list" role="listbox" aria-label={t("folderPicker.folders")}>
            {items.map((item, index) => {
              const selected = selectedIndex === index;
              const Icon = item.kind === "select" ? Check : item.kind === "root" ? HardDrive : Folder;
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
                    <small>{item.kind === "select" ? t("folderPicker.current") : item.kind === "root" ? t("nav.fileSystem") : t("common.folder")}</small>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <footer className="folder-picker-footer">
        <span>{t("folderPicker.footer")}</span>
      </footer>
    </section>
  );
}
