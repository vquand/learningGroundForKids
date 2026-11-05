import { spawnSync } from "node:child_process";

const usage = `Usage: npm run test:browser:passkey:local --prefix frontend -- [--chromium PATH]

Options:
  --help          Print this usage without launching the UAT.
  --chromium PATH Use PATH as Playwright's Chromium executable.
`;

const args = process.argv.slice(2);
let chromiumPath;
for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === "--help") {
    process.stdout.write(usage);
    process.exit(0);
  }
  if (arg === "--chromium") {
    chromiumPath = args[index + 1];
    if (!chromiumPath || chromiumPath.startsWith("--")) {
      process.stderr.write("error: --chromium requires a PATH\n");
      process.exit(2);
    }
    index += 1;
    continue;
  }
  process.stderr.write(`error: unknown option: ${arg}\n\n${usage}`);
  process.exit(2);
}

const environment = { ...process.env };
if (chromiumPath) environment.PLAYWRIGHT_CHROMIUM_EXECUTABLE = chromiumPath;

const result = spawnSync(process.execPath, ["--test", "tests/browser/passkey-local-uat.test.ts"], {
  env: environment,
  stdio: "inherit",
  timeout: 150_000,
});

if (result.error) {
  process.stderr.write(`${result.error.message}\n`);
  process.exit(1);
}
process.exit(result.status ?? 1);
