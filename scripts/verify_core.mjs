/**
 * Phase Zero: the loom separated from the cloth, and nothing moved.
 *
 * Tantu is one tradition expressed on a general structure. Until now the two
 * were the same names and the same numbers: the lattice was called
 * `--tantu-*`, and the wicking law's two constants were compiled into the
 * shader as literals — which did not merely duplicate them, it froze them.
 * Every surface on every page wicked like cotton, because cotton is what
 * 0.18 and 0.04 describe.
 *
 * This sweep asserts the two halves of that split:
 *
 *   1. NOTHING MOVED. Every `--tantu-*` lattice token resolves to exactly
 *      the pixel value it always did, under the historic default and under
 *      both extremes of the dial. An extraction that changes what existing
 *      consumers render is a rewrite wearing a refactor's clothes.
 *
 *   2. THE AXIS IS REAL. Fibre changes the geometry of a dye front, not a
 *      label on it. Felt — matted, never woven, no thread axes — must
 *      produce a perfectly circular front, and that is checkable without
 *      timing luck because the ratio rx/ry is 1 + anisotropy·p at every
 *      frame, so anisotropy 0 gives exactly 1 whenever it is sampled.
 *
 * Run: node scripts/verify_core.mjs   (needs playground/dist)
 */
import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import { launchChromium } from "./chromium.mjs";

const ROOT = path.resolve("playground/dist");
if (!fs.existsSync(path.join(ROOT, "index.html"))) {
  console.error("playground/dist is missing — run `npm --prefix playground run build` first");
  process.exit(2);
}

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

/** The lattice, by both names. A custom property computes to its own token
 *  text, so resolve each through a property the engine actually lays out. */
const LATTICE = [
  ["--tantu-thread", "--weave-thread"],
  ["--tantu-knot-1", "--weave-knot-1"],
  ["--tantu-knot-2", "--weave-knot-2"],
  ["--tantu-knot-3", "--weave-knot-3"],
  ["--tantu-knot-4", "--weave-knot-4"],
  ["--tantu-knot-6", "--weave-knot-6"],
  ["--tantu-knot-8", "--weave-knot-8"],
  ["--tantu-knot-12", "--weave-knot-12"],
  ["--tantu-gauge-filament", "--weave-gauge-filament"],
  ["--tantu-gauge-ply", "--weave-gauge-ply"],
  ["--tantu-gauge-cord", "--weave-gauge-cord"],
  ["--tantu-gauge-braid", "--weave-gauge-braid"],
  ["--tantu-target-min", "--weave-target-min"],
];

/** The values every consumer has rendered against since before the split. */
const HISTORIC = {
  "--tantu-thread": "6px",
  "--tantu-knot-1": "6px", "--tantu-knot-2": "12px", "--tantu-knot-3": "18px",
  "--tantu-knot-4": "24px", "--tantu-knot-6": "36px", "--tantu-knot-8": "48px",
  "--tantu-knot-12": "72px",
  "--tantu-gauge-filament": "1px", "--tantu-gauge-ply": "2px",
  "--tantu-gauge-cord": "4px", "--tantu-gauge-braid": "6px",
  "--tantu-target-min": "24px",
};

