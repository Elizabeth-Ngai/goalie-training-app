"use client";

import { analyzeReadyStance, ReadyStanceResult } from "@/lib/feedbackRules";
import { useEffect, useRef, useState } from "react";
import {
    FilesetResolver,
    PoseLandmarker,
    DrawingUtils,
} from "@mediapipe/tasks-vision";

type ModelStatus = "loading" | "ready" | "error";

function scoreColor(score: number) {
    if (score >= 80) return "var(--good)";
    if (score >= 50) return "var(--warn)";
    return "var(--bad)";
}

function FeedbackIcon({ good }: { good: boolean }) {
    if (good) {
        return (
            <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 shrink-0 text-good">
                <path
                    d="M4 10.5l3.5 3.5L16 5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
        );
    }
    return (
        <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 shrink-0 text-warn">
            <path
                d="M10 3l8 14H2l8-14z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
            />
            <path d="M10 8.5v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <circle cx="10" cy="14" r="0.9" fill="currentColor" />
        </svg>
    );
}

export default function PoseAnalyzer() {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);

    const [modelStatus, setModelStatus] = useState<ModelStatus>("loading");
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [fileName, setFileName] = useState<string | null>(null);
    const [result, setResult] = useState<ReadyStanceResult | null>(null);
    const [statusMessage, setStatusMessage] = useState<string>(
        "Loading pose model..."
    );

    useEffect(() => {
        async function loadModel() {
            try {
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

                setModelStatus("ready");
                setStatusMessage("Upload a video to begin.");
            } catch {
                setModelStatus("error");
                setStatusMessage(
                    "Couldn't load the pose model. Check your connection and refresh."
                );
            }
        }

        loadModel();
    }, []);

    function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        if (!file) return;

        setVideoUrl(URL.createObjectURL(file));
        setFileName(file.name);
        setResult(null);
        setStatusMessage("Video loaded. Press play to analyze.");
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
            const analysis = analyzeReadyStance(results.landmarks[0]);
            setResult(analysis);

            for (const landmarks of results.landmarks) {
                drawingUtils.drawLandmarks(landmarks);
                drawingUtils.drawConnectors(
                    landmarks,
                    PoseLandmarker.POSE_CONNECTIONS
                );
            }
        } else {
            setResult(null);
            setStatusMessage("No pose detected. Make sure your full body is visible.");
        }

        if (!video.paused && !video.ended) {
            requestAnimationFrame(analyzeFrame);
        }
    }

    const uploadDisabled = modelStatus !== "ready";

    return (
        <div className="space-y-6">
            <label
                className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-surface px-6 py-10 text-center transition-colors ${
                    uploadDisabled
                        ? "cursor-not-allowed opacity-60"
                        : "cursor-pointer hover:border-accent"
                }`}
            >
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className="h-8 w-8 text-muted"
                >
                    <path
                        d="M12 16V4m0 0l-4 4m4-4l4 4M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
                <span className="font-medium">
                    {fileName ?? "Click to choose a video"}
                </span>
                <span className="text-sm text-muted">
                    {modelStatus === "loading"
                        ? "Loading pose model..."
                        : modelStatus === "error"
                        ? "Pose model unavailable"
                        : "MP4, MOV, or WebM"}
                </span>
                <input
                    type="file"
                    accept="video/*"
                    onChange={handleUpload}
                    disabled={uploadDisabled}
                    className="hidden"
                />
            </label>

            {videoUrl && (
                <div className="relative w-full overflow-hidden rounded-xl border border-border bg-black">
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

            <div className="rounded-xl border border-border bg-surface p-5">
                <div className="flex items-center justify-between">
                    <h2 className="font-semibold">Ready Stance Feedback</h2>
                    {result && (
                        <span
                            className="text-lg font-bold"
                            style={{ color: scoreColor(result.score) }}
                        >
                            {result.score}/100
                        </span>
                    )}
                </div>

                {result && (
                    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-raised">
                        <div
                            className="h-full rounded-full transition-all"
                            style={{
                                width: `${result.score}%`,
                                background: scoreColor(result.score),
                            }}
                        />
                    </div>
                )}

                {result ? (
                    <ul className="mt-4 space-y-2 text-sm">
                        {result.feedback.map((line, i) => (
                            <li key={i} className="flex items-start gap-2">
                                <FeedbackIcon good={line.startsWith("Good")} />
                                <span
                                    className={
                                        line.startsWith("Good") ? "text-foreground" : "text-warn"
                                    }
                                >
                                    {line}
                                </span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="mt-3 text-sm text-muted">{statusMessage}</p>
                )}
            </div>
        </div>
    );
}
