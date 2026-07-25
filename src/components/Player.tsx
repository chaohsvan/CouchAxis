import {
  Captions,
  CaptionsOff,
  Camera,
  CheckCircle2,
  CircleAlert,
  Focus,
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
import { isAppFullscreen, saveScreenshot, setAppFullscreen } from "../services/desktop";
import { useI18n } from "../i18n";
import type { FileEntry, SubtitleCue } from "../types";

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
}

interface PlayerProps {
  media: FileEntry;
  source: string;
  subtitleName: string;
  subtitleCues: SubtitleCue[];
  screenshotDirectory: string;
  onClose: () => void;
  onPickSubtitle: () => void;
}

export const Player = forwardRef<PlayerHandle, PlayerProps>(function Player(
  { media, source, subtitleName, subtitleCues, screenshotDirectory, onClose, onPickSubtitle },
  ref,
) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
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
  const [screenshotNotice, setScreenshotNotice] = useState<{ success: boolean; message: string } | null>(null);
  const screenshotNoticeTimerRef = useRef<number | null>(null);
  const focusRequestedFullscreenRef = useRef(false);
  const focusModeRef = useRef(false);
  const fullscreenTransitionRef = useRef(false);
  const [focusMode, setFocusMode] = useState(false);

  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video || playbackError) return;
    if (video.paused) void video.play();
    else video.pause();
  };
  const pause = () => videoRef.current?.pause();
  const seek = (amount: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.min(Math.max(0, video.currentTime + amount), video.duration || Number.MAX_SAFE_INTEGER);
  };
  const changeVolume = (amount: number) => {
    const video = videoRef.current;
    if (!video) return;
    const next = Math.min(1, Math.max(0, video.volume + amount));
    video.volume = next;
    video.muted = false;
    setMuted(false);
    setVolume(next);
  };
  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  };
  const toggleSubtitles = () => setSubtitlesEnabled((enabled) => !enabled);
  const changePlaybackRate = (direction: -1 | 1) => {
    setPlaybackRate((current) => {
      const next = stepPlaybackRate(current, direction);
      if (videoRef.current) videoRef.current.playbackRate = next;
      return next;
    });
  };
  const resetPlaybackRate = () => {
    if (videoRef.current) videoRef.current.playbackRate = 1;
    setPlaybackRate(1);
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
    const video = videoRef.current;
    if (!video || playbackError || !video.videoWidth || !video.videoHeight || video.readyState < 2) {
      showScreenshotNotice({ success: false, message: t("player.screenshotUnavailable") });
      return;
    }
    try {
      const pngData = await captureVideoFrame(video, subtitleText);
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
  }));

  useEffect(() => {
    const video = videoRef.current;
    if (video) video.volume = volume;
  }, [volume]);

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
    if (screenshotNoticeTimerRef.current !== null) window.clearTimeout(screenshotNoticeTimerRef.current);
    if (focusRequestedFullscreenRef.current) void setAppFullscreen(false).catch(() => undefined);
  }, []);

  const syncSubtitleAt = useCallback((time: number) => {
    const next = subtitlesEnabled ? activeSubtitle(subtitleCues, time) : "";
    setSubtitleText((current) => current === next ? current : next);
  }, [subtitleCues, subtitlesEnabled]);

  useEffect(() => {
    const syncSubtitle = () => syncSubtitleAt(videoRef.current?.currentTime ?? 0);
    syncSubtitle();
    if (!playing || !subtitlesEnabled || subtitleCues.length === 0) return;
    const timer = window.setInterval(syncSubtitle, 100);
    return () => window.clearInterval(timer);
  }, [playing, subtitleCues.length, subtitlesEnabled, syncSubtitleAt]);

  const videoFrameStyle = {
    "--video-aspect": String(videoAspectRatio),
  } as CSSProperties;
  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 0.55 ? Volume1 : Volume2;

  return (
    <main className={focusMode ? "player-shell focus-mode" : "player-shell"}>
      <div className="video-viewport" onClick={togglePlayback}>
        <div className="video-frame" style={videoFrameStyle}>
          <video
            ref={videoRef}
            className="video-surface"
            crossOrigin="anonymous"
            src={source || undefined}
            autoPlay={Boolean(source)}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onTimeUpdate={(event) => {
              const time = event.currentTarget.currentTime;
              setCurrentTime(time);
              syncSubtitleAt(time);
            }}
            onDurationChange={(event) => setDuration(event.currentTarget.duration)}
            onLoadedMetadata={(event) => {
              const video = event.currentTarget;
              video.playbackRate = playbackRate;
              if (video.videoWidth > 0 && video.videoHeight > 0) {
                setVideoAspectRatio(video.videoWidth / video.videoHeight);
              }
            }}
            onRateChange={(event) => setPlaybackRate(event.currentTarget.playbackRate)}
            onVolumeChange={(event) => {
              setVolume(event.currentTarget.volume);
              setMuted(event.currentTarget.muted);
            }}
            onError={() => setPlaybackError(true)}
          />
        </div>
      </div>
      {!source && <div className="player-placeholder"><FilmMark /><strong>{media.name}</strong><span>{t("player.localPreview")}</span></div>}
      {playbackError && <div className="player-error"><strong>{t("player.videoDecodeFailed")}</strong><span>{t("player.videoUnsupported")}</span></div>}
      {subtitleText && <div className="subtitle-overlay">{subtitleText}</div>}
      {screenshotNotice && (
        <div className={screenshotNotice.success ? "screenshot-notice success" : "screenshot-notice error"} role="status">
          {screenshotNotice.success ? <CheckCircle2 aria-hidden="true" /> : <CircleAlert aria-hidden="true" />}
          <span>{screenshotNotice.message}</span>
        </div>
      )}

      {!focusMode && <div className="player-topbar">
        <button type="button" className="icon-button" onClick={onClose} title={t("player.close")}><X aria-hidden="true" /></button>
        <div><strong>{media.name}</strong><span>{subtitleName || t("player.noSubtitle")}</span></div>
      </div>}

      {!focusMode && <div className="player-controls">
        <input
          className="progress"
          type="range"
          min="0"
          max={duration || 0}
          step="0.1"
          value={Math.min(currentTime, duration || 0)}
          onChange={(event) => {
            if (videoRef.current) videoRef.current.currentTime = Number(event.target.value);
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
            <button type="button" className={subtitlesEnabled && subtitleCues.length ? "icon-button active" : "icon-button"} onClick={subtitleCues.length ? toggleSubtitles : onPickSubtitle} title={subtitleCues.length ? t("player.subtitleToggle") : t("player.importSubtitle")}>
              {subtitlesEnabled ? <Captions aria-hidden="true" /> : <CaptionsOff aria-hidden="true" />}
            </button>
            <button type="button" className="icon-button" onClick={onPickSubtitle} title={t("player.importSubtitle")}><span className="small-label">SRT</span></button>
            <button type="button" className="icon-button" onClick={() => void captureScreenshot()} title={t("player.screenshot")}><Camera aria-hidden="true" /></button>
            <button type="button" className="icon-button" onClick={enterFocusMode} title={t("player.focusMode")}><Focus aria-hidden="true" /></button>
            <button type="button" className="icon-button" onClick={toggleFullscreen} title={t("common.fullscreen")}><Maximize aria-hidden="true" /></button>
          </div>
        </div>
      </div>}
    </main>
  );
});

function FilmMark() {
  return <div className="film-mark" aria-hidden="true"><Play /></div>;
}
