/**
 * Launch the Chromium every browser-driven check shares.
 *
 * Three scripts each launched Chromium at
 * `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` — a path that exists
 * only inside this specific development sandbox, where the browser ships
 * pre-baked at a fixed location. CI installs its own Chromium with
 * `npx playwright install --with-deps chromium`, to Playwright's normal
 * cache directory, and that path does not exist there.
 *
 * This bug was never caught because CI never reached a browser check to
 * catch it with: tantu-ci.yaml pinned Node 20, which crashed at the *Test
 * suite* step on every run since the workflow existed, so nothing past it —
 * including every browser check — ever executed. Fixing the Node version was
 * what finally let this run for the first time, and it failed in the same
 * second it started, on `Executable doesn't exist`.
 *
 * Resolve portably: use the sandbox's pre-baked binary when it is actually
 * there, and fall back to Playwright's own resolution — the browser it
 * installed — everywhere else, including CI.
 */
import { chromium } from "playwright";
import fs from "node:fs";

const SANDBOX_CHROMIUM = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

/**
 * SwiftShader forces software rendering. Headless CI has no GPU, and without
 * it WebGL either refuses to initialise or silently falls back per-platform,
 * which would make the pooling check (npm run audit:browser /
 * qa:playground) measure a fiction. `--no-sandbox` is required to launch
 * Chromium as root, which both this sandbox and GitHub's runner do.
 */
export async function launchChromium() {
  const options = {
    args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"],
  };
  if (fs.existsSync(SANDBOX_CHROMIUM)) options.executablePath = SANDBOX_CHROMIUM;
  return chromium.launch(options);
}
