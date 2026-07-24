import {
  AudioLines,
  ListMusic,
  ListOrdered,
  LoaderCircle,
  Maximize,
  MonitorOff,
  Music2,
  Pause,
  Play,
  Repeat1,
  RotateCcw,
  RotateCw,
  Shuffle,
  SkipBack,
  SkipForward,
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
  useMemo,
  useRef,
  useState,
} from "react";
import { formatDuration } from "../lib/format";
import { activeLyricsIndex, parseEmbeddedLyrics } from "../lib/lyrics";
import { useI18n } from "../i18n";
import type { AudioMetadata, AudioPlaybackMode, FileEntry } from "../types";

export interface AudioPlayerHandle {
  pause: () => void;
  togglePlayback: () => void;
  seek: (amount: number) => void;
  changeVolume: (amount: number) => void;
  toggleMute: () => void;
  toggleFullscreen: () => void;
  restart: () => void;
  toggleQueue: () => void;
  toggleSpectrum: () => void;
  enterBlackout: () => void;
  exitBlackout: () => boolean;
}

interface AudioPlayerProps {
  media: FileEntry;
  source: string;
  metadata: AudioMetadata;
  metadataLoading: boolean;
  queue: FileEntry[];
  queueLoading: boolean;
  position: number;
  total: number;
  mode: AudioPlaybackMode;
  onModeChange: (mode: AudioPlaybackMode) => void;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onEnded: () => void;
  onSelectTrack: (track: FileEntry) => void;
}

const SPECTRUM_BARS = 42;

