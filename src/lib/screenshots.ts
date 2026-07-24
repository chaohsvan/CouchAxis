function pad(value: number, length = 2): string {
  return String(value).padStart(length, "0");
}

export function screenshotFileName(mediaName: string, date: Date, positionSeconds: number): string {
  const stem = mediaName.replace(/\.[^.]+$/, "") || "CouchAxis";
  const datePart = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  const timePart = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  const totalSeconds = Math.max(0, Math.floor(positionSeconds));
  const positionPart = `${pad(Math.floor(totalSeconds / 3600))}-${pad(Math.floor(totalSeconds / 60) % 60)}-${pad(totalSeconds % 60)}`;
  return `${stem}_${datePart}-${timePart}_${positionPart}.png`;
}

function wrapSubtitle(context: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  text.split(/\r?\n/).forEach((sourceLine) => {
    if (!sourceLine) {
      lines.push("");
      return;
    }
    let line = "";
    Array.from(sourceLine).forEach((character) => {
      const candidate = line + character;
      if (line && context.measureText(candidate).width > maxWidth) {
        lines.push(line);
        line = character;
      } else {
        line = candidate;
      }
    });
    if (line) lines.push(line);
  });
  return lines;
}

export async function captureVideoFrame(video: HTMLVideoElement, subtitleText: string): Promise<number[]> {
  if (!video.videoWidth || !video.videoHeight || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    throw new Error("video_frame_unavailable");
  }
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas_unavailable");
  context.drawImage(video, 0, 0, canvas.width, canvas.height);

  if (subtitleText.trim()) {
    const fontSize = Math.max(24, Math.round(canvas.width * 0.028));
    context.font = `600 ${fontSize}px "Segoe UI", sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "bottom";
    context.lineJoin = "round";
    context.strokeStyle = "rgba(0, 0, 0, .94)";
    context.fillStyle = "#fff";
    context.lineWidth = Math.max(4, Math.round(fontSize * 0.18));
    const lines = wrapSubtitle(context, subtitleText, canvas.width * 0.86);
    const lineHeight = fontSize * 1.35;
    const bottom = canvas.height * 0.08;
    lines.forEach((line, index) => {
      const y = canvas.height - bottom - (lines.length - index - 1) * lineHeight;
      context.strokeText(line, canvas.width / 2, y);
      context.fillText(line, canvas.width / 2, y);
    });
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => value ? resolve(value) : reject(new Error("png_encode_failed")), "image/png");
  });
  return Array.from(new Uint8Array(await blob.arrayBuffer()));
}
