import { FolderHeart, HardDrive, Settings, Usb } from "lucide-react";
import { useEffect, useRef } from "react";
import { useI18n } from "../i18n";
import type { FavoriteFolder, RootEntry } from "../types";

interface DriveRailProps {
  roots: RootEntry[];
  favorites: FavoriteFolder[];
  currentPath: string;
  selectedIndex: number;
  focused: boolean;
  settingsActive: boolean;
  onSelectIndex: (index: number) => void;
  onSelectPath: (path: string) => void;
  onOpenSettings: () => void;
}

export function DriveRail({
  roots,
  favorites,
  currentPath,
  selectedIndex,
  focused,
  settingsActive,
  onSelectIndex,
  onSelectPath,
  onOpenSettings,
}: DriveRailProps) {
  const { t } = useI18n();
  const selectedRef = useRef<HTMLButtonElement>(null);
  const settingsIndex = roots.length + favorites.length;

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const driveName = (root: RootEntry) => {
    if (root.path === "/") return t("nav.fileSystem");
    const drive = root.path.replace(/[\\/]+$/, "");
    return t(root.rootType === "removable" ? "nav.removableDisk" : "nav.localDisk", { drive });
  };

  return (
    <aside className={focused ? "drive-rail focused" : "drive-rail"} aria-label={t("nav.drives")}>
      <div className="rail-section">
        <div className="rail-title">{t("nav.drives")}</div>
        <nav>
        {roots.map((root) => {
          const index = roots.indexOf(root);
          const active = currentPath.toLowerCase().startsWith(root.path.toLowerCase());
          const Icon = root.rootType === "removable" ? Usb : HardDrive;
          return (
            <button
              type="button"
              className={`${active ? "drive-item active" : "drive-item"}${focused && selectedIndex === index ? " focused" : ""}`}
              key={root.path}
              ref={selectedIndex === index ? selectedRef : undefined}
              onMouseEnter={() => onSelectIndex(index)}
              onFocus={() => onSelectIndex(index)}
              onClick={() => onSelectPath(root.path)}
              title={root.path}
            >
              <Icon aria-hidden="true" />
              <span>{driveName(root)}</span>
            </button>
          );
        })}
        </nav>
      </div>

      <div className="rail-section favorites-section">
        <div className="rail-title">{t("nav.favorites")}</div>
        <nav>
          {favorites.length === 0 ? (
            <div className="rail-empty">{t("nav.noFavorites")}</div>
          ) : favorites.map((favorite, favoriteIndex) => {
            const index = roots.length + favoriteIndex;
            const active = currentPath.toLowerCase() === favorite.path.toLowerCase();
            return (
              <button
                type="button"
                className={`${active ? "drive-item active" : "drive-item"}${focused && selectedIndex === index ? " focused" : ""}`}
                key={favorite.path}
                ref={selectedIndex === index ? selectedRef : undefined}
                onMouseEnter={() => onSelectIndex(index)}
                onFocus={() => onSelectIndex(index)}
                onClick={() => onSelectPath(favorite.path)}
                title={favorite.path}
              >
                <FolderHeart aria-hidden="true" />
                <span>{favorite.name}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <button
        type="button"
        className={`${settingsActive ? "drive-item settings-item active" : "drive-item settings-item"}${focused && selectedIndex === settingsIndex ? " focused" : ""}`}
        ref={selectedIndex === settingsIndex ? selectedRef : undefined}
        onMouseEnter={() => onSelectIndex(settingsIndex)}
        onFocus={() => onSelectIndex(settingsIndex)}
        onClick={onOpenSettings}
      >
        <Settings aria-hidden="true" />
        <span>{t("nav.settings")}</span>
      </button>
    </aside>
  );
}
