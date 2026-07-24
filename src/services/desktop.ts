import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type {
  AppPreferences,
  AudioMetadata,
  DirectoryListing,
  FileEntry,
  RootEntry,
  SubtitleDirectoryListing,
  SubtitleFile,
} from "../types";

const DEMO_ROOT = "D:\\";
export const DEFAULT_PREFERENCES: AppPreferences = {
  startupView: "lastPath",
  language: "zh-CN",
  showHiddenFiles: false,
  favoriteFolders: [],
  screenshotDirectory: "D:\\Pictures\\CouchAxis Screenshots",
  mangaStartSide: "left",
};
const demoListings: Record<string, DirectoryListing> = {
  [DEMO_ROOT]: {
    path: DEMO_ROOT,
    parent: null,
    entries: [
      { name: "Movies", path: "D:\\Movies", kind: "folder", size: null, modifiedAt: 1784689200, extension: null },
      { name: "Documentaries", path: "D:\\Documentaries", kind: "folder", size: null, modifiedAt: 1784426400, extension: null },
      { name: "Concerts", path: "D:\\Concerts", kind: "folder", size: null, modifiedAt: 1784077200, extension: null },
      { name: "Northern Lights.mkv", path: "D:\\Northern Lights.mkv", kind: "video", size: 7_864_320_000, modifiedAt: 1784689200, extension: "MKV" },
      { name: "City at Dawn.mp4", path: "D:\\City at Dawn.mp4", kind: "video", size: 2_147_483_648, modifiedAt: 1784426400, extension: "MP4" },
    ],
  },
  "D:\\Movies": {
    path: "D:\\Movies",
    parent: DEMO_ROOT,
    entries: [
      { name: "Archive", path: "D:\\Movies\\Archive", kind: "folder", size: null, modifiedAt: 1783562400, extension: null },
      { name: ".Hidden Sessions", path: "D:\\Movies\\.Hidden Sessions", kind: "folder", size: null, modifiedAt: 1783562400, extension: null },
      { name: "After the Rain.mkv", path: "D:\\Movies\\After the Rain.mkv", kind: "video", size: 5_905_580_032, modifiedAt: 1784338200, extension: "MKV" },
      { name: "Crossing Lines.mp4", path: "D:\\Movies\\Crossing Lines.mp4", kind: "video", size: 3_328_598_016, modifiedAt: 1784163600, extension: "MP4" },
      { name: "Midnight Signals.flac", path: "D:\\Movies\\Midnight Signals.flac", kind: "audio", size: 42_786_816, modifiedAt: 1784163600, extension: "FLAC" },
      { name: "Mountain Lake.jpg", path: "D:\\Movies\\Mountain Lake.jpg", kind: "image", size: 8_912_896, modifiedAt: 1784163600, extension: "JPG" },
      { name: "Quiet Streets.mp3", path: "D:\\Movies\\Quiet Streets.mp3", kind: "audio", size: 10_485_760, modifiedAt: 1784077200, extension: "MP3" },
      { name: "Summer Window.png", path: "D:\\Movies\\Summer Window.png", kind: "image", size: 5_242_880, modifiedAt: 1784077200, extension: "PNG" },
    ],
  },
};

const demoSubtitleListings: Record<string, SubtitleDirectoryListing> = {
  "D:\\Movies": {
    path: "D:\\Movies",
    parent: DEMO_ROOT,
    entries: [
      { name: "Subtitles", path: "D:\\Movies\\Subtitles", kind: "folder", extension: null },
      { name: "After the Rain.srt", path: "D:\\Movies\\After the Rain.srt", kind: "subtitle", extension: "SRT" },
      { name: "After the Rain.zh-CN.srt", path: "D:\\Movies\\After the Rain.zh-CN.srt", kind: "subtitle", extension: "SRT" },
      { name: "After the Rain.en.ass", path: "D:\\Movies\\After the Rain.en.ass", kind: "subtitle", extension: "ASS" },
    ],
  },
  "D:\\Movies\\Subtitles": {
    path: "D:\\Movies\\Subtitles",
    parent: "D:\\Movies",
    entries: [
      { name: "Commentary.ssa", path: "D:\\Movies\\Subtitles\\Commentary.ssa", kind: "subtitle", extension: "SSA" },
    ],
  },
};

