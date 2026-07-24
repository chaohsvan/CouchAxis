export interface ViewSize {
  width: number;
  height: number;
}

export interface ViewPoint {
  x: number;
  y: number;
}

export interface ImageViewportMetrics {
  fitScale: number;
  renderScale: number;
  renderedWidth: number;
  renderedHeight: number;
  maxPanX: number;
  maxPanY: number;
}

export function imageViewportMetrics(
  image: ViewSize,
  viewport: ViewSize,
  rotation: number,
  zoom: number,
  fitPadding = 48,
): ImageViewportMetrics {
  const rotated = Math.abs(rotation % 180) === 90
    ? { width: image.height, height: image.width }
    : image;
  const availableWidth = Math.max(1, viewport.width - fitPadding);
  const availableHeight = Math.max(1, viewport.height - fitPadding);
  const fitScale = Math.min(
    availableWidth / Math.max(1, rotated.width),
    availableHeight / Math.max(1, rotated.height),
  );
  const renderScale = fitScale * zoom;
  const renderedWidth = rotated.width * renderScale;
  const renderedHeight = rotated.height * renderScale;
  return {
    fitScale,
    renderScale,
    renderedWidth,
    renderedHeight,
    maxPanX: Math.max(0, (renderedWidth - viewport.width) / 2),
    maxPanY: Math.max(0, (renderedHeight - viewport.height) / 2),
  };
}

export function clampImagePan(point: ViewPoint, metrics: ImageViewportMetrics): ViewPoint {
  return {
    x: Math.min(metrics.maxPanX, Math.max(-metrics.maxPanX, point.x)),
    y: Math.min(metrics.maxPanY, Math.max(-metrics.maxPanY, point.y)),
  };
}

export function mangaStartPan(metrics: ImageViewportMetrics, side: "left" | "right"): ViewPoint {
  return {
    x: side === "left" ? metrics.maxPanX : -metrics.maxPanX,
    y: metrics.maxPanY,
  };
}
