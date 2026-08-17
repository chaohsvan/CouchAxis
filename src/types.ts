export type EntryKind = "folder" | "video" | "audio" | "image";

export interface FileEntry {
  name: string;
  path: string;
  kind: EntryKind;
  size: number | null;
  modifiedAt: number | null;
  extension: string | null;
}

export interface RootEntry {
  name: string;
  path: string;
  rootType: "fixed" | "removable";
}

export interface DirectoryListing {
  path: string;
  parent: string | null;
  entries: FileEntry[];
}

export type StartupView = "lastPath" | "drives" | "favorites";
export type AppLanguage = "zh-CN" | "en-US";
export type MangaStartSide = "left" | "right";
export type SubtitleFontSize = "small" | "medium" | "large";
export type BrowserViewMode = "list" | "grid";
export type SystemAction = "exit" | "shutdown";

export interface FavoriteFolder {
  name: string;
  path: string;
}

export interface ApplicationShortcut {
  name: string;
  path: string;
  runAsAdministrator: boolean;
}

export interface RecentVideoProgress {
  path: string;
  positionSeconds: number;
  durationSeconds: number;
  updatedAt: number;
}

export interface AppPreferences {
  startupView: StartupView;
  language: AppLanguage;
  showHiddenFiles: boolean;
  favoriteFolders: FavoriteFolder[];
  applicationShortcuts: ApplicationShortcut[];
  recentVideoProgress: RecentVideoProgress[];
  screenshotDirectory: string;
  mangaStartSide: MangaStartSide;
  subtitleFontSize: SubtitleFontSize;
  browserViewMode: BrowserViewMode;
}

export interface AudioMetadata {
  title: string | null;
  artist: string | null;
  album: string | null;
  lyrics: string | null;
  coverArt: string | null;
}

export type AudioPlaybackMode = "sequence" | "shuffle" | "repeatOne";

export interface SubtitleFile {
  path: string;
  fileName: string;
  contents: string;
}

export type SubtitleEntryKind = "folder" | "subtitle";

export interface SubtitleEntry {
  name: string;
  path: string;
  kind: SubtitleEntryKind;
  extension: string | null;
}

export interface SubtitleDirectoryListing {
  path: string;
  parent: string | null;
  entries: SubtitleEntry[];
}

export type ApplicationEntryKind = "folder" | "application";

export interface ApplicationEntry {
  name: string;
  path: string;
  kind: ApplicationEntryKind;
}

export interface ApplicationDirectoryListing {
  path: string;
  parent: string | null;
  entries: ApplicationEntry[];
}

export interface SubtitleCue {
  start: number;
  end: number;
  text: string;
}

export type AppAction =
  | "up"
  | "down"
  | "left"
  | "right"
  | "confirm"
  | "confirmRelease"
  | "back"
  | "togglePlayback"
  | "seekBackward"
  | "seekForward"
  | "playbackRateDown"
  | "playbackRateUp"
  | "secondaryLeft"
  | "secondaryRight"
  | "secondaryUp"
  | "secondaryDown"
  | "zoomOutStart"
  | "zoomInStart"
  | "zoomStop"
  | "volumeDown"
  | "volumeUp"
  | "subtitle"
  | "queue"
  | "toggleSpectrum"
  | "blackout"
  | "captureScreenshot"
  | "toggleHelp"
  | "fullscreen";

export type ControllerLayout = "xbox" | "playstation" | "switch" | "generic";