const demoAudioQueue: FileEntry[] = [
  { name: "Deep Space.ogg", path: "D:\\Movies\\Archive\\Deep Space.ogg", kind: "audio", size: 18_874_368, modifiedAt: 1783987200, extension: "OGG" },
  { name: "Midnight Signals.flac", path: "D:\\Movies\\Midnight Signals.flac", kind: "audio", size: 42_786_816, modifiedAt: 1784163600, extension: "FLAC" },
  { name: "Quiet Streets.mp3", path: "D:\\Movies\\Quiet Streets.mp3", kind: "audio", size: 10_485_760, modifiedAt: 1784077200, extension: "MP3" },
  { name: "Blue Hour.m4a", path: "D:\\Movies\\Soundtracks\\Blue Hour.m4a", kind: "audio", size: 13_631_488, modifiedAt: 1783900800, extension: "M4A" },
];

export const isDesktop = () => Boolean(window.__TAURI_INTERNALS__);

export async function isAppFullscreen(): Promise<boolean> {
  if (isDesktop()) return getCurrentWindow().isFullscreen();
  return Boolean(document.fullscreenElement);
}

export async function setAppFullscreen(fullscreen: boolean): Promise<void> {
  if (isDesktop()) {
    await getCurrentWindow().setFullscreen(fullscreen);
    return;
  }
  if (fullscreen && !document.fullscreenElement) await document.documentElement.requestFullscreen();
  else if (!fullscreen && document.fullscreenElement) await document.exitFullscreen();
}

export async function listRoots(): Promise<RootEntry[]> {
  if (isDesktop()) return invoke<RootEntry[]>("list_roots");
  return [
    { name: "系统 (C)", path: "C:\\", rootType: "fixed" },
    { name: "媒体 (D)", path: DEMO_ROOT, rootType: "fixed" },
    { name: "USB (E)", path: "E:\\", rootType: "removable" },
  ];
}

export async function listDirectory(path: string, showHiddenFiles = false): Promise<DirectoryListing> {
  if (isDesktop()) return invoke<DirectoryListing>("list_directory", { path, showHiddenFiles });
  await new Promise((resolve) => window.setTimeout(resolve, 120));
  const listing = demoListings[path] ?? { path, parent: path === DEMO_ROOT ? null : DEMO_ROOT, entries: [] };
  return showHiddenFiles
    ? listing
    : { ...listing, entries: listing.entries.filter((entry) => !entry.name.startsWith(".")) };
}

export async function listAudioQueue(path: string, showHiddenFiles = false): Promise<FileEntry[]> {
  if (isDesktop()) return invoke<FileEntry[]>("list_audio_queue", { path, showHiddenFiles });
  await new Promise((resolve) => window.setTimeout(resolve, 180));
  return path === "D:\\Movies" ? demoAudioQueue : demoAudioQueue.filter((entry) => entry.path.startsWith(path));
}

export async function readAudioMetadata(path: string): Promise<AudioMetadata> {
  if (isDesktop()) return invoke<AudioMetadata>("read_audio_metadata", { path });
  await new Promise((resolve) => window.setTimeout(resolve, 80));
  if (path.endsWith("Midnight Signals.flac")) {
    return {
      title: "Midnight Signals",
      artist: "CouchAxis Session",
      album: "Night Drive",
      lyrics: "[00:00.00]城市熄灭最后一盏灯\n[00:06.00]信号沿着夜色慢慢靠近\n[00:12.50]我们在安静的频率相遇\n[00:19.00]直到清晨越过天际",
      coverArt: null,
    };
  }
  if (path.endsWith("Quiet Streets.mp3")) {
    return {
      title: "Quiet Streets",
      artist: "CouchAxis Session",
      album: "Night Drive",
      lyrics: "街道安静下来\n远处留下微弱的光\n脚步经过熟悉的转角\n等待新的一天",
      coverArt: null,
    };
  }
  return { title: null, artist: null, album: null, lyrics: null, coverArt: null };
}

