import { ChevronLeft, Gamepad2, LayoutGrid, List, Monitor, RefreshCw, Star, WifiOff } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Brand } from "./components/Brand";
import { ApplicationPicker, type ApplicationPickerItem } from "./components/ApplicationPicker";
import { ControllerHelpOverlay } from "./components/ControllerHelpOverlay";
import { DriveRail } from "./components/DriveRail";
import { FileList } from "./components/FileList";
import { FolderPicker, type FolderPickerItem } from "./components/FolderPicker";
import { AudioPlayer, type AudioPlayerHandle } from "./components/AudioPlayer";
import { ImageViewer, type ImageViewerHandle } from "./components/ImageViewer";
import { Player, type PlayerHandle } from "./components/Player";
import { SubtitlePicker, type SubtitlePickerItem } from "./components/SubtitlePicker";
import { SettingsPanel } from "./components/SettingsPanel";
import { useGamepad } from "./hooks/useGamepad";
import { useKeyboard } from "./hooks/useKeyboard";
import { I18nProvider, translate } from "./i18n";
import { displayPath } from "./lib/format";
import { holdProgress } from "./lib/holdAction";
import { bindApplicationShortcut, removeApplicationShortcut } from "./lib/applicationShortcuts";
import { directoryName } from "./lib/paths";
import type { ControllerHelpContext } from "./lib/controllerHelp";
import { parseSubtitles } from "./lib/subtitles";
import { resumablePosition, updateRecentVideoProgress } from "./lib/videoProgress";
import {
  DEFAULT_PREFERENCES,
  configureElevatedApplication,
  exitApplication,
  findMatchingSubtitle,
  getLastPath,
  getPreferences,
  isAppFullscreen,
  launchApplication,
  listApplicationDirectory,
  listAudioQueue,
  listDirectory,
  listRoots,
  listSubtitleDirectory,
  readAudioMetadata,
  readSubtitle,
  removeElevatedApplication,
  saveLastPath,
  savePreferences,
  setAppFullscreen,
  shutdownSystem,
  mediaSource,
} from "./services/desktop";
import type {
  AppAction,
  AppLanguage,
  AppPreferences,
  ApplicationDirectoryListing,
  ApplicationShortcut,
  AudioMetadata,
  AudioPlaybackMode,
  BrowserViewMode,
  DirectoryListing,
  FileEntry,
  MangaStartSide,
  RootEntry,
  StartupView,
  SubtitleCue,
  SubtitleDirectoryListing,
  SubtitleFontSize,
  SystemAction,
} from "./types";

const EMPTY_AUDIO_METADATA: AudioMetadata = {
  title: null,
  artist: null,
  album: null,
  lyrics: null,
  coverArt: null,
};

function folderName(path: string): string {
  const trimmed = path.replace(/[\\/]+$/, "");
  const name = trimmed.slice(Math.max(trimmed.lastIndexOf("\\"), trimmed.lastIndexOf("/")) + 1);
  return name || path;
}