export const AudioPlayer = forwardRef<AudioPlayerHandle, AudioPlayerProps>(function AudioPlayer(
  {
    media,
    source,
    metadata,
    metadataLoading,
    queue,
    queueLoading,
    position,
    total,
    mode,
    onModeChange,
    onClose,
    onPrevious,
    onNext,
    onEnded,
    onSelectTrack,
  },
  ref,
) {
  const { t } = useI18n();
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lyricsRefs = useRef<Array<HTMLParagraphElement | null>>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const blackoutFullscreenRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [playbackError, setPlaybackError] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [spectrumEnabled, setSpectrumEnabled] = useState(false);
  const [spectrumAvailable, setSpectrumAvailable] = useState(true);
  const [blackout, setBlackout] = useState(false);
  const [coverFailed, setCoverFailed] = useState(false);

  const ensureSpectrum = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !spectrumAvailable) return;
    try {
      if (!audioContextRef.current) {
        const context = new AudioContext();
        const analyser = context.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.78;
        const sourceNode = context.createMediaElementSource(audio);
        sourceNode.connect(analyser);
        analyser.connect(context.destination);
        audioContextRef.current = context;
        analyserRef.current = analyser;
        sourceNodeRef.current = sourceNode;
      }
      if (audioContextRef.current.state === "suspended") {
        await audioContextRef.current.resume();
      }
    } catch {
      setSpectrumAvailable(false);
      setSpectrumEnabled(false);
    }
  }, [spectrumAvailable]);

  const pause = () => audioRef.current?.pause();
  const togglePlayback = () => {
    const audio = audioRef.current;
    if (!audio || !source || playbackError) return;
    if (audio.paused) {
      if (spectrumEnabled) void ensureSpectrum();
      void audio.play();
    } else {
      audio.pause();
    }
  };
  const seek = (amount: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.min(Math.max(0, audio.currentTime + amount), audio.duration || Number.MAX_SAFE_INTEGER);
  };
  const changeVolume = (amount: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const next = Math.min(1, Math.max(0, audio.volume + amount));
    audio.volume = next;
    audio.muted = false;
    setMuted(false);
    setVolume(next);
  };
  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !audio.muted;
    setMuted(audio.muted);
  };
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen();
  };
  const restart = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    void audio.play();
  };
  const toggleQueue = () => setQueueOpen((open) => !open);
  const toggleSpectrum = () => {
    setSpectrumEnabled((enabled) => {
      const next = !enabled;
      if (next) void ensureSpectrum();
      return next;
    });
  };
  const enterBlackout = () => {
    if (blackout) return;
    blackoutFullscreenRef.current = !document.fullscreenElement;
    setBlackout(true);
    if (blackoutFullscreenRef.current) {
      void document.documentElement.requestFullscreen().catch(() => {
        blackoutFullscreenRef.current = false;
      });
    }
  };
  const exitBlackout = () => {
    if (!blackout) return false;
    setBlackout(false);
    if (blackoutFullscreenRef.current && document.fullscreenElement) void document.exitFullscreen();
    blackoutFullscreenRef.current = false;
    return true;
  };

  useImperativeHandle(ref, () => ({
    pause,
    togglePlayback,
    seek,
    changeVolume,
    toggleMute,
    toggleFullscreen,
    restart,
    toggleQueue,
    toggleSpectrum,
    enterBlackout,
    exitBlackout,
  }));

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.volume = volume;
  }, [volume]);

  useEffect(() => {
    setCurrentTime(0);
    setDuration(0);
    setPlaybackError(false);
    setCoverFailed(false);
    const audio = audioRef.current;
    if (audio && source) {
      audio.load();
      void audio.play().catch(() => undefined);
    }
  }, [media.path, source]);

  useEffect(() => () => {
    if (audioContextRef.current) void audioContextRef.current.close();
  }, []);

  useEffect(() => {
    if (!blackout) return;
    const leaveBlackout = (event: KeyboardEvent | PointerEvent) => {
      event.preventDefault();
      event.stopPropagation();
      exitBlackout();
    };
    window.addEventListener("keydown", leaveBlackout, true);
    window.addEventListener("pointerdown", leaveBlackout, true);
    return () => {
      window.removeEventListener("keydown", leaveBlackout, true);
      window.removeEventListener("pointerdown", leaveBlackout, true);
    };
  }, [blackout]);

  useEffect(() => {
    if (!spectrumEnabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const analyser = analyserRef.current;
    const frequencyData = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;
    let frame = 0;

    const draw = () => {
      const bounds = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      const width = Math.max(1, Math.round(bounds.width * ratio));
      const height = Math.max(1, Math.round(bounds.height * ratio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      context.clearRect(0, 0, width, height);
      if (analyser && frequencyData) analyser.getByteFrequencyData(frequencyData);
      const gap = 3 * ratio;
      const barWidth = Math.max(2 * ratio, (width - gap * (SPECTRUM_BARS - 1)) / SPECTRUM_BARS);
      for (let index = 0; index < SPECTRUM_BARS; index += 1) {
        const sampleIndex = frequencyData
          ? Math.min(frequencyData.length - 1, Math.floor((index / SPECTRUM_BARS) * frequencyData.length * 0.72))
          : 0;
        const level = frequencyData ? frequencyData[sampleIndex] / 255 : 0;
        const barHeight = Math.max(3 * ratio, level * height * 0.92);
        context.fillStyle = index % 5 === 0 ? "#67c8d4" : "#72d6a0";
        context.fillRect(index * (barWidth + gap), height - barHeight, barWidth, barHeight);
      }
      frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [media.path, playing, spectrumEnabled]);

  const lyrics = useMemo(() => parseEmbeddedLyrics(metadata.lyrics), [metadata.lyrics]);
  const activeLine = activeLyricsIndex(lyrics, currentTime, duration);
  const displayedLyrics = useMemo(() => {
    if (!spectrumEnabled || activeLine < 0) {
      return lyrics.lines.map((line, index) => ({ line, index }));
    }
    const start = Math.min(activeLine, Math.max(0, lyrics.lines.length - 2));
    return lyrics.lines.slice(start, start + 2).map((line, offset) => ({
      line,
      index: start + offset,
    }));
  }, [activeLine, lyrics, spectrumEnabled]);

  useEffect(() => {
    if (spectrumEnabled) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    lyricsRefs.current[activeLine]?.scrollIntoView({ block: "center", behavior: reducedMotion ? "auto" : "smooth" });
  }, [activeLine, spectrumEnabled]);

  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 0.55 ? Volume1 : Volume2;
  const displayTitle = metadata.title || media.name;
  const showCover = Boolean(metadata.coverArt) && !coverFailed;

  return (
    <main className="audio-shell">
      <audio
        ref={audioRef}
        crossOrigin="anonymous"
        src={source || undefined}
        autoPlay={Boolean(source)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onDurationChange={(event) => setDuration(event.currentTarget.duration)}
        onVolumeChange={(event) => {
          setVolume(event.currentTarget.volume);
          setMuted(event.currentTarget.muted);
        }}
        onEnded={onEnded}
        onError={() => setPlaybackError(true)}
      />

      <div className="media-topbar audio-topbar">
        <button type="button" className="icon-button" onClick={onClose} title={t("audio.close")}><X aria-hidden="true" /></button>
        <div className="audio-topbar-copy"><strong>{displayTitle}</strong><span>{metadata.artist || media.extension || t("common.audio")} · {position} / {total}</span></div>
        <div className="audio-topbar-actions">
          <button type="button" className={queueOpen ? "icon-button active" : "icon-button"} onClick={toggleQueue} title={t("audio.queue")}><ListMusic aria-hidden="true" /></button>
          <button type="button" className="icon-button" onClick={enterBlackout} title={t("audio.blackout")}><MonitorOff aria-hidden="true" /></button>
        </div>
      </div>

      <div className={queueOpen ? "audio-workspace queue-open" : "audio-workspace"}>
        <section className="audio-identity" aria-label={t("audio.current")}>
          <div className={`${playing ? "audio-mark playing" : "audio-mark"}${showCover ? " has-cover" : ""}`}>
            {showCover ? (
              <img src={metadata.coverArt ?? undefined} alt={t("audio.cover", { title: displayTitle })} onError={() => setCoverFailed(true)} />
            ) : (
              <Music2 aria-label={t("audio.defaultCover")} />
            )}
          </div>
          <div className="audio-title">
            <span>{playing ? t("audio.playing") : t("audio.paused")}</span>
            <h1>{displayTitle}</h1>
            <p>{metadata.artist || t("audio.unknownArtist")}</p>
            <small>{metadata.album || media.path}</small>
          </div>
          {playbackError && <div className="media-inline-error"><strong>{t("audio.decodeFailed")}</strong><span>{t("audio.unsupported")}</span></div>}
          {!source && <div className="media-preview-note">{t("player.localPreview")}</div>}
        </section>

        <section className={spectrumEnabled ? "audio-visuals spectrum-on" : "audio-visuals"}>
          {spectrumEnabled && <div className="spectrum-panel enabled" aria-label={t("audio.spectrum")}><canvas ref={canvasRef} /></div>}
          <div className="lyrics-panel" aria-label={t("audio.lyrics")}>
            {metadataLoading ? (
              <div className="lyrics-state"><LoaderCircle className="spin" aria-hidden="true" /><span>{t("audio.lyricsLoading")}</span></div>
            ) : lyrics.lines.length === 0 ? (
              <div className="lyrics-state"><Music2 aria-hidden="true" /><span>{t("audio.noLyrics")}</span></div>
            ) : (
              <div className={spectrumEnabled ? "lyrics-scroll condensed" : "lyrics-scroll"}>
                {displayedLyrics.map(({ line, index }) => (
                  <p
                    className={index === activeLine ? "active" : ""}
                    key={`${line.time ?? "plain"}-${index}`}
                    ref={(element) => { lyricsRefs.current[index] = element; }}
                  >{line.text}</p>
                ))}
              </div>
            )}
          </div>
        </section>

        {queueOpen && (
          <aside className="audio-queue" aria-label={t("audio.queue")}>
            <header><strong>{t("audio.queue")}</strong><span>{queueLoading ? t("audio.scanning") : t("audio.trackCount", { count: total })}</span></header>
            <div className="audio-queue-list" role="listbox" aria-label={t("audio.songQueue")}>
              {queue.map((track, index) => (
                <button
                  type="button"
                  role="option"
                  aria-selected={track.path === media.path}
                  className={track.path === media.path ? "audio-queue-item active" : "audio-queue-item"}
                  key={track.path}
                  onClick={() => onSelectTrack(track)}
                >
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div><strong>{track.name}</strong><small>{track.extension ?? t("common.audio")}</small></div>
                </button>
              ))}
            </div>
          </aside>
        )}
      </div>

      <div className="audio-controls">
        <input
          className="progress audio-progress"
          type="range"
          min="0"
          max={duration || 0}
          step="0.1"
          value={Math.min(currentTime, duration || 0)}
          onChange={(event) => {
            if (audioRef.current) audioRef.current.currentTime = Number(event.target.value);
          }}
          aria-label={t("player.progress")}
        />
        <div className="control-row">
          <div className="control-group audio-transport">
            <button type="button" className="icon-button" onClick={onPrevious} title={t("audio.previousTrack")}><SkipBack aria-hidden="true" /></button>
            <button type="button" className="icon-button" onClick={() => seek(-10)} title={t("common.rewind10")}><RotateCcw aria-hidden="true" /></button>
            <button type="button" className="play-button audio-play-button" onClick={togglePlayback} title={playing ? t("common.pause") : t("common.play")}>{playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}</button>
            <button type="button" className="icon-button" onClick={() => seek(10)} title={t("common.forward10")}><RotateCw aria-hidden="true" /></button>
            <button type="button" className="icon-button" onClick={onNext} title={t("audio.nextTrack")}><SkipForward aria-hidden="true" /></button>
            <span className="timecode">{formatDuration(currentTime)} <i>/</i> {formatDuration(duration)}</span>
          </div>
          <div className="control-group end audio-options">
            <div className="play-mode-control" aria-label={t("audio.mode")}>
              <button type="button" className={mode === "sequence" ? "active" : ""} aria-pressed={mode === "sequence"} onClick={() => onModeChange("sequence")} title={t("audio.sequence")}><ListOrdered aria-hidden="true" /></button>
              <button type="button" className={mode === "shuffle" ? "active" : ""} aria-pressed={mode === "shuffle"} onClick={() => onModeChange("shuffle")} title={t("audio.shuffle")}><Shuffle aria-hidden="true" /></button>
              <button type="button" className={mode === "repeatOne" ? "active" : ""} aria-pressed={mode === "repeatOne"} onClick={() => onModeChange("repeatOne")} title={t("audio.repeatOne")}><Repeat1 aria-hidden="true" /></button>
            </div>
            <button type="button" className={spectrumEnabled ? "icon-button active" : "icon-button"} onClick={toggleSpectrum} disabled={!spectrumAvailable} title={t("audio.spectrumToggle")}><AudioLines aria-hidden="true" /></button>
            <button type="button" className="icon-button" onClick={toggleMute} title={muted ? t("common.unmute") : t("common.mute")}><VolumeIcon aria-hidden="true" /></button>
            <div className="volume-meter" aria-label={t("audio.volume", { value: Math.round(volume * 100) })}><span style={{ width: `${muted ? 0 : volume * 100}%` }} /></div>
            <button type="button" className="icon-button" onClick={toggleFullscreen} title={t("common.fullscreen")}><Maximize aria-hidden="true" /></button>
          </div>
        </div>
      </div>

      {blackout && <div className="audio-blackout" role="dialog" aria-label={t("audio.blackout")} />}
    </main>
  );
});
