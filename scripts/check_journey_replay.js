const { chromium } = require("/tmp/plg-playwright/node_modules/playwright");
const fs = require("fs");

function readEnv(filePath) {
  return Object.fromEntries(
    fs
      .readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const i = line.indexOf("=");
        return [line.slice(0, i), line.slice(i + 1).replace(/^"|"$/g, "")];
      }),
  );
}

async function main() {
  const env = readEnv("/Users/doquan/GitHub/personalLearningGround/.env");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const arrivalLabels = [];

  await page.goto(env.TEST_URL || "http://localhost", { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill(env.TEST_ACCOUNT);
  await page.getByLabel("Password").fill(env.TEST_ACCOUNT_PASSWORD);
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForTimeout(2500);

  await page
    .locator("button")
    .filter({ hasText: env.TEST_PROFILE || "Papi" })
    .first()
    .click();
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: "Watch My Journey" }).click();
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: /Playback speed: 1x/ }).click();
  await page.getByRole("button", { name: "Play journey" }).click();

  const sampleTimes = [1000, 5000, 10000, 16000, 22000, 30000, 38000];
  let elapsed = 0;

  for (const target of sampleTimes) {
    await page.waitForTimeout(target - elapsed);
    elapsed = target;

    const sample = await page.evaluate(() => {
      const vehicle = document
        .querySelector(".leaflet-marker-icon")
        ?.getBoundingClientRect();
      const sprite = document.querySelector(".leaflet-marker-icon");
      const map = document.querySelector(".leaflet-container")?.getBoundingClientRect();
      const label = document
        .querySelector(".waypoint-label-enter p")
        ?.textContent?.trim() ?? null;

      return {
        vehicle: vehicle
          ? {
              x: vehicle.x,
              y: vehicle.y,
              width: vehicle.width,
              height: vehicle.height,
            }
          : null,
        spriteTransform: sprite instanceof HTMLElement ? sprite.style.transform : null,
        map: map
          ? {
              top: map.top,
              bottom: map.bottom,
              left: map.left,
              right: map.right,
            }
          : null,
        label,
      };
    });

    if (sample.label) arrivalLabels.push(sample.label);
    console.log(JSON.stringify({ t: target, ...sample }, null, 2));
  }

  console.log(`ARRIVALS=${JSON.stringify(arrivalLabels)}`);
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
