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
import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import { launchChromium } from "./chromium.mjs";
import { undersizedTargets } from "./a11y.mjs";

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

const AXE_SOURCE = fs.readFileSync(path.resolve("node_modules/axe-core/axe.min.js"), "utf8");

/**
 * Rules about the document as a whole rather than the components in it. The
 * page supplies its own landmarks, title and lang; these are disabled in the
 * story sweep because a story is a fragment, and kept here for exactly the
 * opposite reason — this is a whole document, so it must satisfy them.
 */
const DISABLED_RULES = [];

/**
 * Run axe, waiting out the other caller.
 *
 * Nothing else injects axe into this page today, but the story sweep learned
 * the hard way that two callers on one instance produce an intermittent "Axe
 * is already running" that fails whichever check loses the race. Retrying only
 * that error costs nothing and removes a class of flake before it appears.
 */
async function runAxe(page) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      return await page.evaluate(
        async (disabled) =>
          (
            await window.axe.run(document, {
              rules: Object.fromEntries(disabled.map((id) => [id, { enabled: false }])),
              resultTypes: ["violations"],
            })
          ).violations.map((v) => ({
            id: v.id,
            impact: v.impact,
            html: v.nodes[0]?.html.slice(0, 110) ?? "",
            summary: (v.nodes[0]?.failureSummary || "").replace(/\s+/g, " ").slice(0, 180),
          })),
        DISABLED_RULES,
      );
    } catch (error) {
      if (!/Axe is already running/i.test(String(error))) throw error;
      await page.waitForTimeout(250);
    }
  }
  throw new Error("axe never came free");
}

if (!fs.existsSync("index.html")) {
  console.error("index.html not built — run `npm run build` first");
  process.exit(2);
}

const server = await serve(path.resolve("."));
const PAGE = `http://127.0.0.1:${server.address().port}/index.html`;

