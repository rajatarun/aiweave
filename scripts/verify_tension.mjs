/**
 * Tension at its limits, and the promise that it changes nothing by default.
 *
 * Two things this exists to catch, neither of which any other sweep can see:
 *
 * 1. That the default sett reproduces the historic scale exactly. Adding the
 *    dial must not re-lay-out a single existing consumer, and the only way to
 *    know is to assert the numbers rather than reason about the arithmetic.
 *
 * 2. That the extremes are still usable. Every other suite runs at the
 *    default, so a dial that breaks the layout only at its ends passes all of
 *    them. It did: at full tension the stepper step and the slider track both
 *    fell to 16px tall, because each expressed its WCAG 2.2 SC 2.5.8 fix as
 *    var(--tantu-knot-4) — which was 24px only because the default sett made
 *    it so. Two criteria that had been fixed were silently broken again, and
 *    nothing in the repository would have noticed.
 *
 * Run: node scripts/verify_tension.mjs
 */
import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import { launchChromium } from "./chromium.mjs";
import { undersizedTargets } from "./a11y.mjs";

const ROOT = path.resolve("playground/dist");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf", ".svg": "image/svg+xml" };

const server = await new Promise((r) => {
  const s = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, "http://x").pathname);
    let f = path.join(ROOT, rel);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(ROOT, "index.html");
    res.writeHead(200, { "content-type": MIME[path.extname(f)] ?? "application/octet-stream" });
    fs.createReadStream(f).pipe(res);
  });
  s.listen(0, "127.0.0.1", () => r(s));
});
const BASE = `http://127.0.0.1:${server.address().port}`;

const failures = [];
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "pass" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
  if (!ok) failures.push(name);
};

const browser = await launchChromium();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 30000 });

  // 1. The default changes nothing. These are the values the scale had
  //    before tension existed; the dial is only non-breaking if it still
  //    lands on them with nothing set.
  const HISTORIC = {
    "--tantu-thread": "6px",
    "--tantu-knot-1": "6px", "--tantu-knot-2": "12px", "--tantu-knot-3": "18px",
    "--tantu-knot-4": "24px", "--tantu-knot-6": "36px", "--tantu-knot-8": "48px",
    "--tantu-knot-12": "72px",
    "--tantu-gauge-filament": "1px", "--tantu-gauge-ply": "2px",
    "--tantu-gauge-cord": "4px", "--tantu-gauge-braid": "6px",
    "--tantu-target-min": "24px",
  };
  const resolved = await page.evaluate((names) => {
    document.documentElement.style.removeProperty("--tantu-tension");
    // A custom property computes to its token text, so a calc() only resolves
    // to real pixels through a property the engine actually lays out.
    const probe = document.createElement("div");
    probe.style.position = "absolute";
    document.body.appendChild(probe);
    const out = {};
    for (const n of names) {
      probe.style.width = `var(${n})`;
      out[n] = getComputedStyle(probe).width;
    }
    probe.remove();
    return out;
  }, Object.keys(HISTORIC));
  const drifted = Object.entries(HISTORIC).filter(([n, want]) => resolved[n] !== want);
  check(
    "the default sett reproduces the historic scale exactly",
    drifted.length === 0,
    drifted.map(([n, want]) => `${n} ${resolved[n]} != ${want}`).join(", "),
  );

  for (const tension of [0, 0.5, 1]) {
    const name = tension === 0 ? "slack" : tension === 1 ? "taut" : "default";

    await page.evaluate((t) => {
      document.documentElement.style.setProperty("--tantu-tension", String(t));
    }, tension);
    await page.waitForTimeout(120);

    // Reflow, at the criterion's real threshold and the usual widths.
    for (const width of [320, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(80);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      check(`${name}: no horizontal scrolling at ${width}px`, overflow <= 1, `${overflow}px`);
    }

    // Target size — the one most likely to break as the sett closes.
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.waitForTimeout(80);
    const undersized = await undersizedTargets(page);
    check(
      `${name}: every target clears 24x24 (WCAG 2.5.8)`,
      undersized.length === 0,
      undersized.slice(0, 4).map((t) => `${t.what} ${t.w}x${t.h}`).join(", "),
    );
  }
} finally {
  await browser.close();
  server.close();
}

console.log("\n" + "=".repeat(60));
console.log(`${failures.length} failing`);
process.exit(failures.length ? 1 : 0);
