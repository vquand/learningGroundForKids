import assert from "node:assert/strict";
import test from "node:test";
import {
  CAMERA_FOLLOW_SMOOTHING_MS,
  smoothCameraFollowPose,
  type CameraFollowPose,
} from "../src/components/Journey/cameraFollow.ts";

const startPose: CameraFollowPose = {
  headingRadians: 0,
  pitchRadians: -0.9,
  range: 7_000_000,
};

test("camera follow moves continuously instead of snapping to the next pose", () => {
  const targetPose: CameraFollowPose = {
    headingRadians: Math.PI / 2,
    pitchRadians: -0.45,
    range: 4_500_000,
  };

  const firstFrame = smoothCameraFollowPose(
    startPose,
    targetPose,
    16,
  );

  assert.ok(firstFrame.headingRadians > startPose.headingRadians);
  assert.ok(firstFrame.headingRadians < targetPose.headingRadians);
  assert.ok(firstFrame.pitchRadians > startPose.pitchRadians);
  assert.ok(firstFrame.pitchRadians < targetPose.pitchRadians);
  assert.ok(firstFrame.range < startPose.range);
  assert.ok(firstFrame.range > targetPose.range);
});

test("camera follow reaches the target smoothly over several frames", () => {
  const targetPose: CameraFollowPose = {
    headingRadians: -Math.PI / 2,
    pitchRadians: -0.45,
    range: 4_500_000,
  };
  let pose = startPose;

  for (let frame = 0; frame < 120; frame++) {
    pose = smoothCameraFollowPose(pose, targetPose, 16);
  }

  const angleTolerance = Math.PI * Math.exp(-120 * 16 / CAMERA_FOLLOW_SMOOTHING_MS);
  assert.ok(Math.abs(pose.headingRadians - targetPose.headingRadians) < angleTolerance);
  assert.ok(Math.abs(pose.pitchRadians - targetPose.pitchRadians) < angleTolerance);
  assert.ok(Math.abs(pose.range - targetPose.range) < 1_000_000);
});

test("camera heading interpolation takes the short path across north", () => {
  const pose = smoothCameraFollowPose(
    {
      headingRadians: (359 * Math.PI) / 180,
      pitchRadians: -0.45,
      range: 4_500_000,
    },
    {
      headingRadians: (1 * Math.PI) / 180,
      pitchRadians: -0.45,
      range: 4_500_000,
    },
    16,
  );

  assert.ok(pose.headingRadians > (359 * Math.PI) / 180);
  assert.ok(pose.headingRadians < (361 * Math.PI) / 180);
});
