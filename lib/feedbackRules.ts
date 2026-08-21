import { DevelopmentRating, Scorecard } from "./types";

type Landmark = {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
};

function distance(a: Landmark, b: Landmark) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

// Calculates the angle (in degrees) at point b, formed by the lines b->a and b->c.
// This is how we measure how bent a joint is, using the joint above and below it
// (for the knee, that's the hip and the ankle).
function angleBetween(a: Landmark, b: Landmark, c: Landmark): number {
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };

  const dotProduct = ab.x * cb.x + ab.y * cb.y;
  const magnitudeAB = Math.sqrt(ab.x ** 2 + ab.y ** 2);
  const magnitudeCB = Math.sqrt(cb.x ** 2 + cb.y ** 2);

  const cosAngle = dotProduct / (magnitudeAB * magnitudeCB);
  // Clamp in case floating-point rounding pushes cosAngle just outside [-1, 1].
  const clamped = Math.max(-1, Math.min(1, cosAngle));

  return (Math.acos(clamped) * 180) / Math.PI;
}

// Confidence reflects how clearly the pose model could see the landmarks a
// check depends on, based on MediaPipe's per-landmark visibility score.
function getConfidence(points: Landmark[]): "low" | "medium" | "high" {
  const visibilities = points
    .map((point) => point.visibility)
    .filter((v): v is number => v !== undefined);

  if (visibilities.length === 0) return "high";

  const avgVisibility =
    visibilities.reduce((sum, v) => sum + v, 0) / visibilities.length;

  if (avgVisibility >= 0.8) return "high";
  if (avgVisibility >= 0.5) return "medium";
  return "low";
}

// Rule 1: Feet should be wider than shoulders for a strong, stable base.
function rateStanceWidth(landmarks: Landmark[]): DevelopmentRating {
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftAnkle = landmarks[27];
  const rightAnkle = landmarks[28];

  if (!leftShoulder || !rightShoulder || !leftAnkle || !rightAnkle) {
    return {
      category: "Stance Width",
      rating: "N/A",
      confidence: "low",
      observation: "Couldn't see the shoulders and feet to check stance width.",
    };
  }

  const shoulderWidth = distance(leftShoulder, rightShoulder);
  const feetWidth = distance(leftAnkle, rightAnkle);
  const widthRatio = feetWidth / shoulderWidth;

  let rating: DevelopmentRating["rating"];
  let observation: string;

  if (widthRatio >= 1.3) {
    rating = 5;
    observation = "Wide, athletic stance - great base to push off from.";
  } else if (widthRatio >= 1.1) {
    rating = 4;
    observation = "Good foot width, wider than your shoulders.";
  } else if (widthRatio >= 0.95) {
    rating = 3;
    observation = "Feet are about shoulder-width. Widen them a bit more.";
  } else if (widthRatio >= 0.8) {
    rating = 2;
    observation = "Feet are narrower than your shoulders. Widen your stance.";
  } else {
    rating = 1;
    observation = "Feet are much too narrow for a ready stance. Widen them a lot.";
  }

  return {
    category: "Stance Width",
    rating,
    confidence: getConfidence([leftShoulder, rightShoulder, leftAnkle, rightAnkle]),
    observation,
  };
}

// Rule 2: Knees should be bent so you're ready to react.
function rateKneeBend(landmarks: Landmark[]): DevelopmentRating {
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];
  const leftKnee = landmarks[25];
  const rightKnee = landmarks[26];
  const leftAnkle = landmarks[27];
  const rightAnkle = landmarks[28];

  if (
    !leftHip ||
    !rightHip ||
    !leftKnee ||
    !rightKnee ||
    !leftAnkle ||
    !rightAnkle
  ) {
    return {
      category: "Knee Bend",
      rating: "N/A",
      confidence: "low",
      observation: "Couldn't see enough of the legs to check knee bend.",
    };
  }

  // A straight leg measures close to 180 degrees. The more the knee bends,
  // the smaller this angle gets.
  const leftKneeAngle = angleBetween(leftHip, leftKnee, leftAnkle);
  const rightKneeAngle = angleBetween(rightHip, rightKnee, rightAnkle);
  const kneeAngle = (leftKneeAngle + rightKneeAngle) / 2;

  let rating: DevelopmentRating["rating"];
  let observation: string;

  if (kneeAngle <= 150) {
    rating = 5;
    observation = "Excellent knee bend - you're loaded and ready to react.";
  } else if (kneeAngle <= 160) {
    rating = 4;
    observation = "Good knee bend.";
  } else if (kneeAngle <= 170) {
    rating = 3;
    observation = "Knees are only slightly bent. Bend them more to be ready.";
  } else if (kneeAngle <= 175) {
    rating = 2;
    observation = "Legs are nearly straight. Bend your knees more.";
  } else {
    rating = 1;
    observation = "Legs are straight. Bend your knees to get into a ready stance.";
  }

  return {
    category: "Knee Bend",
    rating,
    confidence: getConfidence([
      leftHip,
      rightHip,
      leftKnee,
      rightKnee,
      leftAnkle,
      rightAnkle,
    ]),
    observation,
  };
}

