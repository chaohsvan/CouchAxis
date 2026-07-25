import { Film, Folder, FolderOpen, Image, LoaderCircle, Music2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { useI18n } from "../i18n";
import { formatBytes } from "../lib/format";
import type { BrowserViewMode, FileEntry } from "../types";

interface FileListProps {
  entries: FileEntry[];
  loading: boolean;
  viewMode: BrowserViewMode;
  selectedIndex: number;
  onSelect: (index: number) => void;
  onOpen: (entry: FileEntry) => void;
  onGridColumnsChange: (columns: number) => void;
}

export function FileList({
  entries,
  loading,
  viewMode,
  selectedIndex,
  onSelect,
  onOpen,
  onGridColumnsChange,
}: FileListProps) {
  const { t } = useI18n();
  const selectedRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const selectedEntryPath = entries[selectedIndex]?.path;

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest" });
  }, [selectedEntryPath, selectedIndex, viewMode]);

  useEffect(() => {
    if (viewMode !== "grid" || !listRef.current) {
      onGridColumnsChange(1);
      return;
    }
    const list = listRef.current;
    const updateColumns = () => {
      const columns = window.getComputedStyle(list).gridTemplateColumns.split(" ").filter(Boolean).length;
      onGridColumnsChange(Math.max(1, columns));
    };
    updateColumns();
    const observer = new ResizeObserver(updateColumns);
    observer.observe(list);
    return () => observer.disconnect();
  }, [entries.length, loading, onGridColumnsChange, viewMode]);

  if (loading) {
    return <div className="center-state"><LoaderCircle className="spin" aria-hidden="true" /><span>{t("common.loading")}</span></div>;
  }
  if (entries.length === 0) {
    return <div className="center-state"><FolderOpen aria-hidden="true" /><span>{t("browser.empty")}</span></div>;
  }

  return (
    <div ref={listRef} className={`file-list ${viewMode}`} role="listbox" aria-label={t("browser.files")}>
      {entries.map((entry, index) => {
        const selected = index === selectedIndex;
        const Icon = entry.kind === "folder" ? Folder : entry.kind === "audio" ? Music2 : entry.kind === "image" ? Image : Film;
        return (
          <button
            type="button"
            role="option"
            aria-selected={selected}
            className={selected ? "file-row selected" : "file-row"}
            key={entry.path}
            ref={selected ? selectedRef : undefined}
            onMouseEnter={() => onSelect(index)}
            onFocus={() => onSelect(index)}
            onClick={() => onOpen(entry)}
          >
            <span className={`entry-icon ${entry.kind}`}><Icon aria-hidden="true" /></span>
            <span className="entry-copy">
              <strong>{entry.name}</strong>
              <small>
                <span>{entry.kind === "folder" ? t("common.folder") : entry.extension ?? ({ video: t("common.video"), audio: t("common.audio"), image: t("common.image") }[entry.kind])}</span>
                {entry.kind !== "folder" && <span className="entry-inline-size">{formatBytes(entry.size)}</span>}
              </small>
            </span>
            {entry.kind !== "folder" && <span className="entry-size">{formatBytes(entry.size)}</span>}
          </button>
        );
      })}
    </div>
  );
}
