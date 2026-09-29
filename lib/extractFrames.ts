// Client-side video frame extraction. Fetches the video bytes directly
// (rather than pointing a <video> at the cross-origin Blob URL with
// crossOrigin="anonymous") so the resulting blob: URL is always same-origin
// and canvas capture can never hit a "tainted canvas" SecurityError,
// regardless of the Blob store's CORS configuration.

export const MIN_FRAME_COUNT = 12;
export const MAX_FRAME_COUNT = 16;
export const MAX_FRAME_DIMENSION = 512;

// Goalkeeper saves happen fast (set position, first movement, footwork,
// plant, dive initiation, extension, contact, landing, recovery) — too few
// evenly-spaced frames risks straddling the save entirely. This is a simple
// duration-aware clamp, not adaptive/event-based sampling: short clips still
// get the 12-frame floor, longer ones cap at 16 rather than growing without
// bound.
export function computeFrameCount(durationSeconds: number): number {
  return Math.min(
    MAX_FRAME_COUNT,
    Math.max(MIN_FRAME_COUNT, Math.round(durationSeconds * 1.5))
  );
}

export type TimestampedFrame = {
  timestamp: number;
  dataUrl: string;
};

export async function extractFrames(
  videoUrl: string,
  frameCount?: number
): Promise<TimestampedFrame[]> {
  const response = await fetch(videoUrl);
  const videoBlob = await response.blob();
  const objectUrl = URL.createObjectURL(videoBlob);

  try {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.src = objectUrl;

    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Couldn't load video for frame extraction."));
    });

    const count = frameCount ?? computeFrameCount(video.duration);

    const scale = Math.min(
      1,
      MAX_FRAME_DIMENSION / Math.max(video.videoWidth, video.videoHeight)
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Couldn't create canvas context for frame extraction.");

    const frames: TimestampedFrame[] = [];

    for (let i = 0; i < count; i++) {
      const timestamp = (video.duration * (i + 1)) / (count + 1);

      await new Promise<void>((resolve, reject) => {
        video.onseeked = () => resolve();
        video.onerror = () => reject(new Error("Couldn't seek video for frame extraction."));
        video.currentTime = timestamp;
      });

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      frames.push({
        timestamp,
        dataUrl: canvas.toDataURL("image/jpeg", 0.7),
      });
    }

    return frames;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