// Rule 3: Hands should be up in front of the body, not down at the hips.
function rateHandPosition(landmarks: Landmark[]): DevelopmentRating {
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftWrist = landmarks[15];
  const rightWrist = landmarks[16];
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];

  if (
    !leftShoulder ||
    !rightShoulder ||
    !leftWrist ||
    !rightWrist ||
    !leftHip ||
    !rightHip
  ) {
    return {
      category: "Hand Position",
      rating: "N/A",
      confidence: "low",
      observation: "Couldn't see the hands and hips to check hand position.",
    };
  }

  const shoulderWidth = distance(leftShoulder, rightShoulder);
  const avgWristY = (leftWrist.y + rightWrist.y) / 2;
  const avgHipY = (leftHip.y + rightHip.y) / 2;

  // In image coordinates, y grows downward, so a positive value here means
  // the hands are above the hips. We divide by shoulder width so this check
  // works the same whether the player is close to or far from the camera.
  const handHeightRatio = (avgHipY - avgWristY) / shoulderWidth;

  let rating: DevelopmentRating["rating"];
  let observation: string;

  if (handHeightRatio >= 0.5) {
    rating = 5;
    observation = "Hands are up high and ready to make a save.";
  } else if (handHeightRatio >= 0.2) {
    rating = 4;
    observation = "Good hand position.";
  } else if (handHeightRatio >= 0) {
    rating = 3;
    observation = "Hands are about hip height. Raise them a little.";
  } else if (handHeightRatio >= -0.2) {
    rating = 2;
    observation = "Hands are below your hips. Raise them higher.";
  } else {
    rating = 1;
    observation = "Hands are much too low. Bring them up in front of your body.";
  }

  return {
    category: "Hand Position",
    rating,
    confidence: getConfidence([
      leftShoulder,
      rightShoulder,
      leftWrist,
      rightWrist,
      leftHip,
      rightHip,
    ]),
    observation,
  };
}

// Rule 4: Body weight should be centered over both feet, not leaning to a side.
function rateBalance(landmarks: Landmark[]): DevelopmentRating {
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];
  const leftAnkle = landmarks[27];
  const rightAnkle = landmarks[28];

  if (
    !leftShoulder ||
    !rightShoulder ||
    !leftHip ||
    !rightHip ||
    !leftAnkle ||
    !rightAnkle
  ) {
    return {
      category: "Balance",
      rating: "N/A",
      confidence: "low",
      observation: "Couldn't see the hips and feet to check balance.",
    };
  }

  const shoulderWidth = distance(leftShoulder, rightShoulder);
  const hipCenterX = (leftHip.x + rightHip.x) / 2;
  const ankleCenterX = (leftAnkle.x + rightAnkle.x) / 2;

  const offsetRatio = Math.abs(hipCenterX - ankleCenterX) / shoulderWidth;

  let rating: DevelopmentRating["rating"];
  let observation: string;

  if (offsetRatio <= 0.15) {
    rating = 5;
    observation = "Excellent balance, weight centered over both feet.";
  } else if (offsetRatio <= 0.25) {
    rating = 4;
    observation = "Good balance.";
  } else if (offsetRatio <= 0.35) {
    rating = 3;
    observation = "Slightly off-center. Try to stay balanced over both feet.";
  } else if (offsetRatio <= 0.5) {
    rating = 2;
    observation = "Leaning noticeably to one side. Center your weight.";
  } else {
    rating = 1;
    observation = "Very off-balance. Keep your hips centered between your feet.";
  }

  return {
    category: "Balance",
    rating,
    confidence: getConfidence([
      leftShoulder,
      rightShoulder,
      leftHip,
      rightHip,
      leftAnkle,
      rightAnkle,
    ]),
    observation,
  };
}

export function analyzeReadyStance(landmarks: Landmark[]): Scorecard {
  return {
    ratings: [
      rateStanceWidth(landmarks),
      rateKneeBend(landmarks),
      rateHandPosition(landmarks),
      rateBalance(landmarks),
    ],
  };
}
