import { AppWindow, FolderHeart, HardDrive, LogOut, Plus, Power, Settings, ShieldCheck, Trash2, Usb } from "lucide-react";
import { useEffect, useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { useI18n } from "../i18n";
import type { ApplicationShortcut, FavoriteFolder, RootEntry, SystemAction } from "../types";

interface DriveRailProps {
  roots: RootEntry[];
  favorites: FavoriteFolder[];
  applications: ApplicationShortcut[];
  currentPath: string;
  selectedIndex: number;
  focused: boolean;
  settingsActive: boolean;
  systemHoldAction: SystemAction | null;
  systemHoldProgress: number;
  onSelectIndex: (index: number) => void;
  onSelectPath: (path: string) => void;
  onRemoveFavorite: (path: string) => void;
  onLaunchApplication: (application: ApplicationShortcut) => void;
  onRemoveApplication: (path: string) => void;
  onBindApplication: () => void;
  onOpenSettings: () => void;
  onSystemHoldStart: (action: SystemAction) => void;
  onSystemHoldCancel: () => void;
}

export function DriveRail({
  roots,
  favorites,
  applications,
  currentPath,
  selectedIndex,
  focused,
  settingsActive,
  systemHoldAction,
  systemHoldProgress,
  onSelectIndex,
  onSelectPath,
  onRemoveFavorite,
  onLaunchApplication,
  onRemoveApplication,
  onBindApplication,
  onOpenSettings,
  onSystemHoldStart,
  onSystemHoldCancel,
}: DriveRailProps) {
  const { t } = useI18n();
  const selectedRef = useRef<HTMLButtonElement>(null);
  const applicationStartIndex = roots.length + favorites.length;
  const bindApplicationIndex = applicationStartIndex + applications.length;
  const settingsIndex = bindApplicationIndex + 1;
  const exitIndex = settingsIndex + 1;
  const shutdownIndex = settingsIndex + 2;

  const holdStyle = (action: SystemAction) => ({
    "--hold-progress": systemHoldAction === action ? systemHoldProgress : 0,
  }) as CSSProperties;

  const startPointerHold = (
    event: ReactPointerEvent<HTMLButtonElement>,
    action: SystemAction,
    index: number,
  ) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    onSelectIndex(index);
    onSystemHoldStart(action);
  };

  const cancelPointerHold = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    onSystemHoldCancel();
  };

  const cancelPointerHoldOnLeave = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.buttons !== 0) cancelPointerHold(event);
  };

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
      <div className="rail-content">
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
              <div className="favorite-entry" key={favorite.path}>
                <button
                  type="button"
                  className={`${active ? "drive-item active" : "drive-item"}${focused && selectedIndex === index ? " focused" : ""}`}
                  ref={selectedIndex === index ? selectedRef : undefined}
                  onMouseEnter={() => onSelectIndex(index)}
                  onFocus={() => onSelectIndex(index)}
                  onClick={() => onSelectPath(favorite.path)}
                  title={favorite.path}
                >
                  <FolderHeart aria-hidden="true" />
                  <span>{favorite.name}</span>
                </button>
                <button
                  type="button"
                  className="favorite-remove"
                  onMouseEnter={() => onSelectIndex(index)}
                  onFocus={() => onSelectIndex(index)}
                  onClick={() => onRemoveFavorite(favorite.path)}
                  title={t("nav.removeFavorite")}
                  aria-label={`${t("nav.removeFavorite")}：${favorite.name}`}
                >
                  <Trash2 aria-hidden="true" />
                </button>
              </div>
            );
          })}
        </nav>
        </div>

        <div className="rail-section applications-section">
          <div className="rail-title">{t("nav.applications")}</div>
          <nav>
            {applications.map((application, applicationIndex) => {
              const index = applicationStartIndex + applicationIndex;
              return (
                <div className="favorite-entry application-entry" key={application.path}>
                  <button
                    type="button"
                    className={`drive-item application-item${application.runAsAdministrator ? " administrator" : ""}${focused && selectedIndex === index ? " focused" : ""}`}
                    ref={selectedIndex === index ? selectedRef : undefined}
                    onMouseEnter={() => onSelectIndex(index)}
                    onFocus={() => onSelectIndex(index)}
                    onClick={() => onLaunchApplication(application)}
                    title={application.runAsAdministrator ? `${application.path}\n${t("nav.runAsAdministrator")}` : application.path}
                  >
                    <AppWindow aria-hidden="true" />
                    <span>{application.name}</span>
                    {application.runAsAdministrator && <ShieldCheck className="application-admin-mark" aria-label={t("nav.runAsAdministrator")} />}
                  </button>
                  <button
                    type="button"
                    className="favorite-remove"
                    onMouseEnter={() => onSelectIndex(index)}
                    onFocus={() => onSelectIndex(index)}
                    onClick={() => onRemoveApplication(application.path)}
                    title={t("nav.removeApplication")}
                    aria-label={`${t("nav.removeApplication")}：${application.name}`}
                  >
                    <Trash2 aria-hidden="true" />
                  </button>
                </div>
              );
            })}
            <button
              type="button"
              className={`drive-item bind-application-item${focused && selectedIndex === bindApplicationIndex ? " focused" : ""}`}
              ref={selectedIndex === bindApplicationIndex ? selectedRef : undefined}
              onMouseEnter={() => onSelectIndex(bindApplicationIndex)}
              onFocus={() => onSelectIndex(bindApplicationIndex)}
              onClick={onBindApplication}
            >
              <Plus aria-hidden="true" />
              <span>{t("nav.bindApplication")}</span>
            </button>
          </nav>
        </div>
      </div>

      <div className="rail-actions">
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

        <button
          type="button"
          className={`drive-item system-action-item exit${focused && selectedIndex === exitIndex ? " focused" : ""}${systemHoldAction === "exit" ? " holding" : ""}`}
          ref={selectedIndex === exitIndex ? selectedRef : undefined}
          style={holdStyle("exit")}
          onMouseEnter={() => onSelectIndex(exitIndex)}
          onFocus={() => onSelectIndex(exitIndex)}
          onPointerDown={(event) => startPointerHold(event, "exit", exitIndex)}
          onPointerUp={cancelPointerHold}
          onPointerCancel={cancelPointerHold}
          onPointerLeave={cancelPointerHoldOnLeave}
          onLostPointerCapture={onSystemHoldCancel}
          onContextMenu={(event) => event.preventDefault()}
          title={t("nav.exitApplicationHint")}
          aria-label={t("nav.exitApplicationHint")}
        >
          <LogOut aria-hidden="true" />
          <span>{t("nav.exitApplication")}</span>
        </button>

        <button
          type="button"
          className={`drive-item system-action-item shutdown${focused && selectedIndex === shutdownIndex ? " focused" : ""}${systemHoldAction === "shutdown" ? " holding" : ""}`}
          ref={selectedIndex === shutdownIndex ? selectedRef : undefined}
          style={holdStyle("shutdown")}
          onMouseEnter={() => onSelectIndex(shutdownIndex)}
          onFocus={() => onSelectIndex(shutdownIndex)}
          onPointerDown={(event) => startPointerHold(event, "shutdown", shutdownIndex)}
          onPointerUp={cancelPointerHold}
          onPointerCancel={cancelPointerHold}
          onPointerLeave={cancelPointerHoldOnLeave}
          onLostPointerCapture={onSystemHoldCancel}
          onContextMenu={(event) => event.preventDefault()}
          title={t("nav.shutdownSystemHint")}
          aria-label={t("nav.shutdownSystemHint")}
        >
          <Power aria-hidden="true" />
          <span>{t("nav.shutdownSystem")}</span>
        </button>
      </div>
    </aside>
  );
}