export async function getLastPath(): Promise<string | null> {
  if (isDesktop()) return invoke<string | null>("get_last_path");
  return window.localStorage.getItem("couchaxis.lastPath") ?? DEMO_ROOT;
}

export async function saveLastPath(path: string): Promise<void> {
  if (isDesktop()) {
    await invoke("save_last_path", { path });
  } else {
    window.localStorage.setItem("couchaxis.lastPath", path);
  }
}

export async function getPreferences(): Promise<AppPreferences> {
  if (isDesktop()) return invoke<AppPreferences>("get_preferences");
  const saved = window.localStorage.getItem("couchaxis.preferences");
  if (!saved) return DEFAULT_PREFERENCES;
  try {
    return { ...DEFAULT_PREFERENCES, ...JSON.parse(saved) } as AppPreferences;
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export async function savePreferences(preferences: AppPreferences): Promise<void> {
  if (isDesktop()) {
    await invoke("save_preferences", { preferences });
  } else {
    window.localStorage.setItem("couchaxis.preferences", JSON.stringify(preferences));
  }
}

export function mediaSource(path: string): string {
  return isDesktop() ? convertFileSrc(path) : "";
}

export async function listSubtitleDirectory(path: string, showHiddenFiles = false): Promise<SubtitleDirectoryListing> {
  if (isDesktop()) return invoke<SubtitleDirectoryListing>("list_subtitle_directory", { path, showHiddenFiles });
  await new Promise((resolve) => window.setTimeout(resolve, 120));
  const listing = demoSubtitleListings[path] ?? { path, parent: path === DEMO_ROOT ? null : DEMO_ROOT, entries: [] };
  return showHiddenFiles
    ? listing
    : { ...listing, entries: listing.entries.filter((entry) => !entry.name.startsWith(".")) };
}

export async function readSubtitle(path: string): Promise<SubtitleFile> {
  if (isDesktop()) return invoke<SubtitleFile>("read_subtitle", { path });
  const fileName = path.split(/[\\/]/).pop() ?? "sample.srt";
  if (fileName.toLowerCase().endsWith(".ass") || fileName.toLowerCase().endsWith(".ssa")) {
    return {
      fileName,
      contents: "Dialogue: 0,0:00:01.00,0:00:05.00,Default,,0,0,0,,CouchAxis preview",
    };
  }
  return {
    fileName,
    contents: "1\n00:00:01,000 --> 00:00:05,000\nCouchAxis preview\n",
  };
}

export async function findMatchingSubtitle(videoPath: string): Promise<SubtitleFile | null> {
  if (isDesktop()) return invoke<SubtitleFile | null>("find_matching_subtitle", { videoPath });
  const videoStem = videoPath.replace(/\.[^\\/.]+$/, "").toLocaleLowerCase();
  const listing = demoSubtitleListings[videoPath.replace(/[\\/][^\\/]+$/, "")];
  const match = listing?.entries.find((entry) => {
    if (entry.kind !== "subtitle") return false;
    return entry.path.replace(/\.[^\\/.]+$/, "").toLocaleLowerCase() === videoStem;
  });
  return match ? readSubtitle(match.path) : null;
}

export async function saveScreenshot(directory: string, fileName: string, pngData: number[]): Promise<string> {
  if (isDesktop()) return invoke<string>("save_screenshot", { directory, fileName, pngData });
  await new Promise((resolve) => window.setTimeout(resolve, 80));
  return `${directory.replace(/[\\/]+$/, "")}\\${fileName}`;
}
