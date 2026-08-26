/**
 * The checks that need a real engine.
 *
 * jsdom has no layout, no cascade, no GPU and no forced-colors mode, so the
 * vitest suite deliberately does not pretend to cover any of it. This does:
 * it loads the generated page in Chromium and measures the things that only
 * exist once pixels do.
 *
 * Run: node scripts/verify_browser.mjs
 * Exits non-zero on the first failed check.
 */
import { chromium } from "playwright";
import http from "node:http";
import path from "node:path";
import fs from "node:fs";

const failures = [];

const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".svg": "image/svg+xml", ".woff2": "font/woff2", ".woff": "font/woff",
  ".ttf": "font/ttf", ".json": "application/json", ".png": "image/png",
};

/**
 * The page loads its client assets as ES modules, which the file:// origin
 * refuses on CORS grounds — that refusal is an artefact of the harness, not
 * of the page, so serve the built directory over http and measure the real
 * thing.
 */
function serve(root) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const rel = decodeURIComponent(new URL(req.url, "http://x").pathname);
      const file = path.join(root, rel === "/" ? "/index.html" : rel);
      if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404).end("not found");
        return;
      }
      res.writeHead(200, { "content-type": MIME[path.extname(file)] ?? "application/octet-stream" });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function check(name, ok, detail = "") {
  const line = `${ok ? "pass" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`;
  console.log(line);
  if (!ok) failures.push(name);
}

if (!fs.existsSync("index.html")) {
  console.error("index.html not built — run `npm run build` first");
  process.exit(2);
}