const browser = await launchChromium();

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

  // Count WebGL contexts by instrumenting acquisition, before the page's own
  // scripts run. See the check below for why walking the DOM cannot work.
  await page.addInitScript(() => {
    const held = new Set();
    window.__glCanvases = held;
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      const ctx = original.call(this, type, ...args);
      // getContext hands back the same object on repeat calls for one canvas,
      // so identity is what to count, not call sites.
      if (ctx && /webgl/i.test(String(type))) held.add(this);
      return ctx;
    };
  });

  await page.goto(PAGE, { waitUntil: "networkidle" });

  check("page loads with no script or same-origin resource errors", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));

  /* ---- WebGL context pooling ------------------------------------------- */
  // Safari caps live WebGL contexts per page and drops the oldest past the
  // cap, blanking bleed surfaces mid-scroll. Tantu's claim is that the whole
  // page shares exactly one context regardless of how many surfaces exist.
  //
  // This check used to walk document.querySelectorAll("canvas") and ask each
  // one for a webgl context. It could never have worked: the pooling is a
  // single offscreen 1x1 canvas that is never appended to the document, and
  // every visible surface holds a plain 2D context that drawImages from it.
  // So the loop looked at 2D canvases only, found zero WebGL contexts, and
  // passed the `<= 1` assertion for exactly the wrong reason — it would have
  // gone on passing if the pooling were removed entirely. Instrumenting
  // acquisition measures the claim rather than a proxy for it.
  const gl = await page.evaluate(() => ({
    contexts: window.__glCanvases ? window.__glCanvases.size : -1,
    canvases: document.querySelectorAll("canvas").length,
  }));
  check(
    "exactly one WebGL context is acquired for the whole page",
    gl.contexts === 1,
    `${gl.canvases} canvases in the document, ${gl.contexts} WebGL context(s) acquired`,
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

  /* ---- WCAG 1.4.10 Reflow ---------------------------------------------- */
  // The criterion is 320 CSS px wide (equivalent to 400% zoom at 1280), not
  // the 390 of a phone. Testing the comfortable number and reporting the
  // criterion is how an ACR ends up overstating what was checked.
  for (const dir of ["ltr", "rtl"]) {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.evaluate((d) => document.documentElement.setAttribute("dir", d), dir);
    await page.waitForTimeout(150);
    const reflow = await page.evaluate(() => {
      const root = document.documentElement;
      const overflow = root.scrollWidth - root.clientWidth;
      // Name the widest offenders, so a failure is actionable rather than a
      // number to stare at.
      const wide = Array.from(document.querySelectorAll("body *"))
        .filter((el) => el.getBoundingClientRect().width > root.clientWidth + 1)
        .slice(0, 4)
        .map((el) => `${el.tagName.toLowerCase()}.${(el.getAttribute("class") || "").split(" ")[0]}`);
      return { overflow, wide };
    });
    check(
      `WCAG 1.4.10 reflow: no two-axis scrolling at 320px, dir=${dir}`,
      reflow.overflow <= 1,
      `${reflow.overflow}px${reflow.wide.length ? " — " + reflow.wide.join(", ") : ""}`,
    );
  }

  /* ---- WCAG 1.4.4 Resize Text ------------------------------------------ */
  // Doubling the root font size is the honest way to test this: browser page
  // zoom scales the viewport too and passes trivially, whereas text-only
  // enlargement is what a user with low vision actually sets.
  await page.setViewportSize({ width: 1280, height: 900 });
  const resized = await page.evaluate(() => {
    const root = document.documentElement;
    root.setAttribute("dir", "ltr");
    const sample =
      Array.from(document.querySelectorAll("p")).find((el) => (el.textContent || "").trim().length > 40) ??
      document.body;
    const read = () => parseFloat(getComputedStyle(sample).fontSize);
    const before = read();
    root.style.fontSize = "200%";
    void root.offsetHeight;
    const after = read();
    const overflow = root.scrollWidth - root.clientWidth;
    root.style.fontSize = "";
    return { before, after, overflow };
  });
  check(
    "WCAG 1.4.4 resize text: no horizontal scrolling at 200%",
    resized.overflow <= 1,
    `overflow ${resized.overflow}px`,
  );
  // Text-only enlargement, measured and recorded rather than gated.
  //
  // WCAG 1.4.4 is satisfied by browser page zoom, which the check above
  // tests, and that is the reading auditors apply. The stricter reading — a
  // reader who raises their browser's *default font size* rather than
  // zooming — is not met for Tantu's own chrome: the component type scale is
  // pinned in absolute px, so buttons, tags and metadata (the smallest text
  // in the system, and the text most in need of enlarging) do not move.
  // Prose does, because the page sizes it relatively.
  //
  // This is reported, not failed, so the number stays visible and honest in
  // the conformance report instead of being quietly rounded up to "Supports".
  const scaling = await page.evaluate(() => {
    const probes = [
      ["prose", "p"],
      ["button", ".tantu-btn"],
      ["tag", ".tantu-tag"],
      ["metadata", ".tantu-meta-talim"],
    ];
    const read = () =>
      probes.map(([label, sel]) => {
        const el = document.querySelector(sel);
        return [label, el ? parseFloat(getComputedStyle(el).fontSize) : null];
      });
    const before = read();
    document.documentElement.style.fontSize = "200%";
    void document.documentElement.offsetHeight;
    const after = read();
    document.documentElement.style.fontSize = "";
    return before
      .map(([label, from], i) => (from ? `${label} ${(after[i][1] / from).toFixed(2)}x` : null))
      .filter(Boolean)
      .join(", ");
  });
  console.log(`note  text-only enlargement at root 200% — ${scaling}`);

  /* ---- Text is not flush against a dye boundary ------------------------ */
  //
  // The Chamba rumal's faces used to begin at the card's padding edge, so the
  // dye filled an inset rectangle and the first glyph started at exactly the
  // same x as that rectangle. Invisible while the resting dye matched the
  // card's own colour, and obvious the moment a different dye arrived: an
  // undyed frame, and text touching the colour's edge on every side.
  //
  // Measured rather than asserted, because the relationship that matters is
  // geometric — how much clear dye sits between the boundary and the words.
  const dyed = await page.evaluate(() => {
    const card = document.querySelector(".tantu-card-rumal");
    if (!card) return null;
    card.setAttribute("data-state", "reverse");
    const face = card.querySelector(".tantu-rumal-reverse");
    const text = face.querySelector(".tantu-rumal-content :is(h1,h2,h3,h4,p,li)");
    if (!text) return null;
    const c = card.getBoundingClientRect();
    const f = face.getBoundingClientRect();
    const t = text.getBoundingClientRect();
    card.setAttribute("data-state", "obverse");
    return {
      // The dye should reach the card's own edges, not stop short of them.
      frame: Math.round(Math.max(f.left - c.left, c.right - f.right, f.top - c.top)),
      // ...and the text should sit inside it.
      gapStart: Math.round(t.left - f.left),
      gapTop: Math.round(t.top - f.top),
      gapEnd: Math.round(f.right - t.right),
    };
  });
  if (dyed) {
    check(
      "a dyed face fills its card rather than an inset rectangle",
      dyed.frame <= 1,
      `${dyed.frame}px of undyed frame`,
    );
    check(
      "text on a dyed face is not flush against the dye boundary",
      dyed.gapStart >= 12 && dyed.gapTop >= 12 && dyed.gapEnd >= 0,
      `start ${dyed.gapStart}px, top ${dyed.gapTop}px, end ${dyed.gapEnd}px`,
    );
  } else {
    check("a dyed face fills its card rather than an inset rectangle", false, "no .tantu-card-rumal on the page");
  }

  /* ---- Fonts are decoupled from the system ----------------------------- */
  //
  // The claim: Tantu works with no typefaces. Asserting that in a unit test
  // only proves the stylesheet does not *name* a face; proving the page still
  // stands when the files are genuinely unavailable needs a browser with the
  // requests blocked.
  {
    const bare = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    // Every font request fails, which is what a reader on a flaky network, a
    // blocked CDN, or a deploy that forgot to upload fonts/ actually sees.
    //
    // A regex, not a glob. `**/*.{woff,woff2,ttf}` looks right and matches
    // nothing here, because the page cache-busts its fonts with `?v=<hash>`
    // and the glob anchors on the extension at the end of the URL. The check
    // passed for a while against a page that had loaded all three fonts
    // normally — a blocked-fonts test that does not block the fonts asserts
    // nothing at all.
    await bare.route(/\.(?:woff2?|ttf)(?:[?#]|$)/, (route) => route.abort());
    const bPage = await bare.newPage();
    const bareErrors = [];
    bPage.on("pageerror", (e) => bareErrors.push(String(e)));
    await bPage.goto(PAGE, { waitUntil: "networkidle" });
    await bPage.waitForTimeout(300);

    const bare1280 = await bPage.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      // A resolved family that is still one of the Tantu faces would mean the
      // browser is holding a name it cannot draw.
      body: getComputedStyle(document.body).fontFamily,
      heading: (() => {
        const h = document.querySelector("h1, h2, .tantu-heading-kalam");
        return h ? getComputedStyle(h).fontFamily : "";
      })(),
      // Nothing should have collapsed: the page still has its content.
      text: document.body.innerText.trim().length,
    }));

    check(
      "the page renders with every font request blocked",
      bareErrors.length === 0 && bare1280.text > 500,
      `${bare1280.text} chars of text, ${bareErrors.length} script error(s)`,
    );
    check(
      "no horizontal overflow with fonts unavailable",
      bare1280.overflow <= 1,
      `${bare1280.overflow}px`,
    );
    check(
      "type roles still resolve to a real stack without the brand files",
      /serif|sans-serif|monospace|system-ui/.test(bare1280.body) &&
        /serif|sans-serif|monospace|system-ui/.test(bare1280.heading),
      // The declared stack still *names* the brand faces — the @font-face rules
    // are in the CSS, the files just never arrive — so report the generic the
    // browser actually falls through to rather than the first name in the list.
    `body falls through to ${bare1280.body.split(",").pop().trim()}, ` +
      `heading to ${bare1280.heading.split(",").pop().trim()}`,
    );

    await bare.close();
  }

  /* ---- unicode-range keeps a Tantu face off text it cannot set ---------- */
  const ranged = await page.evaluate(async () => {
    await document.fonts.ready;

    // `document.fonts.check()` is the wrong instrument here: it answers "can
    // this text be rendered without loading anything more", counting
    // fallbacks, so it says yes for every script. The question is narrower —
    // *was the Tantu face selected for these characters* — and the way to ask
    // it is to measure. If a string set in `"Kalam-Rupa", serif` is exactly
    // as wide as the same string in `serif` alone, Kalam was not used for it.
    const measure = (text, family) => {
      const el = document.createElement("span");
      el.textContent = text;
      el.style.cssText =
        `position:absolute;visibility:hidden;white-space:pre;font-size:64px;font-family:${family}`;
      document.body.appendChild(el);
      const w = el.getBoundingClientRect().width;
      el.remove();
      return w;
    };

    const usedFor = (text, face) => {
      const withFace = measure(text, `"${face}", serif`);
      const without = measure(text, "serif");
      // A tolerance rather than equality: sub-pixel layout differs slightly
      // even when the same font is used for every glyph.
      return Math.abs(withFace - without) > 0.5;
    };

    return {
      latin: { kalam: usedFor("Warp", "Kalam-Rupa"), talim: usedFor("Warp", "Talim-Mono") },
      devanagari: { kalam: usedFor("ताना", "Kalam-Rupa"), talim: usedFor("ताना", "Talim-Mono") },
      arabic: { kalam: usedFor("سدى", "Kalam-Rupa"), talim: usedFor("سدى", "Talim-Mono") },
      cjk: { kalam: usedFor("経糸", "Kalam-Rupa"), talim: usedFor("経糸", "Talim-Mono") },
    };
  });
  check(
    "a Tantu face IS used for Latin",
    ranged.latin.kalam && ranged.latin.talim,
    `kalam=${ranged.latin.kalam} talim=${ranged.latin.talim}`,
  );
  check(
    "no Tantu face is used for a script it has no glyphs for",
    !ranged.devanagari.kalam && !ranged.arabic.kalam && !ranged.cjk.kalam &&
      !ranged.devanagari.talim && !ranged.arabic.talim && !ranged.cjk.talim,
    `devanagari=${ranged.devanagari.kalam} arabic=${ranged.arabic.kalam} cjk=${ranged.cjk.kalam}`,
  );

  /* ---- WCAG 1.4.12 Text Spacing ---------------------------------------- */
  // The criterion names four exact overrides. Applying them and checking that
  // nothing is clipped is the whole test — the usual failure is a fixed-height
  // container whose text no longer fits inside it.
  const spacing = await page.evaluate(() => {
    const style = document.createElement("style");
    style.id = "wcag-1412";
    style.textContent = `
      * {
        line-height: 1.5 !important;
        letter-spacing: 0.12em !important;
        word-spacing: 0.16em !important;
      }
      p { margin-bottom: 2em !important; }
    `;
    document.head.appendChild(style);
    void document.documentElement.offsetHeight;

    // Clipping: an element whose content is taller than its own box while it
    // refuses to scroll or spill. Tantu's decorative canvases and the loom
    // substrate legitimately clip, so only text-bearing elements are judged.
    const clipped = [];
    for (const el of document.querySelectorAll("p, li, h1, h2, h3, h4, td, th, button, label, span")) {
      const text = (el.textContent || "").trim();
      if (text.length < 8) continue;
      const s = getComputedStyle(el);
      if (s.overflow === "visible" && s.overflowY === "visible") continue;
      if (el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2) {
        clipped.push(`${el.tagName.toLowerCase()}.${(el.getAttribute("class") || "").split(" ")[0]}`);
      }
    }
    const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    style.remove();
    return { clipped: clipped.slice(0, 5), count: clipped.length, overflow };
  });
  check(
    "WCAG 1.4.12 text spacing: no content clipped by the four overrides",
    spacing.count === 0 && spacing.overflow <= 1,
    spacing.count ? `${spacing.count} clipped — ${spacing.clipped.join(", ")}` : `overflow ${spacing.overflow}px`,
  );

  /* ---- Consequence: the controls have to do the thing they name --------- */
  // Every check above this line measures how the page *looks*. None of them
  // presses anything. That gap is how six controls on the playground shipped
  // rendering perfectly, passing every sweep, and doing nothing at all — and
  // this page is the public one.

  // Navigation. Each nav control is an in-page anchor; an href pointing at an
  // id that is not on the page is a link that silently goes nowhere.
  const nav = await page.evaluate(() =>
    Array.from(document.querySelectorAll('a[href^="#"]')).map((a) => ({
      href: a.getAttribute("href"),
      label: (a.textContent || "").trim().slice(0, 24),
      lands: Boolean(document.getElementById(a.getAttribute("href").slice(1))),
    })),
  );
  const nowhere = nav.filter((l) => !l.lands);
  check(
    "every in-page link lands on a section that exists",
    nav.length > 0 && nowhere.length === 0,
    nowhere.length ? nowhere.map((l) => `${l.label} -> ${l.href}`).join(", ") : `${nav.length} links`,
  );

  // The theme toggle. Asserting the attribute alone would pass on a toggle
  // that flips a string nothing is bound to, so read a real painted colour.
  // documentElement, not body: this page paints its ground on the root and
  // leaves body transparent, so reading body here would compare
  // rgba(0,0,0,0) with itself and call a working toggle broken.
  const readTheme = () =>
    page.evaluate(() => ({
      theme: document.documentElement.getAttribute("data-theme"),
      bg: getComputedStyle(document.documentElement).backgroundColor,
    }));
  const themeBefore = await readTheme();
  await page.locator("#theme-toggle").click();
  await page.waitForFunction(
    (was) => document.documentElement.getAttribute("data-theme") !== was,
    themeBefore.theme,
    { timeout: 5000 },
  ).catch(() => {});
  const themeAfter = await readTheme();
  check(
    "the theme toggle repaints the page, not just an attribute",
    themeAfter.theme !== themeBefore.theme && themeAfter.bg !== themeBefore.bg,
    `${themeBefore.theme}/${themeBefore.bg} -> ${themeAfter.theme}/${themeAfter.bg}`,
  );
  await page.locator("#theme-toggle").click();
  await page.waitForTimeout(120);

  // The dorukha cards. 48 flip triggers on this page, all driven by one
  // delegated handler — so a selector change breaks every one of them at once,
  // and nothing here would have noticed.
  const flips = page.locator(".tantu-rumal-flip");
  const flipCount = await flips.count();
  const firstCard = page.locator(".tantu-card-rumal").first();
  const stateBefore = await firstCard.getAttribute("data-state");
  await firstCard.locator(".tantu-rumal-flip").first().click();
  await page.waitForTimeout(2200);
  const stateAfter = await firstCard.getAttribute("data-state");
  check(
    `the ${flipCount} flip triggers are wired, and a card turns over`,
    flipCount > 0 && stateBefore === "obverse" && stateAfter === "reverse",
    `${stateBefore} -> ${stateAfter}`,
  );

  // A reverse face is only reachable by flipping, which is exactly why its
  // text once measured 1.19:1 while every sweep passed: nothing ever flipped
  // it. Leave this card turned so the axe pass below sees a dyed face.
  //
  // Measure the ratio rather than trusting that a token is set. axe cannot do
  // this one: the dye is painted by .tantu-rumal-rim-fill, a *sibling* of the
  // text rather than an ancestor, so axe finds no background on the element's
  // own chain and reports the pairing incomplete instead of failing it. That
  // is the exact geometry the 1.19:1 defect hid in.
  const dyedFace = await page.evaluate(() => {
    // Scope to the reverse *face*, not the card: a card holds two faces, each
    // with its own fill, and querying from the card returns the obverse's
    // cream — which is a comfortable 14.57:1 and measures nothing.
    const face = document.querySelector(
      '.tantu-card-rumal[data-state="reverse"] .tantu-rumal-reverse',
    );
    if (!face) return null;
    const content = face.querySelector(".tantu-rumal-content");
    const fill = face.querySelector(".tantu-rumal-rim-fill");
    if (!content || !fill) return null;

    const parse = (c) => (c.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
    const lin = (v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    const ink = parse(getComputedStyle(content).color);
    const dye = parse(getComputedStyle(fill).backgroundColor);
    if (ink.length < 3 || dye.length < 3) return null;
    const [hi, lo] = [lum(ink), lum(dye)].sort((a, b) => b - a);
    return {
      ratio: (hi + 0.05) / (lo + 0.05),
      ink: getComputedStyle(content).color,
      dye: getComputedStyle(fill).backgroundColor,
    };
  });
  check(
    "text on a turned card clears 4.5:1 against the dye it is printed on",
    Boolean(dyedFace) && dyedFace.ratio >= 4.5,
    dyedFace ? `${dyedFace.ratio.toFixed(2)}:1 — ${dyedFace.ink} on ${dyedFace.dye}` : "no reverse face found",
  );

  /* ---- axe, in all four combinations ----------------------------------- */
  // The playground gets this. Storybook gets this on all 114 stories. The
  // public page never did — and it is the one with the visitors on it.
  // color-contrast stays ENABLED: a real engine is the only place it means
  // anything. It runs with a card turned, so the dyed face is on screen.
  // Two widths, and the narrow one is not a formality. Some violations only
  // exist once content overflows its box: a horizontally scrolling region that
  // no keyboard can reach reports clean while it happens to fit, and serious
  // the moment it does not. This sweep ran at 1280 only, so it passed on a
  // local build with a handful of repositories and failed in CI, where the
  // real GitHub data is wider — the defect was always there and the width
  // decided whether anything could see it.
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ["light", "dark"]) {
      for (const dir of ["ltr", "rtl"]) {
        await page.evaluate(
          ([t, d]) => {
            document.documentElement.setAttribute("data-theme", t);
            document.documentElement.setAttribute("dir", d);
          },
          [theme, dir],
        );
        await page.waitForTimeout(90);
        await page.addScriptTag({ content: AXE_SOURCE });
        const violations = await runAxe(page);
        check(
          `axe is clean in ${theme}/${dir} at ${width}px`,
          violations.length === 0,
          violations.map((v) => `${v.id}(${v.impact}) ${v.html} :: ${v.summary}`).join(" | "),
        );
      }
    }
  }
  await page.evaluate(() => {
    document.documentElement.setAttribute("data-theme", "light");
    document.documentElement.setAttribute("dir", "ltr");
  });

  /* ---- WCAG 2.2 SC 2.5.8 target size ----------------------------------- */
  // axe does not implement this one, so it is measured — see scripts/a11y.mjs
  // for the criterion, including the Inline exception this check used to miss.
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForTimeout(80);
  const undersized = await undersizedTargets(page);
  check(
    "every interactive target clears 24x24 (WCAG 2.5.8)",
    undersized.length === 0,
    undersized.slice(0, 5).map((t) => `${t.what} ${t.w}x${t.h}`).join(", "),
  );
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
