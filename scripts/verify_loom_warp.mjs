/**
 * The loom's warp default, measured rather than asserted.
 *
 * A direct child of `.tantu-loom-content` that declares no span must take the
 * whole warp. The travel loom has always clamped every direct pick to `span 4`
 * for exactly this reason — a consumer's full-width section must not be able
 * to force an implicit column — but the wide warp carried no matching rule, so
 * an unclassed child fell to the grid default of `span 1`. One twelfth.
 *
 * A consumer hit it: a full-bleed screen laid straight into the loom rendered
 * in a 92px column inside an 1184px grid, every label wrapped to roughly one
 * character per line, the page some ten thousand pixels tall.
 *
 * The reason this is a browser check and not a stylesheet one is the reason it
 * survived so long. Asserting the declaration exists is nearly a tautology
 * with the fix, and the failure is a *cascade* outcome: the default has to
 * lose to `tantu-cell-warp-*` and win over nothing else. Only a real engine
 * settles that. It is also invisible at the travel width, which is the width a
 * mobile-first consumer tests — so the one viewport that shows the bug is the
 * one nobody looks at.
 *
 * Run: node scripts/verify_loom_warp.mjs
 */
import fs from "node:fs";
import { launchChromium } from "./chromium.mjs";

const CSS = fs.readFileSync("src/tantu/styles/tantu.css", "utf8");
const failures = [];

const FIXTURE = `
  <div class="tantu-loom">
    <main class="tantu-loom-content">
      <div id="bare">bare</div>
      <div id="six" class="tantu-cell-warp-6">six</div>
      <div id="full" class="tantu-cell-warp-full">full</div>
      <div id="one" class="tantu-cell-warp-1">one</div>
    </main>
  </div>`;

const browser = await launchChromium();

/** Widths either side of the Loom Drop at 768px. */
for (const { name, width, threads } of [
  { name: "wide warp", width: 1280, threads: 12 },
  { name: "travel loom", width: 375, threads: 4 },
]) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  await page.setContent(`<style>${CSS}</style>${FIXTURE}`, { waitUntil: "load" });

  const m = await page.evaluate(() => {
    const w = (id) => Math.round(document.getElementById(id).getBoundingClientRect().width);
    const content = document.querySelector(".tantu-loom-content");
    const cs = getComputedStyle(content);
    const inner = content.getBoundingClientRect().width
      - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    return { inner: Math.round(inner), bare: w("bare"), six: w("six"), full: w("full"), one: w("one") };
  });
  await page.close();

  // Sub-pixel and the 1px filament gap make exact equality the wrong test.
  const near = (a, b, tol = 2) => Math.abs(a - b) <= tol;
  const check = (ok, msg) => { console.log(`  ${ok ? "PASS" : "FAIL"}  ${msg}`); if (!ok) failures.push(`${name}: ${msg}`); };

  console.log(`\n${name} (${width}px, ${threads} threads, content ${m.inner}px)`);
  check(near(m.bare, m.inner), `an unclassed child takes the full warp (${m.bare}px of ${m.inner}px)`);
  check(near(m.full, m.inner), `tantu-cell-warp-full takes the full warp (${m.full}px)`);

  if (threads === 12) {
    // The default must lose to anything that opted into a span, or every
    // existing consumer's layout silently becomes full-bleed.
    const half = (m.inner - 6 * 1) / 2;
    check(m.six < m.inner * 0.6 && near(m.six, half, 8),
      `tantu-cell-warp-6 still spans half, not the full warp (${m.six}px)`);
    check(m.one < m.inner / 6,
      `tantu-cell-warp-1 still spans one thread (${m.one}px)`);
  } else {
    // The Loom Drop clamps every direct pick, including ones that opted in.
    check(near(m.six, m.inner) && near(m.one, m.inner),
      `the travel loom still clamps declared spans to full width (${m.six}px, ${m.one}px)`);
  }
}

await browser.close();

if (failures.length) {
  console.error(`\n${failures.length} failed:\n  ${failures.join("\n  ")}`);
  process.exit(1);
}
console.log("\nThe warp default holds at both widths.\n");
