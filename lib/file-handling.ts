export const supportedVideoTypes = ["video/mp4", "video/webm"];

export function validateGameplayFile(file: File): string | null {
  if (!supportedVideoTypes.includes(file.type)) {
    return "Upload an MP4 or WebM gameplay video.";
  }

  const maxSizeMb = 500;
  if (file.size > maxSizeMb * 1024 * 1024) {
    return `Keep uploads under ${maxSizeMb} MB for browser rendering.`;
  }

  return null;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "0:00";
  }

  const rounded = Math.round(seconds);
  const minutes = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}

export function blobToObjectUrl(previousUrl: string | null, blob: Blob): string {
  if (previousUrl) {
    URL.revokeObjectURL(previousUrl);
  }
  return URL.createObjectURL(blob);
}
