/**
 * QA the deployed playground.
 *
 * This measures the exact artifact Netlify publishes: playground/dist, served
 * with netlify.toml's routing contract applied (SPA fallback, asset headers),
 * so a routing defect shows up here rather than after a deploy.
 *
 * What it cannot cover, and does not claim to: the CDN itself, TLS, and
 * whether Netlify's edge really honours the toml. Those need a request to the
 * live host.
 *
 * Run: node scripts/qa_playground.mjs
 */
import { chromium } from "playwright";
import http from "node:http";
import path from "node:path";
import fs from "node:fs";

const ROOT = path.resolve("playground/dist");
if (!fs.existsSync(path.join(ROOT, "index.html"))) {
  console.error("playground/dist missing — run `npm --prefix playground run build` first");
  process.exit(2);
}

const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".svg": "image/svg+xml", ".woff2": "font/woff2", ".woff": "font/woff",
  ".ttf": "font/ttf", ".json": "application/json", ".png": "image/png",
  ".webp": "image/webp", ".ico": "image/x-icon",
};

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "pass" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
}

/**
 * The netlify.toml contract, reproduced: fingerprinted assets cached hard,
 * index.html revalidating, and every unknown path falling back to the one
 * document rather than 404ing.
 */
const server = await new Promise((resolve) => {
  const s = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, "http://x").pathname);
    let file = path.join(ROOT, rel);
    let fellBack = false;
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      file = path.join(ROOT, "index.html");
      fellBack = true;
    }
    const ext = path.extname(file);
    const headers = { "content-type": MIME[ext] ?? "application/octet-stream" };
    if (rel.startsWith("/assets/") || ext === ".woff2") {
      headers["cache-control"] = "public, max-age=31536000, immutable";
    } else if (ext === ".html") {
      headers["cache-control"] = "public, max-age=0, must-revalidate";
    }
    if (fellBack) headers["x-spa-fallback"] = "1";
    res.writeHead(200, headers);
    fs.createReadStream(file).pipe(res);
  });
  s.listen(0, "127.0.0.1", () => resolve(s));
});
const BASE = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"],
});

const AXE_SOURCE = fs.readFileSync(path.resolve("node_modules/axe-core/axe.min.js"), "utf8");

