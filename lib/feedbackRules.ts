type Landmark = {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
};

export type ReadyStanceResult = {
  score: number;
  feedback: string[];
};

function distance(a: Landmark, b: Landmark) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

export function analyzeReadyStance(landmarks: Landmark[]): ReadyStanceResult {
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftWrist = landmarks[15];
  const rightWrist = landmarks[16];
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];
  const leftKnee = landmarks[25];
  const rightKnee = landmarks[26];
  const leftAnkle = landmarks[27];
  const rightAnkle = landmarks[28];

  let score = 100;
  const feedback: string[] = [];

  const shoulderWidth = distance(leftShoulder, rightShoulder);
  const feetWidth = distance(leftAnkle, rightAnkle);

  // Rule 1: Feet should be wider than shoulders
  if (feetWidth < shoulderWidth * 1.1) {
    score -= 20;
    feedback.push("Widen your feet slightly for a stronger ready stance.");
  } else {
    feedback.push("Good foot width.");
  }

  // Rule 2: Knees should be bent
  const avgHipY = (leftHip.y + rightHip.y) / 2;
  const avgKneeY = (leftKnee.y + rightKnee.y) / 2;
  const avgAnkleY = (leftAnkle.y + rightAnkle.y) / 2;

  const kneeBendRatio = (avgKneeY - avgHipY) / (avgAnkleY - avgHipY);

  if (kneeBendRatio > 0.58) {
    score -= 25;
    feedback.push("Bend your knees more so you are ready to react.");
  } else {
    feedback.push("Good knee bend.");
  }

  // Rule 3: Hands should be in front of body and not too low
  const avgWristY = (leftWrist.y + rightWrist.y) / 2;

  if (avgWristY > avgHipY) {
    score -= 20;
    feedback.push("Keep your hands higher and in front of your body.");
  } else {
    feedback.push("Good hand position.");
  }

  // Rule 4: Body should be balanced left to right
  const hipCenterX = (leftHip.x + rightHip.x) / 2;
  const ankleCenterX = (leftAnkle.x + rightAnkle.x) / 2;

  if (Math.abs(hipCenterX - ankleCenterX) > shoulderWidth * 0.35) {
    score -= 15;
    feedback.push("Try to stay more balanced over both feet.");
  } else {
    feedback.push("Good balance.");
  }

  return {
    score: Math.max(0, Math.round(score)),
    feedback,
  };
}