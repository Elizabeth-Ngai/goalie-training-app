"use client";

import { useEffect, useRef, useState } from "react";
import {
  FilesetResolver,
  PoseLandmarker,
  DrawingUtils,
} from "@mediapipe/tasks-vision";

type Status = "loading-model" | "idle" | "video-ready" | "pose" | "no-pose";

const STATUS_CONFIG: Record<
  Status,
  { label: string; description: string; dot: string }
> = {
  "loading-model": {
    label: "Loading AI model",
    description: "Setting up on-device pose detection…",
    dot: "bg-slate-400 animate-pulse",
  },
  idle: {
    label: "Ready",
    description: "Upload a short clip to begin analysis.",
    dot: "bg-slate-400",
  },
  "video-ready": {
    label: "Video loaded",
    description: "Press play on the video to start analyzing your form.",
    dot: "bg-blue-500",
  },
  pose: {
    label: "Pose detected",
    description: "Tracking stance and movement in real time.",
    dot: "bg-emerald-500",
  },
  "no-pose": {
    label: "No pose detected",
    description: "Make sure your full body is visible in frame.",
    dot: "bg-amber-500",
  },
};

export default function PoseAnalyzer() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);

  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("loading-model");

  useEffect(() => {
    async function loadModel() {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );

      poseLandmarkerRef.current = await PoseLandmarker.createFromOptions(
        vision,
        {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numPoses: 1,
        }
      );

      setStatus((current) => (current === "loading-model" ? "idle" : current));
    }

    loadModel();
  }, []);

  function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setVideoUrl(URL.createObjectURL(file));
    setStatus("video-ready");
  }

  async function analyzeFrame() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const landmarker = poseLandmarkerRef.current;

    if (!video || !canvas || !landmarker) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const results = landmarker.detectForVideo(video, performance.now());

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const drawingUtils = new DrawingUtils(ctx);

    if (results.landmarks.length > 0) {
      for (const landmarks of results.landmarks) {
        drawingUtils.drawLandmarks(landmarks, {
          color: "#34d399",
          fillColor: "#10b981",
          radius: 3,
        });
        drawingUtils.drawConnectors(
          landmarks,
          PoseLandmarker.POSE_CONNECTIONS,
          { color: "#34d399", lineWidth: 2 }
        );
      }

      setStatus("pose");
    } else {
      setStatus("no-pose");
    }

    if (!video.paused && !video.ended) {
      requestAnimationFrame(analyzeFrame);
    }
  }

  const config = STATUS_CONFIG[status];

  return (
    <div className="space-y-6">
      <label
        className={`inline-flex items-center gap-2 rounded-full px-6 py-3 font-semibold shadow-sm transition ${
          status === "loading-model"
            ? "cursor-not-allowed bg-slate-200 text-slate-400"
            : "cursor-pointer bg-emerald-600 text-white hover:bg-emerald-500"
        }`}
      >
        <span>📹</span>
        <span>{videoUrl ? "Choose a different video" : "Upload training video"}</span>
        <input
          type="file"
          accept="video/*"
          onChange={handleUpload}
          disabled={status === "loading-model"}
          className="hidden"
        />
      </label>

      {videoUrl && (
        <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-black shadow-lg">
          <video
            ref={videoRef}
            src={videoUrl}
            controls
            onPlay={analyzeFrame}
            className="w-full"
          />

          <canvas
            ref={canvasRef}
            className="pointer-events-none absolute left-0 top-0 h-full w-full"
          />
        </div>
      )}

      <div className="flex max-w-2xl items-start gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${config.dot}`} />
        <div>
          <p className="font-semibold text-slate-900">{config.label}</p>
          <p className="text-sm text-slate-600">{config.description}</p>
        </div>
      </div>
    </div>
  );
}