export function App() {
  const [preferences, setPreferences] = useState<AppPreferences>(DEFAULT_PREFERENCES);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [controllerHelpOpen, setControllerHelpOpen] = useState(false);
  const [settingsSelectedRow, setSettingsSelectedRow] = useState(0);
  const [settingsSaveState, setSettingsSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const [folderPickerPath, setFolderPickerPath] = useState("");
  const [folderPickerListing, setFolderPickerListing] = useState<DirectoryListing | null>(null);
  const [folderPickerSelectedIndex, setFolderPickerSelectedIndex] = useState(0);
  const [folderPickerLoading, setFolderPickerLoading] = useState(false);
  const [folderPickerError, setFolderPickerError] = useState("");
  const [applicationPickerOpen, setApplicationPickerOpen] = useState(false);
  const [applicationPickerPath, setApplicationPickerPath] = useState("");
  const [applicationPickerListing, setApplicationPickerListing] = useState<ApplicationDirectoryListing | null>(null);
  const [applicationPickerSelectedIndex, setApplicationPickerSelectedIndex] = useState(0);
  const [applicationPickerLoading, setApplicationPickerLoading] = useState(false);
  const [applicationPickerError, setApplicationPickerError] = useState("");
  const [applicationPickerRunAsAdministrator, setApplicationPickerRunAsAdministrator] = useState(false);
  const [applicationPermissionPending, setApplicationPermissionPending] = useState(false);
  const [applicationLaunchError, setApplicationLaunchError] = useState("");
  const [browserRegion, setBrowserRegion] = useState<"navigation" | "files">("files");
  const [navigationIndex, setNavigationIndex] = useState(0);
  const [systemHoldAction, setSystemHoldAction] = useState<SystemAction | null>(null);
  const [systemHoldProgress, setSystemHoldProgress] = useState(0);
  const [roots, setRoots] = useState<RootEntry[]>([]);
  const [listing, setListing] = useState<DirectoryListing | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [browserGridColumns, setBrowserGridColumns] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [media, setMedia] = useState<FileEntry | null>(null);
  const [subtitleName, setSubtitleName] = useState("");
  const [subtitleCues, setSubtitleCues] = useState<SubtitleCue[]>([]);
  const [subtitlePickerOpen, setSubtitlePickerOpen] = useState(false);
  const [subtitlePath, setSubtitlePath] = useState("");
  const [subtitleListing, setSubtitleListing] = useState<SubtitleDirectoryListing | null>(null);
  const [subtitleSelectedIndex, setSubtitleSelectedIndex] = useState(0);
  const [subtitleLoading, setSubtitleLoading] = useState(false);
  const [subtitleError, setSubtitleError] = useState("");
  const [audioQueue, setAudioQueue] = useState<FileEntry[]>([]);
  const [audioQueueLoading, setAudioQueueLoading] = useState(false);
  const [audioMetadata, setAudioMetadata] = useState<AudioMetadata>(EMPTY_AUDIO_METADATA);
  const [audioMetadataLoading, setAudioMetadataLoading] = useState(false);
  const [audioMode, setAudioMode] = useState<AudioPlaybackMode>(() => {
    const saved = window.localStorage.getItem("couchaxis.audioMode");
    return saved === "shuffle" || saved === "repeatOne" ? saved : "sequence";
  });
  const playerRef = useRef<PlayerHandle>(null);
  const audioPlayerRef = useRef<AudioPlayerHandle>(null);
  const imageViewerRef = useRef<ImageViewerHandle>(null);
  const audioQueueRequestRef = useRef(0);
  const subtitleAutoRequestRef = useRef(0);
  const folderPickerRequestRef = useRef(0);
  const applicationPickerRequestRef = useRef(0);
  const applicationLaunchErrorTimerRef = useRef<number | null>(null);
  const systemHoldActionRef = useRef<SystemAction | null>(null);
  const systemHoldStartedAtRef = useRef(0);
  const systemHoldFrameRef = useRef<number | null>(null);
  const t = useCallback(
    (key: Parameters<typeof translate>[1], values?: Parameters<typeof translate>[2]) =>
      translate(preferences.language, key, values),
    [preferences.language],
  );

  const cancelSystemHold = useCallback(() => {
    if (systemHoldFrameRef.current !== null) cancelAnimationFrame(systemHoldFrameRef.current);
    systemHoldFrameRef.current = null;
    systemHoldActionRef.current = null;
    setSystemHoldAction(null);
    setSystemHoldProgress(0);
  }, []);

  const runSystemAction = useCallback(async (action: SystemAction) => {
    if (action === "exit") await exitApplication();
    else await shutdownSystem();
  }, []);

  const beginSystemHold = useCallback((action: SystemAction) => {
    if (systemHoldActionRef.current === action) return;
    cancelSystemHold();
    systemHoldActionRef.current = action;
    systemHoldStartedAtRef.current = performance.now();
    setSystemHoldAction(action);
    setSystemHoldProgress(0);

    const update = (currentTime: number) => {
      if (systemHoldActionRef.current !== action) return;
      const progress = holdProgress(systemHoldStartedAtRef.current, currentTime);
      setSystemHoldProgress(progress);
      if (progress < 1) {
        systemHoldFrameRef.current = requestAnimationFrame(update);
        return;
      }
      systemHoldFrameRef.current = null;
      systemHoldActionRef.current = null;
      void runSystemAction(action).catch(cancelSystemHold);
    };
    systemHoldFrameRef.current = requestAnimationFrame(update);
  }, [cancelSystemHold, runSystemAction]);

  useEffect(() => () => {
    if (systemHoldFrameRef.current !== null) cancelAnimationFrame(systemHoldFrameRef.current);
    if (applicationLaunchErrorTimerRef.current !== null) {
      window.clearTimeout(applicationLaunchErrorTimerRef.current);
    }
  }, []);

  const browseWithVisibility = useCallback(async (
    path: string,
    showHiddenFiles: boolean,
    preferredEntryPath?: string,
  ) => {
    setLoading(true);
    setError("");
    try {
      const result = await listDirectory(path, showHiddenFiles);
      setListing(result);
      const preferredIndex = preferredEntryPath
        ? result.entries.findIndex((entry) => entry.path.toLowerCase() === preferredEntryPath.toLowerCase())
        : -1;
      setSelectedIndex(preferredIndex >= 0 ? preferredIndex : 0);
      await saveLastPath(result.path);
    } catch (reason) {
      const failure = reason as { message?: string };
      setError(failure.message ?? String(reason));
    } finally {
      setLoading(false);
    }
  }, []);

  const browse = useCallback(
    (path: string, preferredEntryPath?: string) => browseWithVisibility(
      path,
      preferences.showHiddenFiles,
      preferredEntryPath,
    ),
    [browseWithVisibility, preferences.showHiddenFiles],
  );

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [availableRoots, lastPath, savedPreferences] = await Promise.all([
          listRoots(),
          getLastPath(),
          getPreferences(),
        ]);
        if (!active) return;
        setPreferences(savedPreferences);
        setPreferencesReady(true);
        setRoots(availableRoots);
        const favorite = savedPreferences.favoriteFolders[0];
        const initial = savedPreferences.startupView === "favorites" && favorite
          ? favorite.path
          : savedPreferences.startupView === "drives"
            ? availableRoots[0]?.path
            : lastPath ?? availableRoots[0]?.path;
        if (savedPreferences.startupView !== "lastPath") {
          setBrowserRegion("navigation");
          setNavigationIndex(savedPreferences.startupView === "favorites" && favorite ? availableRoots.length : 0);
        }
        if (initial) await browseWithVisibility(initial, savedPreferences.showHiddenFiles);
        else {
          setError(translate(savedPreferences.language, "app.noDrives"));
          setLoading(false);
        }
      } catch (reason) {
        if (!active) return;
        setError(String(reason));
        setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [browseWithVisibility]);

  useEffect(() => {
    if (!preferencesReady) return;
    setSettingsSaveState("saving");
    const timer = window.setTimeout(() => {
      void savePreferences(preferences)
        .then(() => setSettingsSaveState("saved"))
        .catch(() => setSettingsSaveState("error"));
    }, 120);
    return () => window.clearTimeout(timer);
  }, [preferences, preferencesReady]);

  const currentFolderIsFavorite = useMemo(
    () => Boolean(listing && preferences.favoriteFolders.some(
      (favorite) => favorite.path.toLowerCase() === listing.path.toLowerCase(),
    )),
    [listing, preferences.favoriteFolders],
  );

  const toggleCurrentFavorite = useCallback(() => {
    if (!listing) return;
    setPreferences((current) => {
      const exists = current.favoriteFolders.some(
        (favorite) => favorite.path.toLowerCase() === listing.path.toLowerCase(),
      );
      return {
        ...current,
        favoriteFolders: exists
          ? current.favoriteFolders.filter(
            (favorite) => favorite.path.toLowerCase() !== listing.path.toLowerCase(),
          )
          : [...current.favoriteFolders, { name: folderName(listing.path), path: listing.path }],
      };
    });
  }, [listing]);

  const removeFavorite = useCallback((path: string) => {
    setPreferences((current) => ({
      ...current,
      favoriteFolders: current.favoriteFolders.filter(
        (favorite) => favorite.path.toLowerCase() !== path.toLowerCase(),
      ),
    }));
  }, []);

  const updateStartupView = useCallback((startupView: StartupView) => {
    setPreferences((current) => ({ ...current, startupView }));
  }, []);

  const updateLanguage = useCallback((language: AppLanguage) => {
    setPreferences((current) => ({ ...current, language }));
  }, []);

  const updateMangaStartSide = useCallback((mangaStartSide: MangaStartSide) => {
    setPreferences((current) => ({ ...current, mangaStartSide }));
  }, []);

  const updateSubtitleFontSize = useCallback((subtitleFontSize: SubtitleFontSize) => {
    setPreferences((current) => ({ ...current, subtitleFontSize }));
  }, []);

  const updateBrowserViewMode = useCallback((browserViewMode: BrowserViewMode) => {
    setPreferences((current) => ({ ...current, browserViewMode }));
  }, []);

  const toggleBrowserViewMode = useCallback(() => {
    setPreferences((current) => ({
      ...current,
      browserViewMode: current.browserViewMode === "list" ? "grid" : "list",
    }));
  }, []);

  const updateShowHiddenFiles = useCallback((showHiddenFiles: boolean) => {
    setPreferences((current) => ({ ...current, showHiddenFiles }));
    if (listing) {
      void browseWithVisibility(listing.path, showHiddenFiles, listing.entries[selectedIndex]?.path);
    }
  }, [browseWithVisibility, listing, selectedIndex]);

  const browseScreenshotFolders = useCallback(async (path: string) => {
    const requestId = ++folderPickerRequestRef.current;
    setFolderPickerPath(path);
    setFolderPickerSelectedIndex(0);
    setFolderPickerError("");
    if (!path) {
      setFolderPickerListing(null);
      setFolderPickerLoading(false);
      return;
    }
    setFolderPickerLoading(true);
    try {
      const result = await listDirectory(path, preferences.showHiddenFiles);
      if (folderPickerRequestRef.current === requestId) setFolderPickerListing(result);
    } catch (reason) {
      if (folderPickerRequestRef.current !== requestId) return;
      const failure = reason as { message?: string };
      setFolderPickerListing(null);
      setFolderPickerError(failure.message ?? String(reason));
    } finally {
      if (folderPickerRequestRef.current === requestId) setFolderPickerLoading(false);
    }
  }, [preferences.showHiddenFiles]);

  const folderPickerItems = useMemo<FolderPickerItem[]>(() => {
    if (!folderPickerPath) {
      return roots.map((root) => ({ name: root.name, path: root.path, kind: "root" }));
    }
    if (!folderPickerListing) return [];
    return [
      { name: t("folderPicker.useCurrent"), path: folderPickerListing.path, kind: "select" },
      ...folderPickerListing.entries
        .filter((entry) => entry.kind === "folder")
        .map((entry) => ({ name: entry.name, path: entry.path, kind: "folder" as const })),
    ];
  }, [folderPickerListing, folderPickerPath, roots, t]);

  const openScreenshotDirectoryPicker = useCallback(() => {
    setFolderPickerOpen(true);
    const initialPath = preferences.screenshotDirectory || listing?.path || roots[0]?.path || "";
    void browseScreenshotFolders(initialPath);
  }, [browseScreenshotFolders, listing?.path, preferences.screenshotDirectory, roots]);

  const closeScreenshotDirectoryPicker = useCallback(() => {
    folderPickerRequestRef.current += 1;
    setFolderPickerOpen(false);
    setFolderPickerError("");
  }, []);

  const goBackInFolderPicker = useCallback(() => {
    if (!folderPickerPath) {
      closeScreenshotDirectoryPicker();
    } else if (folderPickerListing?.parent) {
      void browseScreenshotFolders(folderPickerListing.parent);
    } else {
      void browseScreenshotFolders("");
    }
  }, [browseScreenshotFolders, closeScreenshotDirectoryPicker, folderPickerListing?.parent, folderPickerPath]);

  const activateFolderPickerItem = useCallback((item: FolderPickerItem) => {
    if (item.kind === "select") {
      setPreferences((current) => ({ ...current, screenshotDirectory: item.path }));
      closeScreenshotDirectoryPicker();
      return;
    }
    void browseScreenshotFolders(item.path);
  }, [browseScreenshotFolders, closeScreenshotDirectoryPicker]);

  const browseApplications = useCallback(async (path: string) => {
    const requestId = ++applicationPickerRequestRef.current;
    setApplicationPickerPath(path);
    setApplicationPickerSelectedIndex(0);
    setApplicationPickerError("");
    if (!path) {
      setApplicationPickerListing(null);
      setApplicationPickerLoading(false);
      return;
    }
    setApplicationPickerLoading(true);
    try {
      const result = await listApplicationDirectory(path, preferences.showHiddenFiles);
      if (applicationPickerRequestRef.current === requestId) setApplicationPickerListing(result);
    } catch (reason) {
      if (applicationPickerRequestRef.current !== requestId) return;
      const failure = reason as { message?: string };
      setApplicationPickerListing(null);
      setApplicationPickerError(failure.message ?? String(reason));
    } finally {
      if (applicationPickerRequestRef.current === requestId) setApplicationPickerLoading(false);
    }
  }, [preferences.showHiddenFiles]);

  const applicationPickerItems = useMemo<ApplicationPickerItem[]>(() => {
    if (!applicationPickerPath) {
      return roots.map((root) => ({ name: root.name, path: root.path, kind: "root" }));
    }
    return applicationPickerListing?.entries ?? [];
  }, [applicationPickerListing, applicationPickerPath, roots]);

  const openApplicationPicker = useCallback(() => {
    setApplicationPickerRunAsAdministrator(false);
    setApplicationPickerOpen(true);
    void browseApplications("");
  }, [browseApplications]);

  const closeApplicationPicker = useCallback(() => {
    applicationPickerRequestRef.current += 1;
    setApplicationPickerOpen(false);
    setApplicationPickerRunAsAdministrator(false);
    setApplicationPickerError("");
  }, []);

  const goBackInApplicationPicker = useCallback(() => {
    if (!applicationPickerPath) {
      closeApplicationPicker();
    } else if (applicationPickerListing?.parent) {
      void browseApplications(applicationPickerListing.parent);
    } else {
      void browseApplications("");
    }
  }, [applicationPickerListing?.parent, applicationPickerPath, browseApplications, closeApplicationPicker]);

  const showApplicationFailure = useCallback((
    reason: unknown,
    operation: "launch" | "configure" | "remove",
  ) => {
    const failure = reason as { code?: string; message?: string };
    const message = failure.code === "elevation_cancelled"
      ? t("applications.elevationCancelled")
      : t(
          operation === "launch"
            ? "applications.launchFailed"
            : operation === "configure"
              ? "applications.elevationSetupFailed"
              : "applications.elevationRemovalFailed",
          { message: failure.message ?? String(reason) },
        );
    setApplicationLaunchError(message);
    if (applicationLaunchErrorTimerRef.current !== null) {
      window.clearTimeout(applicationLaunchErrorTimerRef.current);
    }
    applicationLaunchErrorTimerRef.current = window.setTimeout(() => setApplicationLaunchError(""), 4200);
  }, [t]);

  const activateApplicationPickerItem = useCallback(async (item: ApplicationPickerItem) => {
    if (applicationPermissionPending) return;
    if (item.kind !== "application") {
      void browseApplications(item.path);
      return;
    }
    const existing = preferences.applicationShortcuts.find(
      (shortcut) => shortcut.path.toLowerCase() === item.path.toLowerCase(),
    );
    setApplicationPermissionPending(true);
    try {
      if (applicationPickerRunAsAdministrator) {
        await configureElevatedApplication(item.path);
      } else if (existing?.runAsAdministrator) {
        await removeElevatedApplication(existing.path);
      }
      setPreferences((current) => ({
        ...current,
        applicationShortcuts: bindApplicationShortcut(current.applicationShortcuts, {
          name: item.name.replace(/\.exe$/i, ""),
          path: item.path,
          runAsAdministrator: applicationPickerRunAsAdministrator,
        }),
      }));
      closeApplicationPicker();
    } catch (reason) {
      showApplicationFailure(
        reason,
        applicationPickerRunAsAdministrator ? "configure" : "remove",
      );
    } finally {
      setApplicationPermissionPending(false);
    }
  }, [
    applicationPermissionPending,
    applicationPickerRunAsAdministrator,
    browseApplications,
    closeApplicationPicker,
    preferences.applicationShortcuts,
    showApplicationFailure,
  ]);

  const removeBoundApplication = useCallback(async (application: ApplicationShortcut) => {
    if (applicationPermissionPending) return;
    setApplicationPermissionPending(true);
    try {
      if (application.runAsAdministrator) {
        await removeElevatedApplication(application.path);
      }
      setPreferences((current) => ({
        ...current,
        applicationShortcuts: removeApplicationShortcut(current.applicationShortcuts, application.path),
      }));
    } catch (reason) {
      showApplicationFailure(reason, "remove");
    } finally {
      setApplicationPermissionPending(false);
    }
  }, [applicationPermissionPending, showApplicationFailure]);

  const launchBoundApplication = useCallback((application: ApplicationShortcut) => {
    void launchApplication(application.path, application.runAsAdministrator)
      .catch((reason) => showApplicationFailure(reason, "launch"));
  }, [showApplicationFailure]);

  const applicationStartIndex = roots.length + preferences.favoriteFolders.length;
  const bindApplicationIndex = applicationStartIndex + preferences.applicationShortcuts.length;
  const settingsIndex = bindApplicationIndex + 1;

  const openSettings = useCallback(() => {
    setSettingsOpen(true);
    setBrowserRegion("navigation");
    setNavigationIndex(settingsIndex);
  }, [settingsIndex]);

  const closeSettings = useCallback(() => {
    setSettingsOpen(false);
    setBrowserRegion("navigation");
  }, []);

  const navigationCount = settingsIndex + 3;

  useEffect(() => {
    setNavigationIndex((index) => Math.min(Math.max(0, navigationCount - 1), index));
  }, [navigationCount]);

  const activateNavigation = useCallback((index: number) => {
    if (index < roots.length) {
      setSettingsOpen(false);
      void browse(roots[index].path);
      return;
    }
    const favoriteIndex = index - roots.length;
    if (favoriteIndex >= 0 && favoriteIndex < preferences.favoriteFolders.length) {
      setSettingsOpen(false);
      void browse(preferences.favoriteFolders[favoriteIndex].path);
      return;
    }
    const applicationIndex = index - applicationStartIndex;
    if (applicationIndex >= 0 && applicationIndex < preferences.applicationShortcuts.length) {
      launchBoundApplication(preferences.applicationShortcuts[applicationIndex]);
      return;
    }
    if (index === bindApplicationIndex) {
      openApplicationPicker();
      return;
    }
    if (index === settingsIndex) openSettings();
  }, [
    applicationStartIndex,
    bindApplicationIndex,
    browse,
    launchBoundApplication,
    openApplicationPicker,
    openSettings,
    preferences.applicationShortcuts,
    preferences.favoriteFolders,
    roots,
    settingsIndex,
  ]);

  const openEntry = useCallback((entry: FileEntry) => {
    if (entry.kind === "folder") void browse(entry.path);
    else {
      setMedia(entry);
      setSubtitleName("");
      setSubtitleCues([]);
      if (entry.kind === "audio") {
        const requestId = ++audioQueueRequestRef.current;
        const queueRoot = listing?.path ?? directoryName(entry.path);
        setAudioQueue([entry]);
        setAudioQueueLoading(true);
        void listAudioQueue(queueRoot, preferences.showHiddenFiles)
          .then((tracks) => {
            if (audioQueueRequestRef.current !== requestId) return;
            setAudioQueue(tracks.some((track) => track.path === entry.path) ? tracks : [entry, ...tracks]);
          })
          .catch(() => undefined)
          .finally(() => {
            if (audioQueueRequestRef.current === requestId) setAudioQueueLoading(false);
          });
      }
    }
  }, [browse, listing?.path, preferences.showHiddenFiles]);

  const goBack = useCallback(() => {
    if (media) {
      audioQueueRequestRef.current += 1;
      setSubtitlePickerOpen(false);
      setAudioQueue([]);
      setAudioMetadata(EMPTY_AUDIO_METADATA);
      setMedia(null);
      return;
    }
    if (listing?.parent) void browse(listing.parent, listing.path);
  }, [browse, listing, media]);

  useEffect(() => {
    window.localStorage.setItem("couchaxis.audioMode", audioMode);
  }, [audioMode]);

  useEffect(() => {
    if (!media || media.kind !== "audio") return;
    let active = true;
    setAudioMetadata(EMPTY_AUDIO_METADATA);
    setAudioMetadataLoading(true);
    void readAudioMetadata(media.path)
      .then((metadata) => {
        if (active) setAudioMetadata(metadata);
      })
      .catch(() => {
        if (active) setAudioMetadata(EMPTY_AUDIO_METADATA);
      })
      .finally(() => {
        if (active) setAudioMetadataLoading(false);
      });
    return () => { active = false; };
  }, [media]);

  useEffect(() => {
    const requestId = ++subtitleAutoRequestRef.current;
    setSubtitleName("");
    setSubtitleCues([]);
    if (!media || media.kind !== "video") return;
    void findMatchingSubtitle(media.path)
      .then((subtitle) => {
        if (subtitleAutoRequestRef.current !== requestId || !subtitle) return;
        setSubtitleName(subtitle.fileName);
        setSubtitleCues(parseSubtitles(subtitle.fileName, subtitle.contents));
      })
      .catch(() => undefined);
  }, [media]);

  const browseSubtitles = useCallback(async (path: string) => {
    setSubtitlePath(path);
    setSubtitleLoading(true);
    setSubtitleError("");
    try {
      const result = await listSubtitleDirectory(path, preferences.showHiddenFiles);
      setSubtitleListing(result);
      const firstSubtitle = result.entries.findIndex((entry) => entry.kind === "subtitle");
      const parentOffset = result.parent ? 2 : 1;
      setSubtitleSelectedIndex(firstSubtitle >= 0 ? firstSubtitle + parentOffset : 0);
    } catch (reason) {
      const failure = reason as { message?: string };
      setSubtitleError(failure.message ?? String(reason));
    } finally {
      setSubtitleLoading(false);
    }
  }, [preferences.showHiddenFiles]);

  const openSubtitlePicker = useCallback(() => {
    if (!media || media.kind !== "video") return;
    playerRef.current?.pause();
    setSubtitlePickerOpen(true);
    void browseSubtitles(directoryName(media.path));
  }, [browseSubtitles, media]);

  const closeSubtitlePicker = useCallback(() => {
    setSubtitlePickerOpen(false);
    setSubtitleError("");
  }, []);

  const subtitleItems = useMemo<SubtitlePickerItem[]>(() => {
    if (!subtitleListing) return [];
    const entries: SubtitlePickerItem[] = subtitleListing.entries.map((entry) => ({
      name: entry.name,
      path: entry.path,
      kind: entry.kind,
      extension: entry.extension,
    }));
    if (subtitleListing.parent) {
      entries.unshift({
        name: t("browser.backParent"),
        path: subtitleListing.parent,
        kind: "parent",
        extension: null,
      });
    }
    entries.unshift({
      name: t("subtitle.none"),
      path: "",
      kind: "none",
      extension: null,
    });
    return entries;
  }, [subtitleListing, t]);

  const relatedMedia = useMemo(
    () => media?.kind === "audio"
      ? audioQueue
      : listing?.entries.filter((entry) => media && entry.kind === media.kind) ?? [],
    [audioQueue, listing, media],
  );
  const mediaPosition = Math.max(0, relatedMedia.findIndex((entry) => entry.path === media?.path)) + 1;
  const currentVideoResumePosition = useMemo(() => {
    if (!media || media.kind !== "video") return 0;
    const entry = preferences.recentVideoProgress.find(
      (progress) => progress.path.toLowerCase() === media.path.toLowerCase(),
    );
    return resumablePosition(entry);
  }, [media, preferences.recentVideoProgress]);

  const recordVideoProgress = useCallback((path: string, positionSeconds: number, durationSeconds: number) => {
    setPreferences((current) => {
      const recentVideoProgress = updateRecentVideoProgress(
        current.recentVideoProgress,
        path,
        positionSeconds,
        durationSeconds,
      );
      const unchanged = recentVideoProgress.length === current.recentVideoProgress.length
        && recentVideoProgress.every((entry, index) => {
          const previous = current.recentVideoProgress[index];
          return previous
            && entry.path === previous.path
            && entry.positionSeconds === previous.positionSeconds
            && entry.durationSeconds === previous.durationSeconds;
        });
      return unchanged ? current : { ...current, recentVideoProgress };
    });
  }, []);

  const navigateMedia = useCallback((direction: -1 | 1) => {
    if (!media) return;
    const entries = listing?.entries.filter((entry) => entry.kind === media.kind) ?? [];
    if (entries.length === 0) return;
    const currentIndex = Math.max(0, entries.findIndex((entry) => entry.path === media.path));
    const nextIndex = (currentIndex + direction + entries.length) % entries.length;
    setMedia(entries[nextIndex]);
    setSubtitleName("");
    setSubtitleCues([]);
  }, [listing, media]);

  const selectAudioTrack = useCallback((track: FileEntry) => {
    if (track.path === media?.path) audioPlayerRef.current?.restart();
    else setMedia(track);
  }, [media?.path]);

  const navigateAudio = useCallback((direction: -1 | 1) => {
    if (!media || media.kind !== "audio" || audioQueue.length === 0) return;
    const currentIndex = Math.max(0, audioQueue.findIndex((track) => track.path === media.path));
    let nextIndex: number;
    if (audioMode === "shuffle" && audioQueue.length > 1) {
      const offset = 1 + Math.floor(Math.random() * (audioQueue.length - 1));
      nextIndex = (currentIndex + offset) % audioQueue.length;
    } else {
      nextIndex = (currentIndex + direction + audioQueue.length) % audioQueue.length;
    }
    selectAudioTrack(audioQueue[nextIndex]);
  }, [audioMode, audioQueue, media, selectAudioTrack]);

  const cycleAudioMode = useCallback(() => {
    setAudioMode((mode) => mode === "sequence" ? "shuffle" : mode === "shuffle" ? "repeatOne" : "sequence");
  }, []);

  const handleAudioEnded = useCallback(() => {
    if (audioMode === "repeatOne") audioPlayerRef.current?.restart();
    else navigateAudio(1);
  }, [audioMode, navigateAudio]);

  const activateSubtitleItem = useCallback(async (item: SubtitlePickerItem) => {
    if (item.kind === "none") {
      subtitleAutoRequestRef.current += 1;
      setSubtitleName("");
      setSubtitleCues([]);
      setSubtitlePickerOpen(false);
      return;
    }
    if (item.kind === "parent" || item.kind === "folder") {
      void browseSubtitles(item.path);
      return;
    }

    subtitleAutoRequestRef.current += 1;
    setSubtitleLoading(true);
    setSubtitleError("");
    try {
      const subtitle = await readSubtitle(item.path);
      setSubtitleName(subtitle.fileName);
      setSubtitleCues(parseSubtitles(subtitle.fileName, subtitle.contents));
      setSubtitlePickerOpen(false);
    } catch (reason) {
      const failure = reason as { message?: string };
      setSubtitleError(failure.message ?? String(reason));
    } finally {
      setSubtitleLoading(false);
    }
  }, [browseSubtitles]);

  const adjustSelectedSetting = useCallback((direction: -1 | 1) => {
    if (settingsSelectedRow === 0) {
      const values: StartupView[] = ["lastPath", "drives", "favorites"];
      const index = values.indexOf(preferences.startupView);
      updateStartupView(values[(index + direction + values.length) % values.length]);
    } else if (settingsSelectedRow === 1) {
      updateShowHiddenFiles(!preferences.showHiddenFiles);
    } else if (settingsSelectedRow === 2) {
      updateLanguage(preferences.language === "zh-CN" ? "en-US" : "zh-CN");
    } else if (settingsSelectedRow === 4) {
      updateMangaStartSide(preferences.mangaStartSide === "left" ? "right" : "left");
    } else if (settingsSelectedRow === 5) {
      const values: SubtitleFontSize[] = ["small", "medium", "large"];
      const index = values.indexOf(preferences.subtitleFontSize);
      updateSubtitleFontSize(values[(index + direction + values.length) % values.length]);
    }
  }, [
    preferences.language,
    preferences.mangaStartSide,
    preferences.showHiddenFiles,
    preferences.startupView,
    preferences.subtitleFontSize,
    settingsSelectedRow,
    updateLanguage,
    updateMangaStartSide,
    updateShowHiddenFiles,
    updateStartupView,
    updateSubtitleFontSize,
  ]);

  const controllerHelpContext: ControllerHelpContext = subtitlePickerOpen
    ? "subtitle"
    : applicationPickerOpen
      ? "application"
    : folderPickerOpen
      ? "folder"
    : media?.kind === "video"
      ? "video"
      : media?.kind === "audio"
        ? "audio"
        : media?.kind === "image"
          ? "image"
          : settingsOpen
            ? "settings"
            : "browser";

  const handleBrowserFavoriteAction = useCallback(() => {
    const favoriteIndex = navigationIndex - roots.length;
    const applicationIndex = navigationIndex - applicationStartIndex;
    const selectedFavorite = browserRegion === "navigation"
      && favoriteIndex >= 0
      && favoriteIndex < preferences.favoriteFolders.length
      ? preferences.favoriteFolders[favoriteIndex]
      : null;
    const selectedApplication = browserRegion === "navigation"
      && applicationIndex >= 0
      && applicationIndex < preferences.applicationShortcuts.length
      ? preferences.applicationShortcuts[applicationIndex]
      : null;
    if (selectedFavorite) removeFavorite(selectedFavorite.path);
    else if (selectedApplication) void removeBoundApplication(selectedApplication);
    else toggleCurrentFavorite();
  }, [
    applicationStartIndex,
    browserRegion,
    navigationIndex,
    preferences.applicationShortcuts,
    preferences.favoriteFolders,
    removeBoundApplication,
    removeFavorite,
    roots.length,
    toggleCurrentFavorite,
  ]);

  useEffect(() => {
    setControllerHelpOpen(false);
  }, [controllerHelpContext]);

  const handleAction = useCallback((action: AppAction) => {
    if (action === "confirmRelease") {
      cancelSystemHold();
      return;
    }
    if (systemHoldActionRef.current && action !== "confirm") cancelSystemHold();
    if (action === "zoomStop" && media?.kind === "image") {
      imageViewerRef.current?.stopZoom();
      return;
    }
    if (media?.kind === "image" && imageViewerRef.current?.isFocusMode()) {
      if (action === "blackout") {
        imageViewerRef.current.exitFocusMode();
        return;
      }
    }
    if (media?.kind === "video" && playerRef.current?.isFocusMode() && action === "blackout") {
      playerRef.current.exitFocusMode();
      return;
    }
    if (action === "toggleHelp") {
      if (media?.kind === "image") imageViewerRef.current?.stopZoom();
      setControllerHelpOpen((open) => !open);
      return;
    }
    if (controllerHelpOpen) {
      if (action === "back" || action === "confirm") setControllerHelpOpen(false);
      return;
    }
    if (applicationPickerOpen) {
      if (applicationPermissionPending) return;
      if (action === "back") goBackInApplicationPicker();
      else if (action === "togglePlayback") {
        setApplicationPickerRunAsAdministrator((enabled) => !enabled);
      }
      else if (action === "up") setApplicationPickerSelectedIndex((index) => Math.max(0, index - 1));
      else if (action === "down") {
        setApplicationPickerSelectedIndex((index) => Math.min(Math.max(0, applicationPickerItems.length - 1), index + 1));
      } else if (action === "confirm") {
        const item = applicationPickerItems[applicationPickerSelectedIndex];
        if (item) void activateApplicationPickerItem(item);
      }
      return;
    }
    if (folderPickerOpen) {
      if (action === "back") goBackInFolderPicker();
      else if (action === "up") setFolderPickerSelectedIndex((index) => Math.max(0, index - 1));
      else if (action === "down") {
        setFolderPickerSelectedIndex((index) => Math.min(Math.max(0, folderPickerItems.length - 1), index + 1));
      } else if (action === "confirm") {
        const item = folderPickerItems[folderPickerSelectedIndex];
        if (item) activateFolderPickerItem(item);
      }
      return;
    }
    if (subtitlePickerOpen) {
      if (action === "back") closeSubtitlePicker();
      else if (action === "up") setSubtitleSelectedIndex((index) => Math.max(0, index - 1));
      else if (action === "down") {
        setSubtitleSelectedIndex((index) => Math.min(Math.max(0, subtitleItems.length - 1), index + 1));
      } else if (action === "confirm") {
        const item = subtitleItems[subtitleSelectedIndex];
        if (item) void activateSubtitleItem(item);
      }
      return;
    }
    if (media) {
      if (media.kind === "audio" && audioPlayerRef.current?.exitBlackout()) {
        return;
      }
      if (action === "back") {
        goBack();
      } else if (media.kind === "video") {
        if (action === "togglePlayback" || action === "confirm") playerRef.current?.togglePlayback();
        else if (action === "seekBackward" || action === "left") playerRef.current?.seek(-10);
        else if (action === "seekForward" || action === "right") playerRef.current?.seek(10);
        else if (action === "playbackRateDown") playerRef.current?.changePlaybackRate(-1);
        else if (action === "playbackRateUp") playerRef.current?.changePlaybackRate(1);
        else if (action === "volumeDown") playerRef.current?.changeVolume(-0.05);
        else if (action === "volumeUp") playerRef.current?.changeVolume(0.05);
        else if (action === "subtitle") openSubtitlePicker();
        else if (action === "captureScreenshot") void playerRef.current?.captureScreenshot();
        else if (action === "blackout") playerRef.current?.enterFocusMode();
        else if (action === "fullscreen") playerRef.current?.toggleFullscreen();
      } else if (media.kind === "audio") {
        if (action === "togglePlayback" || action === "confirm") audioPlayerRef.current?.togglePlayback();
        else if (action === "seekBackward" || action === "left") audioPlayerRef.current?.seek(-10);
        else if (action === "seekForward" || action === "right") audioPlayerRef.current?.seek(10);
        else if (action === "volumeDown") audioPlayerRef.current?.changeVolume(-0.05);
        else if (action === "volumeUp") audioPlayerRef.current?.changeVolume(0.05);
        else if (action === "up") navigateAudio(-1);
        else if (action === "down") navigateAudio(1);
        else if (action === "subtitle") cycleAudioMode();
        else if (action === "queue") audioPlayerRef.current?.toggleQueue();
        else if (action === "toggleSpectrum") audioPlayerRef.current?.toggleSpectrum();
        else if (action === "blackout") audioPlayerRef.current?.enterBlackout();
        else if (action === "fullscreen") audioPlayerRef.current?.toggleFullscreen();
      } else if (media.kind === "image") {
        if (action === "up" || action === "left" || action === "seekBackward") imageViewerRef.current?.navigate(-1);
        else if (action === "down" || action === "right" || action === "confirm" || action === "seekForward") imageViewerRef.current?.navigate(1);
        else if (action === "zoomOutStart") imageViewerRef.current?.startZoom(-1);
        else if (action === "zoomInStart") imageViewerRef.current?.startZoom(1);
        else if (action === "zoomStop") imageViewerRef.current?.stopZoom();
        else if (action === "secondaryLeft") imageViewerRef.current?.pan(72, 0);
        else if (action === "secondaryRight") imageViewerRef.current?.pan(-72, 0);
        else if (action === "secondaryUp") imageViewerRef.current?.pan(0, 72);
        else if (action === "secondaryDown") imageViewerRef.current?.pan(0, -72);
        else if (action === "queue") imageViewerRef.current?.toggleScaleLock();
        else if (action === "togglePlayback") imageViewerRef.current?.rotate();
        else if (action === "subtitle") imageViewerRef.current?.reset();
        else if (action === "blackout") imageViewerRef.current?.enterFocusMode();
        else if (action === "fullscreen") imageViewerRef.current?.toggleFullscreen();
      }
      return;
    }

    if (settingsOpen) {
      if (action === "back") closeSettings();
      else if (action === "up") setSettingsSelectedRow((row) => Math.max(0, row - 1));
      else if (action === "down") setSettingsSelectedRow((row) => Math.min(5, row + 1));
      else if (settingsSelectedRow === 3 && (action === "left" || action === "right" || action === "confirm")) {
        openScreenshotDirectoryPicker();
      } else if (action === "left") adjustSelectedSetting(-1);
      else if (action === "right" || action === "confirm") adjustSelectedSetting(1);
      return;
    }

    if (action === "left") {
      if (browserRegion === "files" && preferences.browserViewMode === "grid" && selectedIndex % browserGridColumns > 0) {
        setSelectedIndex((index) => Math.max(0, index - 1));
      } else {
        setBrowserRegion("navigation");
      }
    } else if (action === "right") {
      if (browserRegion === "navigation") {
        setBrowserRegion("files");
      } else if (
        preferences.browserViewMode === "grid"
        && selectedIndex + 1 < (listing?.entries.length ?? 0)
        && (selectedIndex + 1) % browserGridColumns !== 0
      ) {
        setSelectedIndex((index) => index + 1);
      }
    } else if (action === "up") {
      if (browserRegion === "navigation") setNavigationIndex((index) => Math.max(0, index - 1));
      else {
        const step = preferences.browserViewMode === "grid" ? browserGridColumns : 1;
        setSelectedIndex((index) => Math.max(0, index - step));
      }
    } else if (action === "down") {
      if (browserRegion === "navigation") {
        setNavigationIndex((index) => Math.min(Math.max(0, navigationCount - 1), index + 1));
      } else {
        const step = preferences.browserViewMode === "grid" ? browserGridColumns : 1;
        setSelectedIndex((index) => Math.min(Math.max(0, (listing?.entries.length ?? 1) - 1), index + step));
      }
    } else if (action === "confirm") {
      if (browserRegion === "navigation") {
        if (navigationIndex === settingsIndex + 1) beginSystemHold("exit");
        else if (navigationIndex === settingsIndex + 2) beginSystemHold("shutdown");
        else activateNavigation(navigationIndex);
      }
      else {
        const entry = listing?.entries[selectedIndex];
        if (entry) openEntry(entry);
      }
    } else if (action === "subtitle") handleBrowserFavoriteAction();
    else if (action === "queue") toggleBrowserViewMode();
    else if (action === "back") goBack();
    else if (action === "fullscreen") {
      void isAppFullscreen()
        .then((fullscreen) => setAppFullscreen(!fullscreen))
        .catch(() => undefined);
    }
  }, [
    activateApplicationPickerItem,
    activateSubtitleItem,
    activateNavigation,
    activateFolderPickerItem,
    adjustSelectedSetting,
    applicationPickerItems,
    applicationPickerOpen,
    applicationPickerSelectedIndex,
    applicationPermissionPending,
    beginSystemHold,
    browserGridColumns,
    browserRegion,
    controllerHelpOpen,
    closeSubtitlePicker,
    closeSettings,
    cancelSystemHold,
    folderPickerItems,
    folderPickerOpen,
    folderPickerSelectedIndex,
    goBackInApplicationPicker,
    goBackInFolderPicker,
    goBack,
    handleBrowserFavoriteAction,
    listing,
    media,
    navigateAudio,
    navigateMedia,
    navigationCount,
    navigationIndex,
    cycleAudioMode,
    openEntry,
    openScreenshotDirectoryPicker,
    openSubtitlePicker,
    preferences.browserViewMode,
    settingsIndex,
    selectedIndex,
    subtitleItems,
    subtitlePickerOpen,
    subtitleSelectedIndex,
    settingsOpen,
    settingsSelectedRow,
    toggleBrowserViewMode,
  ]);

  const exitAudioBlackout = useCallback(
    () => audioPlayerRef.current?.exitBlackout() ?? false,
    [],
  );
  const controller = useGamepad(handleAction, exitAudioBlackout);
  useKeyboard(handleAction);

  if (media) {
    if (media.kind === "audio") {
      return (
        <I18nProvider language={preferences.language}>
          <AudioPlayer
            ref={audioPlayerRef}
            media={media}
            source={mediaSource(media.path)}
            metadata={audioMetadata}
            metadataLoading={audioMetadataLoading}
            queue={audioQueue}
            queueLoading={audioQueueLoading}
            position={mediaPosition}
            total={relatedMedia.length}
            mode={audioMode}
            onModeChange={setAudioMode}
            onClose={goBack}
            onPrevious={() => navigateAudio(-1)}
            onNext={() => navigateAudio(1)}
            onEnded={handleAudioEnded}
            onSelectTrack={selectAudioTrack}
          />
          {controllerHelpOpen && (
            <ControllerHelpOverlay
              context={controllerHelpContext}
              layout={controller.layout}
              onClose={() => setControllerHelpOpen(false)}
            />
          )}
        </I18nProvider>
      );
    }

    if (media.kind === "image") {
      return (
        <I18nProvider language={preferences.language}>
          <ImageViewer
            ref={imageViewerRef}
            media={media}
            source={mediaSource(media.path)}
            position={mediaPosition}
            total={relatedMedia.length}
            mangaStartSide={preferences.mangaStartSide}
            onClose={goBack}
            onPrevious={() => navigateMedia(-1)}
            onNext={() => navigateMedia(1)}
          />
          {controllerHelpOpen && (
            <ControllerHelpOverlay
              context={controllerHelpContext}
              layout={controller.layout}
              onClose={() => setControllerHelpOpen(false)}
            />
          )}
        </I18nProvider>
      );
    }

    return (
      <I18nProvider language={preferences.language}>
        <Player
          ref={playerRef}
          media={media}
          source={mediaSource(media.path)}
          subtitleName={subtitleName}
          subtitleCues={subtitleCues}
          subtitleFontSize={preferences.subtitleFontSize}
          screenshotDirectory={preferences.screenshotDirectory}
          resumePosition={currentVideoResumePosition}
          onClose={goBack}
          onPickSubtitle={openSubtitlePicker}
          onProgressChange={(positionSeconds, durationSeconds) => {
            recordVideoProgress(media.path, positionSeconds, durationSeconds);
          }}
        />
        {subtitlePickerOpen && (
          <SubtitlePicker
            path={subtitlePath}
            items={subtitleItems}
            selectedIndex={subtitleSelectedIndex}
            loading={subtitleLoading}
            error={subtitleError}
            onSelect={setSubtitleSelectedIndex}
            onActivate={(item) => void activateSubtitleItem(item)}
            onClose={closeSubtitlePicker}
            onRetry={() => void browseSubtitles(subtitlePath)}
          />
        )}
        {controllerHelpOpen && (
          <ControllerHelpOverlay
            context={controllerHelpContext}
            layout={controller.layout}
            onClose={() => setControllerHelpOpen(false)}
          />
        )}
      </I18nProvider>
    );
  }

  return (
    <I18nProvider language={preferences.language}>
    <div className="app-shell">
      <header className="app-header">
        <Brand />
        <div className={controller.connected ? "controller-status connected" : "controller-status"} title={controller.name || t("app.controllerDisconnected")}>
          {controller.connected ? <Gamepad2 aria-hidden="true" /> : <WifiOff aria-hidden="true" />}
          <span>{controller.connected ? t("app.controllerConnected") : t("app.controllerWaiting")}</span>
          <i />
        </div>
      </header>

      <div className="browser-layout">
        <DriveRail
          roots={roots}
          favorites={preferences.favoriteFolders}
          applications={preferences.applicationShortcuts}
          currentPath={listing?.path ?? ""}
          selectedIndex={navigationIndex}
          focused={browserRegion === "navigation"}
          settingsActive={settingsOpen}
          systemHoldAction={systemHoldAction}
          systemHoldProgress={systemHoldProgress}
          onSelectIndex={(index) => {
            if (index !== navigationIndex) cancelSystemHold();
            setNavigationIndex(index);
            setBrowserRegion("navigation");
          }}
          onSelectPath={(path) => {
            cancelSystemHold();
            setSettingsOpen(false);
            setBrowserRegion("navigation");
            void browse(path);
          }}
          onRemoveFavorite={removeFavorite}
          onLaunchApplication={launchBoundApplication}
          onRemoveApplication={removeBoundApplication}
          onBindApplication={openApplicationPicker}
          onOpenSettings={openSettings}
          onSystemHoldStart={beginSystemHold}
          onSystemHoldCancel={cancelSystemHold}
        />
        <main className={settingsOpen ? "browser-main settings-main" : "browser-main"}>
          {settingsOpen ? (
            <SettingsPanel
              preferences={preferences}
              selectedRow={settingsSelectedRow}
              saveState={settingsSaveState}
              onSelectRow={setSettingsSelectedRow}
              onStartupViewChange={updateStartupView}
              onShowHiddenFilesChange={updateShowHiddenFiles}
              onLanguageChange={updateLanguage}
              onOpenScreenshotDirectory={openScreenshotDirectoryPicker}
              onMangaStartSideChange={updateMangaStartSide}
              onSubtitleFontSizeChange={updateSubtitleFontSize}
              onClose={closeSettings}
            />
          ) : (<>
          <div className="browser-toolbar">
            <button type="button" className="icon-button back-button" onClick={goBack} disabled={!listing?.parent} title={t("browser.backParent")}><ChevronLeft aria-hidden="true" /></button>
            <button
              type="button"
              className={currentFolderIsFavorite ? "icon-button favorite-button active" : "icon-button favorite-button"}
              onClick={toggleCurrentFavorite}
              disabled={!listing}
              title={currentFolderIsFavorite ? t("browser.removeFavorite") : t("browser.addFavorite")}
              aria-pressed={currentFolderIsFavorite}
            ><Star aria-hidden="true" /></button>
            <div className="path-block">
              <span>{t("browser.location")}</span>
              <h1 title={listing?.path}>{displayPath(listing?.path ?? t("common.loading"))}</h1>
            </div>
            <div className="segmented-control view-mode-control" aria-label={t("browser.viewMode")}>
              <button
                type="button"
                className={preferences.browserViewMode === "list" ? "active" : ""}
                onClick={() => updateBrowserViewMode("list")}
                title={t("browser.viewList")}
                aria-label={t("browser.viewList")}
                aria-pressed={preferences.browserViewMode === "list"}
              ><List aria-hidden="true" /></button>
              <button
                type="button"
                className={preferences.browserViewMode === "grid" ? "active" : ""}
                onClick={() => updateBrowserViewMode("grid")}
                title={t("browser.viewGrid")}
                aria-label={t("browser.viewGrid")}
                aria-pressed={preferences.browserViewMode === "grid"}
              ><LayoutGrid aria-hidden="true" /></button>
            </div>
            <div className="toolbar-meta"><Monitor aria-hidden="true" /><span>{t("browser.items", { count: listing?.entries.length ?? 0 })}</span></div>
          </div>

          {error ? (
            <div className="error-state">
              <strong>{t("browser.openFailed")}</strong>
              <span>{error}</span>
              <button type="button" onClick={() => listing && void browse(listing.path)}><RefreshCw aria-hidden="true" />{t("common.retry")}</button>
            </div>
          ) : (
            <FileList
              entries={listing?.entries ?? []}
              loading={loading}
              viewMode={preferences.browserViewMode}
              selectedIndex={browserRegion === "files" ? selectedIndex : -1}
              onSelect={(index) => {
                setSelectedIndex(index);
                setBrowserRegion("files");
              }}
              onOpen={openEntry}
              onGridColumnsChange={setBrowserGridColumns}
            />
          )}
          </>)}
        </main>
      </div>
      <footer className="app-footer">
        <span>CouchAxis 0.1</span>
        <span>{controller.connected ? controller.name : t("app.localMode")}</span>
      </footer>
    </div>
    {folderPickerOpen && (
      <FolderPicker
        path={folderPickerPath}
        items={folderPickerItems}
        selectedIndex={folderPickerSelectedIndex}
        loading={folderPickerLoading}
        error={folderPickerError}
        onSelect={setFolderPickerSelectedIndex}
        onActivate={activateFolderPickerItem}
        onBack={goBackInFolderPicker}
        onClose={closeScreenshotDirectoryPicker}
        onRetry={() => void browseScreenshotFolders(folderPickerPath)}
      />
    )}
    {applicationPickerOpen && (
      <ApplicationPicker
        path={applicationPickerPath}
        items={applicationPickerItems}
        selectedIndex={applicationPickerSelectedIndex}
        loading={applicationPickerLoading}
        error={applicationPickerError}
        runAsAdministrator={applicationPickerRunAsAdministrator}
        permissionPending={applicationPermissionPending}
        onSelect={setApplicationPickerSelectedIndex}
        onRunAsAdministratorChange={setApplicationPickerRunAsAdministrator}
        onActivate={activateApplicationPickerItem}
        onBack={goBackInApplicationPicker}
        onClose={closeApplicationPicker}
        onRetry={() => void browseApplications(applicationPickerPath)}
      />
    )}
    {applicationLaunchError && (
      <div className="application-launch-error" role="status">{applicationLaunchError}</div>
    )}
    {controllerHelpOpen && (
      <ControllerHelpOverlay
        context={controllerHelpContext}
        layout={controller.layout}
        onClose={() => setControllerHelpOpen(false)}
      />
    )}
    </I18nProvider>
  );
}