const browser = await launchChromium();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 30000 });

  const measure = (names) =>
    page.evaluate((list) => {
      const probe = document.createElement("div");
      probe.style.position = "absolute";
      document.body.appendChild(probe);
      const out = {};
      for (const n of list) {
        probe.style.width = `var(${n})`;
        out[n] = getComputedStyle(probe).width;
      }
      probe.remove();
      return out;
    }, names);

  const setSett = (prop, value) =>
    page.evaluate(
      ([p, v]) => {
        document.documentElement.style.removeProperty("--tantu-tension");
        document.documentElement.style.removeProperty("--weave-sett");
        if (p) document.documentElement.style.setProperty(p, v);
      },
      [prop, value],
    );

  /* ---- 1. Nothing moved ------------------------------------------------ */
  await setSett(null, null);
  await page.waitForTimeout(80);
  const flat = LATTICE.flat();
  let m = await measure(flat);

  const drifted = Object.entries(HISTORIC).filter(([n, want]) => m[n] !== want);
  check(
    "the historic scale is unchanged by the extraction",
    drifted.length === 0,
    drifted.map(([n, want]) => `${n} ${m[n]} != ${want}`).join(", "),
  );

  let mismatched = LATTICE.filter(([t, w]) => m[t] !== m[w]);
  check(
    "every tradition token resolves to its core token, not a copy of it",
    mismatched.length === 0,
    mismatched.map(([t, w]) => `${t}=${m[t]} vs ${w}=${m[w]}`).join(", "),
  );

  /* ---- 2. Both names still drive the lattice --------------------------- */
  // The legacy input has to keep working untouched: the playground, the site
  // and every existing consumer set --tantu-tension and nothing else.
  await setSett("--tantu-tension", "1");
  await page.waitForTimeout(80);
  m = await measure(flat);
  check(
    "the legacy input re-setts the whole lattice",
    m["--tantu-thread"] === "4px" && m["--tantu-knot-4"] === "16px",
    `thread ${m["--tantu-thread"]}, knot-4 ${m["--tantu-knot-4"]}`,
  );
  check(
    "and the floor still refuses to follow it down",
    m["--tantu-target-min"] === "24px",
    m["--tantu-target-min"],
  );

  // The core name has to work as an input too, or the split is cosmetic.
  await setSett("--weave-sett", "0");
  await page.waitForTimeout(80);
  m = await measure(flat);
  check(
    "the core input re-setts it the same way",
    m["--tantu-thread"] === "8px" && m["--weave-thread"] === "8px",
    `tantu ${m["--tantu-thread"]}, weave ${m["--weave-thread"]}`,
  );

  await setSett(null, null);
  await page.waitForTimeout(80);

  /* ---- 3. Fibre is declared, and it is cotton -------------------------- */
  const fibre = await page.evaluate(() => {
    const s = getComputedStyle(document.documentElement);
    return {
      name: s.getPropertyValue("--weave-fibre").trim(),
      // Numbers, not strings: the engine hands back a custom property in its
      // own normalised form — "0.18" comes out as ".18" — so comparing text
      // fails on a value that is perfectly correct.
      anisotropy: parseFloat(s.getPropertyValue("--weave-anisotropy")),
      t0: parseFloat(s.getPropertyValue("--weave-wick-t0")),
    };
  });
  check(
    "the cloth is stated, and it is the one every consumer rendered against",
    fibre.name === "cotton" && fibre.anisotropy === 0.18 && fibre.t0 === 0.04,
    `${fibre.name} a=${fibre.anisotropy} t0=${fibre.t0}`,
  );

  /* ---- 4. The axis has a consequence ----------------------------------- */
  // Sampling a running animation is usually timing-dependent. This one is
  // not: the component writes rx = ry·(1 + a·p) every frame, so the *ratio*
  // is 1 + a·p and at a = 0 it is exactly 1 whenever it happens to be read.
  const flipAndSampleRatio = async (anisotropy) => {
    // Set on the CARD, not the root. Reading the fibre from
    // document.documentElement would satisfy a root-scoped test while
    // ignoring the cascade entirely — and it did: neutering the component to
    // `fibreFrom(null)` passed the first version of this check, because the
    // root was where the test had put the value. Re-fibring one region is the
    // actual promise, so the test has to make region and root disagree.
    await page.evaluate((a) => {
      const card = document.querySelector(".tantu-card-rumal");
      document.documentElement.style.removeProperty("--weave-anisotropy");
      if (a === null) card.style.removeProperty("--weave-anisotropy");
      else card.style.setProperty("--weave-anisotropy", String(a));
    }, anisotropy);

    const card = page.locator(".tantu-card-rumal").first();
    const state = await card.getAttribute("data-state");
    const label = state === "reverse" ? "Turn back" : "Turn the cloth";
    await card.getByRole("button", { name: label }).click();
    await page.waitForTimeout(400); // mid-flight, wherever that lands

    return page.evaluate(() => {
      const face = document.querySelector(
        ".tantu-card-rumal .tantu-rumal-reverse, .tantu-card-rumal .tantu-rumal-obverse",
      );
      const read = (el, prop) => parseFloat(el.style.getPropertyValue(prop));
      for (const f of document.querySelectorAll(".tantu-rumal-obverse, .tantu-rumal-reverse")) {
        const rx = read(f, "--tantu-rumal-rx");
        const ry = read(f, "--tantu-rumal-ry");
        if (Number.isFinite(rx) && Number.isFinite(ry) && ry > 0 && ry < 9999) {
          return { rx, ry, ratio: rx / ry };
        }
      }
      return face ? null : null;
    });
  };

  const woven = await flipAndSampleRatio(0.3);
  check(
    "a woven cloth spreads further along the threads than across them",
    woven !== null && woven.ratio > 1.001,
    woven ? `rx/ry = ${woven.ratio.toFixed(4)}` : "no front in flight",
  );

  await page.waitForTimeout(2200);
  const matted = await flipAndSampleRatio(0);
  check(
    "felt has no threads to climb, so its front stays a circle",
    matted !== null && Math.abs(matted.ratio - 1) < 1e-6,
    matted ? `rx/ry = ${matted.ratio.toFixed(6)}` : "no front in flight",
  );

  check(
    "and the two are actually different, which is what makes it an axis",
    woven !== null && matted !== null && woven.ratio > matted.ratio + 0.001,
    woven && matted ? `${woven.ratio.toFixed(4)} vs ${matted.ratio.toFixed(4)}` : "",
  );
} finally {
  await browser.close();
  server.close();
}

console.log(`\n${"=".repeat(60)}\n${failures.length} failing`);
process.exit(failures.length ? 1 : 0);