const server = await serve(path.resolve("."));
const PAGE = `http://127.0.0.1:${server.address().port}/index.html`;

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"],
});

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  // Third-party origins (the Google Fonts stylesheet) and favicon lookups are
  // not what this harness measures, and outbound network is blocked in the
  // sandbox it runs in — a failure there says nothing about the page.
  const isExternal = (url) => !url.startsWith(`http://127.0.0.1:`) || /favicon/.test(url);
  const consoleErrors = [];
  page.on("console", (m) => {
    // A resource that failed to load reports its URL in the message location,
    // not the text; filtering on the text alone would keep every one of them.
    if (m.type() !== "error") return;
    if (isExternal(m.location()?.url ?? "")) return;
    consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => consoleErrors.push(String(e)));
  page.on("requestfailed", (r) => {
    if (!isExternal(r.url())) consoleErrors.push(`request failed ${r.url()}`);
  });
  page.on("response", (r) => {
    if (r.status() >= 400 && !isExternal(r.url())) consoleErrors.push(`${r.status()} ${r.url()}`);
  });

  await page.goto(PAGE, { waitUntil: "networkidle" });

  check("page loads with no script or same-origin resource errors", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));

  /* ---- WebGL context pooling ------------------------------------------- */
  // Safari caps live WebGL contexts per page and drops the oldest past the
  // cap, blanking bleed surfaces mid-scroll. Tantu's claim is that the whole
  // page shares exactly one context regardless of how many surfaces exist.
  const gl = await page.evaluate(() => {
    const canvases = Array.from(document.querySelectorAll("canvas"));
    let live = 0;
    for (const c of canvases) {
      // getContext returns the SAME object for a context already created on
      // that canvas, and null-ish for one that never had a webgl context.
      // Asking for "2d" on a webgl canvas throws/returns null, so this
      // distinguishes them without creating anything new.
      try {
        if (c.getContext("webgl", { failIfMajorPerformanceCaveat: false })) live += 1;
      } catch {
        /* a 2d canvas: not a webgl context */
      }
    }
    return { canvases: canvases.length, live };
  });
  check(
    "at most one WebGL context for the whole page",
    gl.live <= 1,
    `${gl.canvases} canvases, ${gl.live} webgl contexts`,
  );

  /* ---- No horizontal overflow, both directions ------------------------- */
  for (const dir of ["ltr", "rtl"]) {
    for (const width of [1280, 768, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate((d) => document.documentElement.setAttribute("dir", d), dir);
      await page.waitForTimeout(120);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      check(`no horizontal overflow at ${width}px, dir=${dir}`, overflow <= 1, `${overflow}px`);
    }
  }
  await page.setViewportSize({ width: 1280, height: 900 });

  /* ---- The RTL mirror actually happens --------------------------------- */
  // A logical property that failed to convert shows up as an element whose
  // inline-start edge did not move when the direction flipped.
  const mirrored = await page.evaluate(() => {
    // Injected rather than found, so the check does not depend on the demo
    // page happening to include one.
    const el = document.createElement("div");
    el.className = "tantu-notice tantu-notice-critical";
    document.body.appendChild(el);
    const probe = () => {
      const s = getComputedStyle(el);
      return { start: s.borderInlineStartWidth, left: s.borderLeftWidth, right: s.borderRightWidth };
    };
    document.documentElement.setAttribute("dir", "ltr");
    const ltr = probe();
    document.documentElement.setAttribute("dir", "rtl");
    const rtl = probe();
    document.documentElement.setAttribute("dir", "ltr");
    el.remove();
    return { ltr, rtl };
  });
  check(
    "the notice accent rule mirrors with the writing direction",
    // The accent bar must move to the other physical side, while the logical
    // side it is declared on stays put.
    mirrored.ltr.left === mirrored.rtl.right &&
      mirrored.ltr.right === mirrored.rtl.left &&
      mirrored.ltr.left !== mirrored.ltr.right &&
      mirrored.ltr.start === mirrored.rtl.start,
    `ltr(l=${mirrored.ltr.left},r=${mirrored.ltr.right}) rtl(l=${mirrored.rtl.left},r=${mirrored.rtl.right})`,
  );

  /* ---- The direction sign token reaches a transform -------------------- */
  const flip = await page.evaluate(() => {
    const read = () => getComputedStyle(document.documentElement).getPropertyValue("--tantu-flip").trim();
    document.documentElement.setAttribute("dir", "ltr");
    const ltr = read();
    document.documentElement.setAttribute("dir", "rtl");
    const rtl = read();
    document.documentElement.setAttribute("dir", "ltr");
    return { ltr, rtl };
  });
  check("--tantu-flip inverts under dir=rtl", flip.ltr === "1" && flip.rtl === "-1", JSON.stringify(flip));

  /* ---- The scoped reset does not reach the host ------------------------ */
  const reset = await page.evaluate(() => {
    const host = document.createElement("div");
    host.style.borderRadius = "12px";
    const tantu = document.createElement("div");
    tantu.className = "tantu-card";
    document.body.append(host, tantu);
    const out = {
      host: getComputedStyle(host).borderRadius,
      tantu: getComputedStyle(tantu).borderRadius,
    };
    host.remove();
    tantu.remove();
    return out;
  });
  check(
    "the border-radius reset is scoped to Tantu's own elements",
    reset.host === "12px" && reset.tantu === "0px",
    `host=${reset.host} tantu=${reset.tantu}`,
  );

  /* ---- Focus indicator is visible in both themes ----------------------- */
  for (const theme of ["light", "dark"]) {
    const shown = await page.evaluate((t) => {
      document.documentElement.setAttribute("data-theme", t);
      const btn = document.querySelector("button, a[href]");
      if (!btn) return null;
      btn.focus();
      const s = getComputedStyle(btn);
      return { outline: s.outlineWidth, shadow: s.boxShadow };
    }, theme);
    check(
      `focus is drawn in the ${theme} theme`,
      Boolean(shown) && (parseFloat(shown.outline) > 0 || (shown.shadow && shown.shadow !== "none")),
      shown ? `outline=${shown.outline}` : "no focusable element",
    );
  }
  await page.evaluate(() => document.documentElement.removeAttribute("data-theme"));

  /* ---- Forced colors ---------------------------------------------------- */
  const forced = await browser.newContext({ forcedColors: "active", viewport: { width: 1280, height: 900 } });
  const fPage = await forced.newPage();
  await fPage.goto(PAGE, { waitUntil: "networkidle" });
  const fc = await fPage.evaluate(() => {
    const out = {};
    const canvas = document.querySelector(".tantu-bleed-canvas");
    out.decorationsWithdrawn = canvas ? getComputedStyle(canvas).display === "none" : "no-canvas";
    const btn = document.querySelector(".tantu-btn-primary");
    out.primaryFill = btn ? getComputedStyle(btn).backgroundColor : "no-button";
    const body = getComputedStyle(document.body);
    out.bodyBg = body.backgroundColor;
    out.bodyInk = body.color;
    return out;
  });
  check(
    "decorative dye layers are withdrawn under forced colours",
    fc.decorationsWithdrawn === true || fc.decorationsWithdrawn === "no-canvas",
    String(fc.decorationsWithdrawn),
  );
  check(
    "body text and ground differ under forced colours",
    fc.bodyBg !== fc.bodyInk,
    `${fc.bodyBg} on ${fc.bodyInk}`,
  );
  await forced.close();

  /* ---- prefers-reduced-motion ------------------------------------------ */
  const reduced = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1280, height: 900 } });
  const rPage = await reduced.newPage();
  await rPage.goto(PAGE, { waitUntil: "networkidle" });
  const stillMoving = await rPage.evaluate(() =>
    Array.from(document.querySelectorAll("*"))
      .filter((el) => {
        const s = getComputedStyle(el);
        return s.animationName !== "none" && parseFloat(s.animationDuration) > 0.1;
      })
      .slice(0, 5)
      .map((el) => el.className + " :: " + getComputedStyle(el).animationName),
  );
  check("nothing keeps animating under prefers-reduced-motion", stillMoving.length === 0, stillMoving.join(" | "));
  await reduced.close();
} finally {
  await browser.close();
  server.close();
}

console.log("\n" + "=".repeat(70));
if (failures.length) {
  console.log(`${failures.length} browser check(s) failed: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("all browser checks passed");
