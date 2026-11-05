import assert from "node:assert/strict";
import test from "node:test";

import { avatarBackgroundStyle } from "../src/lib/avatarPresentation.ts";

test("profile avatar uses the selected color as an opaque background", () => {
  assert.deepEqual(avatarBackgroundStyle("#3B82F6"), { backgroundColor: "#3B82F6" });
  assert.deepEqual(avatarBackgroundStyle("#EC4899"), { backgroundColor: "#EC4899" });
});

test("profile avatar has no inline background when no color is selected", () => {
  assert.deepEqual(avatarBackgroundStyle(undefined), {});
});
