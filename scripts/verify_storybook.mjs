/**
 * Render every published story in Chromium and check it actually appears.
 *
 * `storybook build` succeeding means the code compiled, not that a story
 * renders — a component that throws at mount produces a green build and a red
 * frame. This loads each story's iframe, fails on a thrown error or an empty
 * root, and runs axe over the result in both themes and both directions.
 *
 * Run: npm run build:storybook && node scripts/verify_storybook.mjs
 */
import { chromium } from "playwright";
import http from "node:http";
import path from "node:path";
import fs from "node:fs";

const ROOT = path.resolve("storybook-static");
if (!fs.existsSync(path.join(ROOT, "index.json"))) {
  console.error("storybook-static/index.json missing — run `npm run build:storybook` first");
  process.exit(2);
}

const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
  ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml",
  ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf", ".png": "image/png",
};

const server = await new Promise((resolve) => {
  const s = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, "http://x").pathname);
    const file = path.join(ROOT, rel === "/" ? "/index.html" : rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404).end("not found");
      return;
    }
    res.writeHead(200, { "content-type": MIME[path.extname(file)] ?? "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });
  s.listen(0, "127.0.0.1", () => resolve(s));
});
const base = `http://127.0.0.1:${server.address().port}`;

const index = JSON.parse(fs.readFileSync(path.join(ROOT, "index.json"), "utf8"));
const stories = Object.values(index.entries ?? index.stories ?? {}).filter((e) => e.type !== "docs");

/**
 * Every story in both themes, because contrast is theme-dependent and
 * alternating modes across the set would let a dark-only failure hide behind
 * a story that happened to be sampled in light. Direction is paired with the
 * theme rather than multiplied out: RTL changes layout, not colour, and the
 * vitest sweep already runs every component in all four combinations for the
 * markup rules.
 */
const MODES = [
  { theme: "light", direction: "ltr" },
  { theme: "dark", direction: "rtl" },
];

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"],
});

const AXE_SOURCE = fs.readFileSync(
  path.resolve("node_modules/axe-core/axe.min.js"),
  "utf8",
);

/**
 * Rules that judge a *document*, not the component in the frame.
 *
 * `color-contrast` is deliberately NOT among them, and that is the whole
 * point of running axe here as well as in vitest. jsdom has no cascade, so
 * the unit sweep cannot see a resolved colour and the check is disabled
 * there; the token audit computes pairings, but only pairings someone
 * thought to write down. Neither caught a table's zebra striping set to a
 * theme-invariant cream — near-white ink on a cream row in dark mode,
 * invisible, and passing every check the system had. A real engine
 * measuring real rendered pixels is the only thing that closes that gap.
 */
const PAGE_LEVEL_RULES = [
  "region",
  "landmark-one-main",
  "page-has-heading-one",
  "html-has-lang",
  "html-lang-valid",
  "bypass",
  "document-title",
];

const failures = [];
const contrastFailures = [];
let checked = 0;