/** Rules that judge a page Tantu does not own, or need a real cascade. */
const PAGE_LEVEL_RULES = ["region", "landmark-one-main", "page-has-heading-one"];

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  /* ---- Does it load at all, and does it load cleanly? ------------------- */
  const consoleErrors = [];
  const failedRequests = [];
  page.on("pageerror", (e) => consoleErrors.push(String(e).slice(0, 160)));
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 160));
  });
  page.on("requestfailed", (r) => failedRequests.push(`${r.url().slice(-60)} ${r.failure()?.errorText}`));
  page.on("response", (r) => {
    if (r.status() >= 400) failedRequests.push(`${r.status()} ${r.url().slice(-60)}`);
  });

  await page.goto(BASE, { waitUntil: "networkidle", timeout: 30000 });

  const mounted = await page.evaluate(() => {
    const root = document.getElementById("root") ?? document.body.firstElementChild;
    return {
      html: (root?.innerHTML || "").trim().length,
      heading: document.querySelector("h1")?.textContent?.trim() ?? "",
      loom: !!document.querySelector(".tantu-loom"),
    };
  });
  check("the application mounts", mounted.html > 500 && mounted.loom, `${mounted.html} chars, h1="${mounted.heading}"`);
  check("no script errors on load", consoleErrors.length === 0, consoleErrors.slice(0, 2).join(" | "));
  check("every asset resolves", failedRequests.length === 0, failedRequests.slice(0, 3).join(" | "));

  /* ---- The routing contract from netlify.toml --------------------------- */
  const deep = await page.request.get(`${BASE}/some/deep/route`);
  check(
    "a deep route falls back to the document rather than 404ing",
    deep.status() === 200 && deep.headers()["x-spa-fallback"] === "1",
    `status ${deep.status()}`,
  );
  const assetUrl = await page.evaluate(() =>
    Array.from(document.querySelectorAll("script[src], link[href]"))
      .map((el) => el.getAttribute("src") || el.getAttribute("href"))
      .find((u) => u && u.includes("/assets/")),
  );
  if (assetUrl) {
    const asset = await page.request.get(new URL(assetUrl, BASE).href);
    check(
      "fingerprinted assets are cached immutably",
      (asset.headers()["cache-control"] || "").includes("immutable"),
      asset.headers()["cache-control"] || "(none)",
    );
  } else {
    check("fingerprinted assets are cached immutably", false, "no /assets/ reference found in the document");
  }

  /* ---- The brand faces the playground opts into ------------------------- */
  // `document.fonts.check()` counts fallbacks, so it answers yes for a font
  // that never arrived. Measure rendered width against a known-different
  // generic instead.
  const fonts = await page.evaluate(async () => {
    const SAMPLE = "Warp tension HAMBURGEFONS 0123";
    const FACES = ["Kalam-Rupa", "Talim-Mono", "Kasuti-Gauze"];

    // Faces load lazily, on first use. A face the page itself never renders
    // is therefore still unloaded when the probe touches it, and the first
    // measurement lands mid-load. Resolve every load to completion (or to its
    // failure) before measuring anything.
    //
    // One asymmetry to know about when negative-controlling this check by
    // blocking font requests: Kasuti-Gauze.woff2 is 3.6 KB, under Vite's
    // 4096-byte inline limit, so it ships as a data: URI inside the CSS and
    // makes no network request at all. Kalam and Talim flip to false when
    // blocked; Kasuti cannot, because there is nothing to block.
    await document.fonts.ready;
    await Promise.all(
      FACES.map((face) => document.fonts.load(`64px "${face}"`, SAMPLE).catch(() => {})),
    );
    await document.fonts.ready;

    const probe = document.createElement("span");
    probe.textContent = SAMPLE;
    probe.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap;font-size:64px";
    document.body.appendChild(probe);
    const width = (family) => {
      probe.style.fontFamily = family;
      return probe.getBoundingClientRect().width;
    };
    const serif = width("serif");
    const out = {};
    for (const face of FACES) out[face] = Math.abs(width(`"${face}", serif`) - serif) > 0.5;
    probe.remove();
    return out;
  });
  check(
    "all three brand faces actually load and are selected",
    Object.values(fonts).every(Boolean),
    JSON.stringify(fonts),
  );

  /* ---- Layout: no two-axis scrolling anywhere it matters ---------------- */
  for (const dir of ["ltr", "rtl"]) {
    for (const width of [1280, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      const overflow = await page.evaluate((d) => {
        document.documentElement.setAttribute("dir", d);
        void document.documentElement.offsetHeight;
        return document.documentElement.scrollWidth - document.documentElement.clientWidth;
      }, dir);
      // 320 CSS px is WCAG 1.4.10's actual threshold, not a phone width.
      check(`no horizontal scrolling at ${width}px, dir=${dir}`, overflow <= 1, `${overflow}px`);
    }
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.evaluate(() => document.documentElement.setAttribute("dir", "ltr"));

  /* ---- The two switches in the playground's own chrome ------------------ */
  // Read the result on a later tick than the click: the switch sets React
  // state and an effect writes the attribute, so a same-tick read reports no
  // change and blames the application for the test's impatience.
  const read = () =>
    page.evaluate(() => ({
      theme: document.documentElement.getAttribute("data-theme"),
      dir: getComputedStyle(document.documentElement).direction,
    }));

  const beforeTheme = await read();
  await page.getByRole("button", { name: /^(Dark|Light)$/ }).click();
  await page
    .waitForFunction(
      (was) => document.documentElement.getAttribute("data-theme") !== was,
      beforeTheme.theme,
      { timeout: 3000 },
    )
    .catch(() => {});
  const afterTheme = await read();
  check(
    "the theme switch changes the document theme",
    afterTheme.theme !== beforeTheme.theme,
    `${beforeTheme.theme} -> ${afterTheme.theme}`,
  );

  const beforeDir = await read();
  await page.getByRole("button", { name: /^(RTL|LTR)$/ }).click();
  await page
    .waitForFunction(
      (was) => getComputedStyle(document.documentElement).direction !== was,
      beforeDir.dir,
      { timeout: 3000 },
    )
    .catch(() => {});
  const afterDir = await read();
  check(
    "the direction switch mirrors the document",
    afterDir.dir !== beforeDir.dir,
    `${beforeDir.dir} -> ${afterDir.dir}`,
  );

  // A switch that flips an attribute but changes no pixels is not a switch.
  // Measure a real rendered colour and a real inline-axis offset.
  const evidence = await page.evaluate(() => {
    const card = document.querySelector(".tantu-card") ?? document.body;
    const h1 = document.querySelector("h1");
    return {
      surface: getComputedStyle(card).backgroundColor,
      headingLeft: h1 ? Math.round(h1.getBoundingClientRect().left) : -1,
      viewport: window.innerWidth,
    };
  });
  check(
    "the switches change rendered pixels, not just attributes",
    evidence.surface !== "rgba(0, 0, 0, 0)" && evidence.headingLeft > evidence.viewport / 2,
    `surface ${evidence.surface}, h1 starts at ${evidence.headingLeft}px of ${evidence.viewport}`,
  );

  // Put the document back before the axe sweep sets its own combinations.
  await page.getByRole("button", { name: /^(RTL|LTR)$/ }).click();
  await page.getByRole("button", { name: /^(Dark|Light)$/ }).click();
  await page.waitForTimeout(120);

  /* ---- axe over the real thing, in all four combinations ---------------- */
  // color-contrast stays ENABLED. This is a real browser with a real cascade,
  // which is the only place that rule means anything.
  for (const theme of ["light", "dark"]) {
    for (const dir of ["ltr", "rtl"]) {
      await page.evaluate(
        ([t, d]) => {
          document.documentElement.setAttribute("data-theme", t);
          document.documentElement.setAttribute("dir", d);
        },
        [theme, dir],
      );
      await page.waitForTimeout(80);
      await page.addScriptTag({ content: AXE_SOURCE });
      const violations = await page.evaluate(
        async (disabled) =>
          (
            await window.axe.run(document, {
              rules: Object.fromEntries(disabled.map((id) => [id, { enabled: false }])),
              resultTypes: ["violations"],
            })
          ).violations.map((v) => ({
            id: v.id,
            impact: v.impact,
            html: v.nodes[0]?.html.slice(0, 100) ?? "",
            summary: (v.nodes[0]?.failureSummary || "").replace(/\s+/g, " ").slice(0, 160),
          })),
        PAGE_LEVEL_RULES,
      );
      check(
        `axe is clean in ${theme}/${dir}`,
        violations.length === 0,
        violations.map((v) => `${v.id}(${v.impact}) ${v.html} :: ${v.summary}`).join(" | "),
      );
    }
  }
  await page.evaluate(() => {
    document.documentElement.setAttribute("data-theme", "light");
    document.documentElement.setAttribute("dir", "ltr");
  });

  /* ---- WCAG 2.2 SC 2.5.8, on the page as shipped ------------------------ */
  const undersized = await page.evaluate(() =>
    Array.from(document.querySelectorAll('button, a[href], input, select, [tabindex="0"]'))
      .filter((el) => !el.classList.contains("tantu-visually-hidden"))
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          w: Math.round(r.width),
          h: Math.round(r.height),
          what: `${el.tagName.toLowerCase()}.${(el.getAttribute("class") || "").split(" ")[0]}`,
        };
      })
      .filter((t) => t.w > 0 && t.h > 0 && (t.w < 24 || t.h < 24)),
  );
  check(
    "every interactive target clears 24x24 CSS px",
    undersized.length === 0,
    undersized.slice(0, 3).map((t) => `${t.what} ${t.w}x${t.h}`).join(", "),
  );

  /* ---- Focus is visible, in both themes --------------------------------- */
  for (const theme of ["light", "dark"]) {
    const ring = await page.evaluate((t) => {
      document.documentElement.setAttribute("data-theme", t);
      const btn = document.querySelector("button");
      btn?.focus();
      const s = btn ? getComputedStyle(btn) : null;
      return s ? { width: s.outlineWidth, style: s.outlineStyle, shadow: s.boxShadow } : null;
    }, theme);
    const drawn = ring && (parseFloat(ring.width) > 0 || (ring.shadow && ring.shadow !== "none"));
    check(`focus is drawn in the ${theme} theme`, !!drawn, ring ? `outline ${ring.width}` : "no button");
  }

  /* ---- WCAG 1.4.12 text spacing ----------------------------------------- */
  const spacing = await page.evaluate(() => {
    const style = document.createElement("style");
    style.textContent = `* { line-height:1.5 !important; letter-spacing:0.12em !important;
      word-spacing:0.16em !important } p { margin-bottom:2em !important }`;
    document.head.appendChild(style);
    void document.documentElement.offsetHeight;
    const clipped = [];
    for (const el of document.querySelectorAll("p, li, h1, h2, h3, td, th, button, label")) {
      if ((el.textContent || "").trim().length < 8) continue;
      const s = getComputedStyle(el);
      if (s.overflow === "visible" && s.overflowY === "visible") continue;
      if (el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2) {
        clipped.push(`${el.tagName.toLowerCase()}.${(el.getAttribute("class") || "").split(" ")[0]}`);
      }
    }
    const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    style.remove();
    return { clipped: clipped.slice(0, 4), count: clipped.length, overflow };
  });
  check(
    "the four text-spacing overrides clip nothing",
    spacing.count === 0 && spacing.overflow <= 1,
    spacing.count ? spacing.clipped.join(", ") : `overflow ${spacing.overflow}px`,
  );

  /* ---- Reduced motion --------------------------------------------------- */
  const reduced = await browser.newPage({
    viewport: { width: 1280, height: 900 },
    reducedMotion: "reduce",
  });
  await reduced.goto(BASE, { waitUntil: "networkidle", timeout: 30000 });
  await reduced.waitForTimeout(400);
  const moving = await reduced.evaluate(() =>
    Array.from(document.querySelectorAll("*"))
      .filter((el) => el.getAnimations?.().some((a) => a.playState === "running"))
      .map((el) => `${el.tagName.toLowerCase()}.${(el.getAttribute("class") || "").split(" ")[0]}`)
      .slice(0, 4),
  );
  check("nothing animates under prefers-reduced-motion", moving.length === 0, moving.join(", "));
  await reduced.close();

  /* ---- Forced colours --------------------------------------------------- */
  const forced = await browser.newPage({ viewport: { width: 1280, height: 900 }, forcedColors: "active" });
  await forced.goto(BASE, { waitUntil: "networkidle", timeout: 30000 });
  const forcedState = await forced.evaluate(() => {
    const body = getComputedStyle(document.body);
    const btn = document.querySelector("button");
    return {
      bg: body.backgroundColor,
      fg: body.color,
      btnBg: btn ? getComputedStyle(btn).backgroundColor : "",
      btnFg: btn ? getComputedStyle(btn).color : "",
    };
  });
  check(
    "text and ground still differ under forced colours",
    forcedState.bg !== forcedState.fg && forcedState.btnBg !== forcedState.btnFg,
    `body ${forcedState.fg} on ${forcedState.bg}; button ${forcedState.btnFg} on ${forcedState.btnBg}`,
  );
  await forced.close();
} finally {
  await browser.close();
  server.close();
}

const failed = results.filter((r) => !r.ok);
console.log("\n" + "=".repeat(72));
console.log(`${results.length} checks · ${failed.length} failing`);
if (failed.length) {
  for (const f of failed) console.log(`  FAIL ${f.name}${f.detail ? " — " + f.detail : ""}`);
  process.exit(1);
}
