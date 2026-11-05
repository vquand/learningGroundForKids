export const CAMERA_FOLLOW_SMOOTHING_MS = 220;

export interface CameraFollowPose {
  headingRadians: number;
  pitchRadians: number;
  range: number;
}

function normalizeRadians(angle: number): number {
  const fullTurn = Math.PI * 2;
  return ((angle + Math.PI) % fullTurn + fullTurn) % fullTurn - Math.PI;
}

function shortestAngleDelta(from: number, to: number): number {
  return normalizeRadians(to - from);
}

/**
 * Advance the chase camera toward its desired pose using frame-time damping.
 * Small frame steps keep the camera moving continuously instead of restarting
 * interrupted Cesium flights on a fixed timer.
 */
export function smoothCameraFollowPose(
  current: CameraFollowPose,
  target: CameraFollowPose,
  deltaMs: number,
): CameraFollowPose {
  const clampedDeltaMs = Math.max(0, deltaMs);
  const alpha = 1 - Math.exp(-clampedDeltaMs / CAMERA_FOLLOW_SMOOTHING_MS);

  return {
    headingRadians:
      current.headingRadians +
      shortestAngleDelta(current.headingRadians, target.headingRadians) * alpha,
    pitchRadians:
      current.pitchRadians +
      (target.pitchRadians - current.pitchRadians) * alpha,
    range: current.range + (target.range - current.range) * alpha,
  };
}
