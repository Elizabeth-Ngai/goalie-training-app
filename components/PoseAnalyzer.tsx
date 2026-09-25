"use client";

import { analyzeReadyStance } from "@/lib/feedbackRules";
import { getTopPriorities } from "@/lib/priorities";
import { buildRecommendations } from "@/lib/recommendations";
import { Scorecard as ScorecardData } from "@/lib/types";
import Scorecard from "@/components/Scorecard";
import RecommendationsPanel from "@/components/RecommendationsPanel";
import VideoClassificationCard, {
    ClassificationPrediction,
    ClassificationStatus,
} from "@/components/VideoClassificationCard";
import { useEffect, useRef, useState } from "react";
import {
    FilesetResolver,
    PoseLandmarker,
    DrawingUtils,
} from "@mediapipe/tasks-vision";

type ModelStatus = "loading" | "ready" | "error";

export default function PoseAnalyzer() {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);

    const [modelStatus, setModelStatus] = useState<ModelStatus>("loading");
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [fileName, setFileName] = useState<string | null>(null);
    const [scorecard, setScorecard] = useState<ScorecardData | null>(null);
    const [statusMessage, setStatusMessage] = useState<string>(
        "Loading pose model..."
    );

    // The scorecard updates every video frame during playback, which makes
    // recommendations reshuffle too fast to read. We only show
    // recommendations once the video has finished playing.
    const [videoEnded, setVideoEnded] = useState(false);

    // AI video classification state.
    const [classificationStatus, setClassificationStatus] =
        useState<ClassificationStatus>("idle");
    const [prediction, setPrediction] = useState<ClassificationPrediction | null>(
        null
    );
    const [selectedCategory, setSelectedCategory] = useState<string | null>(
        null
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
        setScorecard(null);
        setVideoEnded(false);
        setStatusMessage("Video loaded. Press play to analyze.");

        // Reset classification state for the new video.
        setClassificationStatus("idle");
        setPrediction(null);
        setSelectedCategory(null);
    }

    // Captures the current video frame and sends it to the AI classifier.
    // Only runs once per uploaded video (guarded by classificationStatus).
    async function classifyVideo() {
        const video = videoRef.current;
        if (!video || classificationStatus !== "idle") return;

        setClassificationStatus("loading");

        // Draw the current frame onto a separate offscreen canvas so we don't
        // disturb the canvas used for drawing pose landmarks.
        const captureCanvas = document.createElement("canvas");
        captureCanvas.width = video.videoWidth;
        captureCanvas.height = video.videoHeight;
        const captureCtx = captureCanvas.getContext("2d");

        if (!captureCtx) {
            setClassificationStatus("error");
            return;
        }

        captureCtx.drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height);
        const imageBase64 = captureCanvas.toDataURL("image/jpeg", 0.8);

        try {
            const response = await fetch("/api/classify-video", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ imageBase64 }),
            });

            if (!response.ok) throw new Error("Classification request failed");

            const data = await response.json();
            setPrediction({ category: data.category, confidence: data.confidence });
            setClassificationStatus("done");
        } catch {
            setClassificationStatus("error");
        }
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
            setScorecard(analysis);

            for (const landmarks of results.landmarks) {
                drawingUtils.drawLandmarks(landmarks);
                drawingUtils.drawConnectors(
                    landmarks,
                    PoseLandmarker.POSE_CONNECTIONS
                );
            }
        } else {
            setScorecard(null);
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
                <VideoClassificationCard
                    status={classificationStatus}
                    prediction={prediction}
                    selectedCategory={selectedCategory}
                    onSelectCategory={setSelectedCategory}
                />
            )}

            {videoUrl && (
                <div className="relative w-full overflow-hidden rounded-xl border border-border bg-black">
                    <video
                        ref={videoRef}
                        src={videoUrl}
                        controls
                        onLoadedData={classifyVideo}
                        onPlay={() => {
                            setVideoEnded(false);
                            analyzeFrame();
                        }}
                        onEnded={() => setVideoEnded(true)}
                        className="w-full"
                    />

                    <canvas
                        ref={canvasRef}
                        className="pointer-events-none absolute left-0 top-0 h-full w-full"
                    />
                </div>
            )}

            {scorecard ? (
                <>
                    <Scorecard scorecard={scorecard} />
                    {videoEnded ? (
                        <RecommendationsPanel
                            recommendations={buildRecommendations(
                                getTopPriorities(scorecard.ratings)
                            )}
                        />
                    ) : (
                        <div className="rounded-xl border border-border bg-surface p-5">
                            <h2 className="font-semibold">Recommended for You</h2>
                            <p className="mt-3 text-sm text-muted">
                                Recommendations will appear here once the video
                                finishes playing.
                            </p>
                        </div>
                    )}
                </>
            ) : (
                <div className="rounded-xl border border-border bg-surface p-5">
                    <h2 className="font-semibold">Ready Stance Scorecard</h2>
                    <p className="mt-3 text-sm text-muted">{statusMessage}</p>
                </div>
            )}
        </div>
    );
}
