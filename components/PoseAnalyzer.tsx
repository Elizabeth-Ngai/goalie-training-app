"use client";

import { useEffect, useRef, useState } from "react";
import {
  FilesetResolver,
  PoseLandmarker,
  DrawingUtils,
} from "@mediapipe/tasks-vision";

export default function PoseAnalyzer() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);

  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string>("Upload a video to begin.");

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
    }

    loadModel();
  }, []);

  function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setVideoUrl(URL.createObjectURL(file));
    setFeedback("Video uploaded. Press play to analyze.");
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
        drawingUtils.drawLandmarks(landmarks);
        drawingUtils.drawConnectors(
          landmarks,
          PoseLandmarker.POSE_CONNECTIONS
        );
      }

      setFeedback("Pose detected. Next, we can score stance and movement.");
    } else {
      setFeedback("No pose detected. Make sure the full body is visible.");
    }

    if (!video.paused && !video.ended) {
      requestAnimationFrame(analyzeFrame);
    }
  }

  return (
    <div className="space-y-6">
      <input type="file" accept="video/*" onChange={handleUpload} />

      {videoUrl && (
        <div className="relative w-full max-w-3xl">
          <video
            ref={videoRef}
            src={videoUrl}
            controls
            onPlay={analyzeFrame}
            className="w-full rounded-xl"
          />

          <canvas
            ref={canvasRef}
            className="absolute left-0 top-0 w-full h-full pointer-events-none"
          />
        </div>
      )}

      <div className="rounded-xl bg-slate-800 p-4">
        <h2 className="font-semibold mb-2">AI Feedback</h2>
        <p>{feedback}</p>
      </div>
    </div>
  );
}