try {
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });

  for (const { story, mode } of stories.flatMap((story) => MODES.map((mode) => ({ story, mode })))) {
    const errors = [];
    const onError = (e) => errors.push(String(e));
    page.on("pageerror", onError);

    const url =
      `${base}/iframe.html?id=${encodeURIComponent(story.id)}&viewMode=story` +
      `&globals=theme:${mode.theme};direction:${mode.direction}`;

    try {
      await page.goto(url, { waitUntil: "load", timeout: 20000 });
      // Storybook marks the root when a story has finished rendering; falling
      // back to a short settle keeps this working if that marker changes.
      await page
        .waitForFunction(() => {
          const root = document.querySelector("#storybook-root");
          return root && root.innerHTML.trim().length > 0;
        }, { timeout: 10000 })
        .catch(() => {});
      await page.waitForTimeout(120);

      const state = await page.evaluate(() => {
        const root = document.querySelector("#storybook-root");
        // Storybook keeps its error display in the DOM at all times and hides
        // it with `display: none`, so presence proves nothing — visibility is
        // the question. Checking for the element alone reports every story as
        // broken, which is exactly as useless as reporting none of them.
        const pane = document.querySelector(".sb-errordisplay");
        const visible = pane ? getComputedStyle(pane).display !== "none" : false;
        return {
          empty: !root || root.innerHTML.trim().length === 0,
          shown: visible ? (pane.textContent || "").trim().replace(/\s+/g, " ").slice(0, 200) : "",
        };
      });

      checked += 1;
      if (state.empty) failures.push(`${story.id} [${mode.theme}/${mode.direction}] rendered nothing`);
      else if (state.shown) failures.push(`${story.id} — storybook error pane: ${state.shown}`);
      else if (errors.length) failures.push(`${story.id} — threw: ${errors[0].slice(0, 160)}`);
      else {
        // Only worth measuring once the story is known to have rendered —
        // axe over an empty frame reports a clean bill of health.
        await page.addScriptTag({ content: AXE_SOURCE });
        const violations = await page.evaluate(
          async (disabled) =>
            (
              await window.axe.run("#storybook-root", {
                rules: Object.fromEntries(disabled.map((id) => [id, { enabled: false }])),
                resultTypes: ["violations"],
              })
            ).violations.map((v) => ({
              id: v.id,
              impact: v.impact,
              nodes: v.nodes.slice(0, 2).map((n) => ({
                html: n.html.slice(0, 120),
                summary: (n.failureSummary || "").replace(/\s+/g, " ").slice(0, 200),
              })),
            })),
          PAGE_LEVEL_RULES,
        );
        // WCAG 2.2 SC 2.5.8 Target Size (Minimum): 24x24 CSS px for any
        // interactive target that is not inline in a sentence. axe does not
        // implement this rule, so it is measured directly. The visually-hidden
        // native control behind a custom one is excluded — it is not the
        // target a pointer is aimed at.
        const undersized = await page.evaluate(() =>
          Array.from(
            document.querySelectorAll(
              '#storybook-root button, #storybook-root a[href], #storybook-root input, #storybook-root select, #storybook-root [tabindex="0"]',
            ),
          )
            .filter((el) => !el.classList.contains("tantu-visually-hidden"))
            .map((el) => {
              const r = el.getBoundingClientRect();
              return {
                w: Math.round(r.width),
                h: Math.round(r.height),
                what: `${el.tagName.toLowerCase()}.${(el.getAttribute("class") || "").split(" ")[0]}`,
              };
            })
            .filter((t) => t.w > 0 && t.h > 0 && (t.w < 24 || t.h < 24))
            .slice(0, 3),
        );
        for (const t of undersized) {
          failures.push(
            `${story.id} [${mode.theme}/${mode.direction}] target-size (WCAG 2.2 SC 2.5.8)\n` +
              `        ${t.what} is ${t.w}x${t.h}, under the 24x24 minimum`,
          );
        }

        for (const v of violations) {
          const line =
            `${story.id} [${mode.theme}/${mode.direction}] ${v.id} (${v.impact})\n` +
            v.nodes.map((n) => `        ${n.html}\n        ${n.summary}`).join("\n");
          (v.id === "color-contrast" ? contrastFailures : failures).push(line);
        }
      }
    } catch (e) {
      checked += 1;
      failures.push(`${story.id} — ${String(e).split("\n")[0].slice(0, 160)}`);
    } finally {
      page.off("pageerror", onError);
    }
  }
} finally {
  await browser.close();
  server.close();
}

console.log(
  `${checked} stories rendered · ${failures.length} markup/render failure(s) · ` +
    `${contrastFailures.length} rendered-contrast failure(s)`,
);
for (const f of failures) console.log("  FAIL " + f);
for (const f of contrastFailures) console.log("  CONTRAST " + f);
if (failures.length || contrastFailures.length) process.exit(1);
