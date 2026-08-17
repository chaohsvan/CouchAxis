import {
  Captions,
  CaptionsOff,
  Camera,
  CheckCircle2,
  CircleAlert,
  Focus,
  Gauge,
  Maximize,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  RotateCw,
  Volume1,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { formatDuration } from "../lib/format";
import { activeSubtitle } from "../lib/subtitles";
import { captureVideoFrame, screenshotFileName } from "../lib/screenshots";
import { stepPlaybackRate } from "../lib/playbackRate";
import {
  isAppFullscreen,
  isDesktop,
  prepareScreenshotPath,
  saveScreenshot,
  setAppFullscreen,
} from "../services/desktop";
import {
  createNativeVideoSession,
  type NativeVideoSessionController,
  type NativeVideoState,
} from "../services/videoPlayback";
import { useI18n } from "../i18n";
import type { FileEntry, SubtitleCue, SubtitleFontSize } from "../types";

export interface PlayerHandle {
  pause: () => void;
  togglePlayback: () => void;
  seek: (amount: number) => void;
  changeVolume: (amount: number) => void;
  toggleMute: () => void;
  toggleSubtitles: () => void;
  toggleFullscreen: () => void;
  captureScreenshot: () => Promise<void>;
  changePlaybackRate: (direction: -1 | 1) => void;
  enterFocusMode: () => void;
  exitFocusMode: () => void;
  isFocusMode: () => boolean;
  clearSubtitles: () => void;
}

interface PlayerProps {
  media: FileEntry;
  source: string;
  subtitleName: string;
  subtitlePath: string;
  subtitleCues: SubtitleCue[];
  subtitleFontSize: SubtitleFontSize;
  screenshotDirectory: string;
  resumePosition: number;
  onClose: () => void;
  onPickSubtitle: () => void;
  onProgressChange: (positionSeconds: number, durationSeconds: number) => void;
}

type PlaybackOsd =
  | { kind: "volume"; value: number; muted: boolean }
  | { kind: "speed"; value: number };

const NATIVE_SUBTITLE_SCALE: Record<SubtitleFontSize, number> = {
  small: 0.82,
  medium: 1,
  large: 1.28,
};

export const Player = forwardRef<PlayerHandle, PlayerProps>(function Player(
  {
    media,
    source,
    subtitleName,
    subtitlePath,
    subtitleCues,
    subtitleFontSize,
    screenshotDirectory,
    resumePosition,
    onClose,
    onPickSubtitle,
    onProgressChange,
  },
  ref,
) {
  const { t } = useI18n();
  const nativePlayback = isDesktop();
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoFrameRef = useRef<HTMLDivElement>(null);
  const nativeSessionRef = useRef<NativeVideoSessionController | null>(null);
  const nativeResumeRef = useRef({ path: media.path, position: resumePosition });
  const loadedSubtitlePathRef = useRef("");
  const volumeRef = useRef(0.8);
  const mutedRef = useRef(false);
  const playbackRateRef = useRef(1);
  const subtitlesEnabledRef = useRef(true);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [videoAspectRatio, setVideoAspectRatio] = useState(16 / 9);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);
  const [subtitleText, setSubtitleText] = useState("");
  const [playbackError, setPlaybackError] = useState(false);
  const [playbackOsd, setPlaybackOsd] = useState<PlaybackOsd | null>(null);
  const [screenshotNotice, setScreenshotNotice] = useState<{ success: boolean; message: string } | null>(null);
  const playbackOsdTimerRef = useRef<number | null>(null);
  const progressRef = useRef({ position: 0, duration: 0 });
  const progressCallbackRef = useRef(onProgressChange);
  const lastProgressReportAtRef = useRef(0);
  const screenshotNoticeTimerRef = useRef<number | null>(null);
  const focusRequestedFullscreenRef = useRef(false);
  const focusModeRef = useRef(false);
  const fullscreenTransitionRef = useRef(false);
  const [focusMode, setFocusMode] = useState(false);
  const [nativeSessionReady, setNativeSessionReady] = useState(0);
  if (nativeResumeRef.current.path !== media.path) {
    nativeResumeRef.current = { path: media.path, position: resumePosition };
  }
  progressCallbackRef.current = onProgressChange;

  const reportProgress = () => {
    const { position, duration: videoDuration } = progressRef.current;
    if (videoDuration > 0) progressCallbackRef.current(position, videoDuration);
  };

  const commitPlaybackOsd = (notice: PlaybackOsd) => {
    setPlaybackOsd(notice);
    if (playbackOsdTimerRef.current !== null) window.clearTimeout(playbackOsdTimerRef.current);
    playbackOsdTimerRef.current = window.setTimeout(() => setPlaybackOsd(null), 1400);
  };

  const showFullscreenOsd = (notice: PlaybackOsd) => {
    if (focusModeRef.current) {
      commitPlaybackOsd(notice);
      return;
    }
    void isAppFullscreen()
      .then((fullscreen) => { if (fullscreen) commitPlaybackOsd(notice); })
      .catch(() => undefined);
  };

  const togglePlayback = () => {
    if (nativePlayback) {
      const session = nativeSessionRef.current;
      if (!session || playbackError) return;
      void (playing ? session.pause() : session.play()).catch(() => undefined);
      return;
    }
    const video = videoRef.current;
    if (!video || playbackError) return;
    if (video.paused) void video.play();
    else video.pause();
  };
  const pause = () => {
    if (nativePlayback) {
      void nativeSessionRef.current?.pause().catch(() => undefined);
    } else {
      videoRef.current?.pause();
    }
  };
  const seek = (amount: number) => {
    if (nativePlayback) {
      void nativeSessionRef.current?.seekRelative(amount).catch(() => undefined);
      return;
    }
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.min(Math.max(0, video.currentTime + amount), video.duration || Number.MAX_SAFE_INTEGER);
  };
  const changeVolume = (amount: number) => {
    if (nativePlayback) {
      const next = Math.min(1, Math.max(0, volumeRef.current + amount));
      volumeRef.current = next;
      mutedRef.current = false;
      setMuted(false);
      setVolume(next);
      void nativeSessionRef.current?.setMuted(false).catch(() => undefined);
      void nativeSessionRef.current?.setVolume(next).catch(() => undefined);
      showFullscreenOsd({ kind: "volume", value: next, muted: false });
      return;
    }
    const video = videoRef.current;
    if (!video) return;
    const next = Math.min(1, Math.max(0, video.volume + amount));
    video.volume = next;
    video.muted = false;
    setMuted(false);
    setVolume(next);
    showFullscreenOsd({ kind: "volume", value: next, muted: false });
  };
  const toggleMute = () => {
    if (nativePlayback) {
      const next = !mutedRef.current;
      mutedRef.current = next;
      setMuted(next);
      void nativeSessionRef.current?.setMuted(next).catch(() => undefined);
      showFullscreenOsd({ kind: "volume", value: volumeRef.current, muted: next });
      return;
    }
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
    showFullscreenOsd({ kind: "volume", value: video.volume, muted: video.muted });
  };
  const toggleSubtitles = () => {
    const next = !subtitlesEnabledRef.current;
    subtitlesEnabledRef.current = next;
    setSubtitlesEnabled(next);
    if (nativePlayback) {
      void nativeSessionRef.current?.setSubtitlesEnabled(next).catch(() => undefined);
    }
  };
  const clearSubtitles = () => {
    loadedSubtitlePathRef.current = "";
    setSubtitleText("");
    if (nativePlayback) {
      void nativeSessionRef.current?.clearSubtitle().catch(() => undefined);
    }
  };
  const changePlaybackRate = (direction: -1 | 1) => {
    const next = stepPlaybackRate(playbackRateRef.current, direction);
    playbackRateRef.current = next;
    setPlaybackRate(next);
    if (nativePlayback) {
      void nativeSessionRef.current?.setRate(next).catch(() => undefined);
    } else if (videoRef.current) {
      videoRef.current.playbackRate = next;
    }
    showFullscreenOsd({ kind: "speed", value: next });
  };
  const resetPlaybackRate = () => {
    playbackRateRef.current = 1;
    if (nativePlayback) {
      void nativeSessionRef.current?.setRate(1).catch(() => undefined);
    } else if (videoRef.current) {
      videoRef.current.playbackRate = 1;
    }
    setPlaybackRate(1);
    showFullscreenOsd({ kind: "speed", value: 1 });
  };
  const toggleFullscreen = () => {
    if (fullscreenTransitionRef.current) return;
    fullscreenTransitionRef.current = true;
    void isAppFullscreen()
      .then((fullscreen) => setAppFullscreen(!fullscreen))
      .catch(() => undefined)
      .finally(() => {
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => { fullscreenTransitionRef.current = false; });
        });
      });
  };
  const enterFocusMode = () => {
    focusModeRef.current = true;
    setFocusMode(true);
    void isAppFullscreen().then((fullscreen) => {
      if (fullscreen || !focusModeRef.current) return;
      focusRequestedFullscreenRef.current = true;
      return setAppFullscreen(true).then(() => {
        if (!focusModeRef.current) {
          focusRequestedFullscreenRef.current = false;
          return setAppFullscreen(false);
        }
      }).catch(() => {
        focusRequestedFullscreenRef.current = false;
      });
    }).catch(() => undefined);
  };
  const exitFocusMode = () => {
    focusModeRef.current = false;
    setFocusMode(false);
    if (focusRequestedFullscreenRef.current) void setAppFullscreen(false).catch(() => undefined);
    focusRequestedFullscreenRef.current = false;
  };

  const showScreenshotNotice = (notice: { success: boolean; message: string }) => {
    setScreenshotNotice(notice);
    if (screenshotNoticeTimerRef.current !== null) window.clearTimeout(screenshotNoticeTimerRef.current);
    screenshotNoticeTimerRef.current = window.setTimeout(() => setScreenshotNotice(null), 3200);
  };

  const captureScreenshot = async () => {
    if (nativePlayback) {
      const session = nativeSessionRef.current;
      if (!session || playbackError || duration <= 0) {
        showScreenshotNotice({ success: false, message: t("player.screenshotUnavailable") });
        return;
      }
      const fileName = screenshotFileName(media.name, new Date(), currentTime);
      try {
        const targetPath = await prepareScreenshotPath(screenshotDirectory, fileName);
        await session.captureScreenshot(targetPath);
        const savedName = targetPath.split(/[\\/]/).pop() ?? fileName;
        showScreenshotNotice({ success: true, message: t("player.screenshotSaved", { name: savedName }) });
      } catch {
        showScreenshotNotice({ success: false, message: t("player.screenshotFailed") });
      }
      return;
    }
    const video = videoRef.current;
    if (!video || playbackError || !video.videoWidth || !video.videoHeight || video.readyState < 2) {
      showScreenshotNotice({ success: false, message: t("player.screenshotUnavailable") });
      return;
    }
    try {
      const pngData = await captureVideoFrame(video, subtitleText, subtitleFontSize);
      const fileName = screenshotFileName(media.name, new Date(), video.currentTime);
      const savedPath = await saveScreenshot(screenshotDirectory, fileName, pngData);
      const savedName = savedPath.split(/[\\/]/).pop() ?? fileName;
      showScreenshotNotice({ success: true, message: t("player.screenshotSaved", { name: savedName }) });
    } catch {
      showScreenshotNotice({ success: false, message: t("player.screenshotFailed") });
    }
  };

  useImperativeHandle(ref, () => ({
    pause,
    togglePlayback,
    seek,
    changeVolume,
    toggleMute,
    toggleSubtitles,
    toggleFullscreen,
    captureScreenshot,
    changePlaybackRate,
    enterFocusMode,
    exitFocusMode,
    isFocusMode: () => focusMode,
    clearSubtitles,
  }));

  useEffect(() => {
    if (nativePlayback) return;
    const video = videoRef.current;
    if (video) video.volume = volume;
  }, [nativePlayback, volume]);

  useEffect(() => {
    if (!nativePlayback) return;
    let active = true;
    let previousStatus: NativeVideoState["status"] = "initializing";
    setPlaybackError(false);
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setVideoAspectRatio(16 / 9);
    setNativeSessionReady(0);
    loadedSubtitlePathRef.current = "";
    progressRef.current = { position: 0, duration: 0 };
    lastProgressReportAtRef.current = Date.now();

    const session = createNativeVideoSession(media.path, nativeResumeRef.current.position, (state) => {
      if (!active) return;
      const isPlaying = state.status === "playing";
      progressRef.current = { position: state.currentTime, duration: state.duration };
      setPlaying(isPlaying);
      setCurrentTime(state.currentTime);
      setDuration(state.duration);
      volumeRef.current = state.volume;
      mutedRef.current = state.muted;
      playbackRateRef.current = state.playbackRate;
      setVolume(state.volume);
      setMuted(state.muted);
      setPlaybackRate(state.playbackRate);
      setPlaybackError(state.status === "error");
      if (["ready", "playing", "paused", "ended"].includes(state.status)) {
        setNativeSessionReady(state.sessionId);
      }
      if (state.videoWidth > 0 && state.videoHeight > 0) {
        setVideoAspectRatio(state.videoWidth / state.videoHeight);
      }

      const now = Date.now();
      if (state.status === "playing" && state.duration > 0
        && now - lastProgressReportAtRef.current >= 10_000) {
        lastProgressReportAtRef.current = now;
        reportProgress();
      }
      if (previousStatus === "playing" && state.paused) reportProgress();
      if (state.status === "ended") reportProgress();
      previousStatus = state.status;
    });
    nativeSessionRef.current = session;
    return () => {
      active = false;
      if (nativeSessionRef.current === session) nativeSessionRef.current = null;
      void session.dispose();
    };
  }, [media.path, nativePlayback]);

  useEffect(() => {
    if (!nativePlayback || !nativeSessionReady) return;
    const session = nativeSessionRef.current;
    const frame = videoFrameRef.current;
    if (!session || !frame) return;
    let frameRequest = 0;
    let previous = "";
    const updateMargins = () => {
      frameRequest = 0;
      const rect = frame.getBoundingClientRect();
      if (window.innerWidth <= 0 || window.innerHeight <= 0) return;
      const margins = {
        left: rect.left / window.innerWidth,
        right: 1 - rect.right / window.innerWidth,
        top: rect.top / window.innerHeight,
        bottom: 1 - rect.bottom / window.innerHeight,
      };
      const serialized = JSON.stringify(margins);
      if (serialized === previous) return;
      previous = serialized;
      void session.setVideoMargins(margins).catch(() => undefined);
    };
    const scheduleUpdate = () => {
      if (frameRequest) window.cancelAnimationFrame(frameRequest);
      frameRequest = window.requestAnimationFrame(updateMargins);
    };
    const resizeObserver = new ResizeObserver(scheduleUpdate);
    resizeObserver.observe(frame);
    window.addEventListener("resize", scheduleUpdate);
    document.addEventListener("fullscreenchange", scheduleUpdate);
    scheduleUpdate();
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", scheduleUpdate);
      document.removeEventListener("fullscreenchange", scheduleUpdate);
      if (frameRequest) window.cancelAnimationFrame(frameRequest);
    };
  }, [focusMode, nativePlayback, nativeSessionReady, videoAspectRatio]);

  useEffect(() => {
    if (!nativePlayback || !nativeSessionReady) return;
    const session = nativeSessionRef.current;
    if (!session) return;
    void Promise.all([
      session.setSubtitlesEnabled(subtitlesEnabled),
      session.setSubtitleScale(NATIVE_SUBTITLE_SCALE[subtitleFontSize]),
    ]).catch(() => undefined);
  }, [nativePlayback, nativeSessionReady, subtitleFontSize, subtitlesEnabled]);

  useEffect(() => {
    if (!nativePlayback || !nativeSessionReady || !subtitlePath) return;
    const session = nativeSessionRef.current;
    if (!session || loadedSubtitlePathRef.current === subtitlePath) return;
    loadedSubtitlePathRef.current = subtitlePath;
    void session.loadSubtitle(subtitlePath).catch(() => {
      loadedSubtitlePathRef.current = "";
    });
  }, [nativePlayback, nativeSessionReady, subtitlePath]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (focusMode && focusRequestedFullscreenRef.current && !document.fullscreenElement) {
        focusRequestedFullscreenRef.current = false;
        focusModeRef.current = false;
        setFocusMode(false);
      }
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [focusMode]);

  useEffect(() => () => {
    focusModeRef.current = false;
    reportProgress();
    if (playbackOsdTimerRef.current !== null) window.clearTimeout(playbackOsdTimerRef.current);
    if (screenshotNoticeTimerRef.current !== null) window.clearTimeout(screenshotNoticeTimerRef.current);
    if (focusRequestedFullscreenRef.current) void setAppFullscreen(false).catch(() => undefined);
  }, []);

  const syncSubtitleAt = useCallback((time: number) => {
    const next = subtitlesEnabled ? activeSubtitle(subtitleCues, time) : "";
    setSubtitleText((current) => current === next ? current : next);
  }, [subtitleCues, subtitlesEnabled]);

  useEffect(() => {
    if (nativePlayback) {
      setSubtitleText("");
      return;
    }
    const syncSubtitle = () => syncSubtitleAt(videoRef.current?.currentTime ?? 0);
    syncSubtitle();
    if (!playing || !subtitlesEnabled || subtitleCues.length === 0) return;
    const timer = window.setInterval(syncSubtitle, 100);
    return () => window.clearInterval(timer);
  }, [nativePlayback, playing, subtitleCues.length, subtitlesEnabled, syncSubtitleAt]);

  const videoFrameStyle = {
    "--video-aspect": String(videoAspectRatio),
  } as CSSProperties;
  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 0.55 ? Volume1 : Volume2;

  return (
    <main className={focusMode ? "player-shell focus-mode" : "player-shell"}>
      <div className="video-viewport" onClick={togglePlayback}>
        <div ref={videoFrameRef} className="video-frame" style={videoFrameStyle}>
          {!nativePlayback && (
            <video
              ref={videoRef}
              className="video-surface"
              crossOrigin="anonymous"
              src={source || undefined}
              autoPlay={Boolean(source)}
              onPlay={() => setPlaying(true)}
              onPause={() => {
                setPlaying(false);
                reportProgress();
              }}
              onTimeUpdate={(event) => {
                const time = event.currentTarget.currentTime;
                const videoDuration = event.currentTarget.duration || duration;
                progressRef.current = { position: time, duration: videoDuration };
                setCurrentTime(time);
                syncSubtitleAt(time);
                const now = Date.now();
                if (now - lastProgressReportAtRef.current >= 10_000) {
                  lastProgressReportAtRef.current = now;
                  reportProgress();
                }
              }}
              onDurationChange={(event) => {
                const videoDuration = event.currentTarget.duration;
                progressRef.current.duration = videoDuration;
                setDuration(videoDuration);
              }}
              onLoadedMetadata={(event) => {
                const video = event.currentTarget;
                video.playbackRate = playbackRate;
                progressRef.current.duration = video.duration;
                if (resumePosition >= 5 && resumePosition < video.duration - 15) {
                  video.currentTime = resumePosition;
                  progressRef.current.position = resumePosition;
                  setCurrentTime(resumePosition);
                }
                if (video.videoWidth > 0 && video.videoHeight > 0) {
                  setVideoAspectRatio(video.videoWidth / video.videoHeight);
                }
              }}
              onEnded={(event) => {
                progressRef.current = {
                  position: event.currentTarget.duration,
                  duration: event.currentTarget.duration,
                };
                reportProgress();
              }}
              onRateChange={(event) => {
                playbackRateRef.current = event.currentTarget.playbackRate;
                setPlaybackRate(event.currentTarget.playbackRate);
              }}
              onVolumeChange={(event) => {
                volumeRef.current = event.currentTarget.volume;
                mutedRef.current = event.currentTarget.muted;
                setVolume(event.currentTarget.volume);
                setMuted(event.currentTarget.muted);
              }}
              onError={() => setPlaybackError(true)}
            />
          )}
        </div>
      </div>
      {!nativePlayback && !source && <div className="player-placeholder"><FilmMark /><strong>{media.name}</strong><span>{t("player.localPreview")}</span></div>}
      {playbackError && <div className="player-error"><strong>{t("player.videoDecodeFailed")}</strong><span>{t("player.videoUnsupported")}</span></div>}
      {!nativePlayback && subtitleText && (
        <div className={`subtitle-overlay subtitle-size-${subtitleFontSize}`}>{subtitleText}</div>
      )}
      {playbackOsd && (
        <div className={`player-osd ${playbackOsd.kind}`} role="status" aria-live="polite">
          {playbackOsd.kind === "speed" ? <Gauge aria-hidden="true" /> : <VolumeIcon aria-hidden="true" />}
          <strong>
            {playbackOsd.kind === "speed"
              ? t("player.speedOsd", { value: playbackOsd.value })
              : playbackOsd.muted
                ? t("player.mutedOsd")
                : t("player.volumeOsd", { value: Math.round(playbackOsd.value * 100) })}
          </strong>
          {playbackOsd.kind === "volume" && (
            <span className="player-osd-meter"><i style={{ width: `${playbackOsd.muted ? 0 : playbackOsd.value * 100}%` }} /></span>
          )}
        </div>
      )}
      {screenshotNotice && (
        <div className={screenshotNotice.success ? "screenshot-notice success" : "screenshot-notice error"} role="status">
          {screenshotNotice.success ? <CheckCircle2 aria-hidden="true" /> : <CircleAlert aria-hidden="true" />}
          <span>{screenshotNotice.message}</span>
        </div>
      )}

      <div className="player-topbar" aria-hidden={focusMode}>
        <button type="button" className="icon-button" onClick={() => { reportProgress(); onClose(); }} title={t("player.close")}><X aria-hidden="true" /></button>
        <div><strong>{media.name}</strong><span>{subtitleName || t("player.noSubtitle")}</span></div>
      </div>

      <div className="player-controls" aria-hidden={focusMode}>
        <input
          className="progress"
          type="range"
          min="0"
          max={duration || 0}
          step="0.1"
          value={Math.min(currentTime, duration || 0)}
          onChange={(event) => {
            const position = Number(event.target.value);
            if (nativePlayback) {
              void nativeSessionRef.current?.seekAbsolute(position).catch(() => undefined);
            } else if (videoRef.current) {
              videoRef.current.currentTime = position;
            }
          }}
          aria-label={t("player.progress")}
        />
        <div className="control-row">
          <div className="control-group">
            <button type="button" className="icon-button" onClick={() => seek(-10)} title={t("common.rewind10")}><RotateCcw aria-hidden="true" /></button>
            <button type="button" className="play-button" onClick={togglePlayback} title={playing ? t("common.pause") : t("common.play")}>{playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}</button>
            <button type="button" className="icon-button" onClick={() => seek(10)} title={t("common.forward10")}><RotateCw aria-hidden="true" /></button>
            <span className="timecode">{formatDuration(currentTime)} <i>/</i> {formatDuration(duration)}</span>
          </div>
          <div className="control-group end">
            <div className="speed-control" aria-label={t("player.speed", { value: playbackRate })}>
              <button type="button" onClick={() => changePlaybackRate(-1)} title={t("player.speedDown")}><Minus aria-hidden="true" /></button>
              <button type="button" className="speed-value" onClick={resetPlaybackRate} title={t("player.speedReset")}>{playbackRate}×</button>
              <button type="button" onClick={() => changePlaybackRate(1)} title={t("player.speedUp")}><Plus aria-hidden="true" /></button>
            </div>
            <button type="button" className="icon-button" onClick={toggleMute} title={muted ? t("common.unmute") : t("common.mute")}><VolumeIcon aria-hidden="true" /></button>
            <div className="volume-meter" aria-label={t("audio.volume", { value: Math.round(volume * 100) })}><span style={{ width: `${muted ? 0 : volume * 100}%` }} /></div>
            <button type="button" className={subtitlesEnabled && (nativePlayback || subtitleCues.length) ? "icon-button active" : "icon-button"} onClick={nativePlayback || subtitleCues.length ? toggleSubtitles : onPickSubtitle} title={nativePlayback || subtitleCues.length ? t("player.subtitleToggle") : t("player.importSubtitle")}>
              {subtitlesEnabled ? <Captions aria-hidden="true" /> : <CaptionsOff aria-hidden="true" />}
            </button>
            <button type="button" className="icon-button" onClick={onPickSubtitle} title={t("player.importSubtitle")}><span className="small-label">SRT</span></button>
            <button type="button" className="icon-button" onClick={() => void captureScreenshot()} title={t("player.screenshot")}><Camera aria-hidden="true" /></button>
            <button type="button" className="icon-button" onClick={enterFocusMode} title={t("player.focusMode")}><Focus aria-hidden="true" /></button>
            <button type="button" className="icon-button" onClick={toggleFullscreen} title={t("common.fullscreen")}><Maximize aria-hidden="true" /></button>
          </div>
        </div>
      </div>
    </main>
  );
});

function FilmMark() {
  return <div className="film-mark" aria-hidden="true"><Play /></div>;
}
