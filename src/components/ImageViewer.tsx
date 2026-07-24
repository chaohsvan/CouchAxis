import {
  ChevronLeft,
  ChevronRight,
  Focus,
  Image as ImageIcon,
  Lock,
  Maximize,
  RefreshCw,
  RotateCw,
  Unlock,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { useI18n } from "../i18n";
import { clampImagePan, imageViewportMetrics, mangaStartPan, type ViewPoint, type ViewSize } from "../lib/imageViewport";
import { isAppFullscreen, setAppFullscreen } from "../services/desktop";
import type { FileEntry, MangaStartSide } from "../types";

export interface ImageViewerHandle {
  zoom: (amount: number) => void;
  startZoom: (direction: -1 | 1) => void;
  stopZoom: () => void;
  pan: (x: number, y: number) => void;
  navigate: (direction: -1 | 1) => void;
  rotate: () => void;
  reset: () => void;
  toggleScaleLock: () => void;
  toggleFullscreen: () => void;
  enterFocusMode: () => void;
  exitFocusMode: () => void;
  isFocusMode: () => boolean;
}

interface ImageViewerProps {
  media: FileEntry;
  source: string;
  position: number;
  total: number;
  mangaStartSide: MangaStartSide;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
}

interface DragState {
  pointerId: number;
  x: number;
  y: number;
  pan: ViewPoint;
}

export const ImageViewer = forwardRef<ImageViewerHandle, ImageViewerProps>(function ImageViewer(
  { media, source, position, total, mangaStartSide, onClose, onPrevious, onNext },
  ref,
) {
  const { t } = useI18n();
  const stageRef = useRef<HTMLElement>(null);
  const anchorNextImageRef = useRef(false);
  const dragRef = useRef<DragState | null>(null);
  const zoomAnimationRef = useRef<number | null>(null);
  const zoomDirectionRef = useRef<-1 | 0 | 1>(0);
  const focusRequestedFullscreenRef = useRef(false);
  const focusModeRef = useRef(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [scaleLocked, setScaleLocked] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [pan, setPan] = useState<ViewPoint>({ x: 0, y: 0 });
  const [naturalSize, setNaturalSize] = useState<ViewSize | null>(null);
  const [stageSize, setStageSize] = useState<ViewSize>({ width: 1, height: 1 });
  const [imageError, setImageError] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [continuousZooming, setContinuousZooming] = useState(false);
  const [focusMode, setFocusMode] = useState(false);

  const metrics = useMemo(
    () => naturalSize ? imageViewportMetrics(naturalSize, stageSize, rotation, zoomLevel) : null,
    [naturalSize, rotation, stageSize, zoomLevel],
  );

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const updateSize = () => setStageSize({ width: stage.clientWidth, height: stage.clientHeight });
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (metrics) setPan((current) => clampImagePan(current, metrics));
  }, [metrics?.maxPanX, metrics?.maxPanY]);

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
    if (zoomAnimationRef.current !== null) cancelAnimationFrame(zoomAnimationRef.current);
    if (focusRequestedFullscreenRef.current) void setAppFullscreen(false).catch(() => undefined);
  }, []);

  const zoom = (amount: number) => {
    setZoomLevel((value) => Math.min(8, Math.max(0.5, Math.round((value + amount) * 100) / 100)));
  };
  const stopZoom = () => {
    zoomDirectionRef.current = 0;
    if (zoomAnimationRef.current !== null) {
      cancelAnimationFrame(zoomAnimationRef.current);
      zoomAnimationRef.current = null;
    }
    setContinuousZooming(false);
  };
  const startZoom = (direction: -1 | 1) => {
    if (zoomDirectionRef.current === direction) return;
    stopZoom();
    zoomDirectionRef.current = direction;
    setContinuousZooming(true);
    zoom(direction * 0.03);
    let previousTime = performance.now();
    const animate = (currentTime: number) => {
      if (zoomDirectionRef.current !== direction) return;
      const elapsed = Math.min(50, currentTime - previousTime);
      previousTime = currentTime;
      setZoomLevel((value) => Math.min(8, Math.max(0.5, value + direction * elapsed * 0.0009)));
      zoomAnimationRef.current = requestAnimationFrame(animate);
    };
    zoomAnimationRef.current = requestAnimationFrame(animate);
  };
  const moveImage = (x: number, y: number) => {
    if (!metrics) return;
    setPan((current) => clampImagePan({ x: current.x + x, y: current.y + y }, metrics));
  };
  const rotate = () => {
    setRotation((value) => (value + 90) % 360);
    setPan({ x: 0, y: 0 });
  };
  const reset = () => {
    setZoomLevel(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
  };
  const toggleScaleLock = () => setScaleLocked((locked) => !locked);
  const navigate = (direction: -1 | 1) => {
    stopZoom();
    anchorNextImageRef.current = scaleLocked && zoomLevel > 1;
    setNaturalSize(null);
    setImageError(false);
    setRotation(0);
    setPan({ x: 0, y: 0 });
    if (!scaleLocked) setZoomLevel(1);
    if (direction < 0) onPrevious();
    else onNext();
  };
  const toggleFullscreen = () => {
    void isAppFullscreen().then((fullscreen) => setAppFullscreen(!fullscreen)).catch(() => undefined);
  };
  const enterFocusMode = () => {
    stopZoom();
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
    stopZoom();
    focusModeRef.current = false;
    setFocusMode(false);
    if (focusRequestedFullscreenRef.current) void setAppFullscreen(false).catch(() => undefined);
    focusRequestedFullscreenRef.current = false;
  };

  useImperativeHandle(ref, () => ({
    zoom,
    startZoom,
    stopZoom,
    pan: moveImage,
    navigate,
    rotate,
    reset,
    toggleScaleLock,
    toggleFullscreen,
    enterFocusMode,
    exitFocusMode,
    isFocusMode: () => focusMode,
  }));

  const stageClassName = [
    "image-stage",
    metrics && (metrics.maxPanX > 0 || metrics.maxPanY > 0) ? "pannable" : "",
    dragging ? "dragging" : "",
    continuousZooming ? "continuous-zoom" : "",
  ].filter(Boolean).join(" ");

  return (
    <main className={focusMode ? "image-shell focus-mode" : "image-shell"}>
      {!focusMode && <div className="media-topbar">
        <button type="button" className="icon-button" onClick={onClose} title={t("image.close")}><X aria-hidden="true" /></button>
        <div>
          <strong>{media.name}</strong>
          <span>{media.extension ?? t("common.image")} · {position} / {total} · {scaleLocked ? t("image.scaleLocked") : t("image.scaleUnlocked")}</span>
        </div>
      </div>}

      <section
        ref={stageRef}
        className={stageClassName}
        onDoubleClick={reset}
        onWheel={(event) => {
          event.preventDefault();
          zoom(event.deltaY > 0 ? -0.2 : 0.2);
        }}
        onPointerDown={(event) => {
          if (!metrics || (!metrics.maxPanX && !metrics.maxPanY)) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, pan };
          setDragging(true);
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current;
          if (!drag || drag.pointerId !== event.pointerId || !metrics) return;
          setPan(clampImagePan({
            x: drag.pan.x + event.clientX - drag.x,
            y: drag.pan.y + event.clientY - drag.y,
          }, metrics));
        }}
        onPointerUp={(event) => {
          if (dragRef.current?.pointerId !== event.pointerId) return;
          dragRef.current = null;
          setDragging(false);
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
        onPointerCancel={(event) => {
          if (dragRef.current?.pointerId !== event.pointerId) return;
          dragRef.current = null;
          setDragging(false);
        }}
        onLostPointerCapture={(event) => {
          if (dragRef.current?.pointerId !== event.pointerId) return;
          dragRef.current = null;
          setDragging(false);
        }}
        aria-label={t("image.viewer")}
      >
        {source && !imageError ? (
          <img
            key={media.path}
            src={source}
            alt={media.name}
            draggable={false}
            style={{
              width: naturalSize ? `${naturalSize.width}px` : undefined,
              height: naturalSize ? `${naturalSize.height}px` : undefined,
              opacity: naturalSize ? 1 : 0,
              transform: metrics
                ? `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) rotate(${rotation}deg) scale(${metrics.renderScale})`
                : "translate(-50%, -50%)",
            }}
            onLoad={(event) => {
              const size = { width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight };
              setNaturalSize(size);
              if (anchorNextImageRef.current && scaleLocked && zoomLevel > 1) {
                const nextMetrics = imageViewportMetrics(size, stageSize, 0, zoomLevel);
                setPan(mangaStartPan(nextMetrics, mangaStartSide));
              } else {
                setPan({ x: 0, y: 0 });
              }
              anchorNextImageRef.current = false;
            }}
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="image-placeholder">
            <ImageIcon aria-hidden="true" />
            <strong>{imageError ? t("image.failed") : media.name}</strong>
            <span>{imageError ? t("image.unsupported") : t("image.localPreview")}</span>
          </div>
        )}
      </section>

      {!focusMode && <div className="image-controls">
        <div className="image-control-group">
          <button type="button" className="icon-button" onClick={() => navigate(-1)} title={t("image.previous")}><ChevronLeft aria-hidden="true" /></button>
          <button type="button" className={scaleLocked ? "icon-button active" : "icon-button"} aria-pressed={scaleLocked} onClick={toggleScaleLock} title={scaleLocked ? t("image.unlockScale") : t("image.lockScale")}>
            {scaleLocked ? <Lock aria-hidden="true" /> : <Unlock aria-hidden="true" />}
          </button>
          <button type="button" className="icon-button" onClick={() => zoom(-0.2)} title={t("image.zoomOut")}><ZoomOut aria-hidden="true" /></button>
          <button type="button" className="scale-button" onClick={reset} title={t("image.restore")}>{Math.round(zoomLevel * 100)}%</button>
          <button type="button" className="icon-button" onClick={() => zoom(0.2)} title={t("image.zoomIn")}><ZoomIn aria-hidden="true" /></button>
          <button type="button" className="icon-button" onClick={rotate} title={t("image.rotate")}><RotateCw aria-hidden="true" /></button>
          <button type="button" className="icon-button" onClick={reset} title={t("image.reset")}><RefreshCw aria-hidden="true" /></button>
          <button type="button" className="icon-button" onClick={() => navigate(1)} title={t("image.next")}><ChevronRight aria-hidden="true" /></button>
          <button type="button" className="icon-button" onClick={enterFocusMode} title={t("image.focusMode")}><Focus aria-hidden="true" /></button>
          <button type="button" className="icon-button" onClick={toggleFullscreen} title={t("common.fullscreen")}><Maximize aria-hidden="true" /></button>
        </div>
      </div>}
    </main>
  );
});
