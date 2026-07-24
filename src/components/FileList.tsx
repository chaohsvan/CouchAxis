import { Film, Folder, FolderOpen, Image, LoaderCircle, Music2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { useI18n } from "../i18n";
import { formatBytes } from "../lib/format";
import type { FileEntry } from "../types";

interface FileListProps {
  entries: FileEntry[];
  loading: boolean;
  selectedIndex: number;
  onSelect: (index: number) => void;
  onOpen: (entry: FileEntry) => void;
}

export function FileList({ entries, loading, selectedIndex, onSelect, onOpen }: FileListProps) {
  const { t } = useI18n();
  const selectedRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (loading) {
    return <div className="center-state"><LoaderCircle className="spin" aria-hidden="true" /><span>{t("common.loading")}</span></div>;
  }
  if (entries.length === 0) {
    return <div className="center-state"><FolderOpen aria-hidden="true" /><span>{t("browser.empty")}</span></div>;
  }

  return (
    <div className="file-list" role="listbox" aria-label={t("browser.files")}>
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
              <small>{entry.kind === "folder" ? t("common.folder") : entry.extension ?? ({ video: t("common.video"), audio: t("common.audio"), image: t("common.image") }[entry.kind])}</small>
            </span>
            {entry.kind !== "folder" && <span className="entry-size">{formatBytes(entry.size)}</span>}
          </button>
        );
      })}
    </div>
  );
}
