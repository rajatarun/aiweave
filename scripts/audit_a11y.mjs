/**
 * Accessibility audit for the Tantu token set.
 *
 * Parses the real [data-theme] blocks out of src/tantu/styles/tantu.css and
 * computes WCAG 2.1 contrast for the foreground/background pairings the
 * components actually use, in both themes. Reports against AA (4.5 body,
 * 3.0 large/UI) and AAA (7.0), plus the 3.0 non-text threshold (1.4.11) for
 * borders and focus rings.
 *
 * Run: node scripts/audit_a11y.mjs
 * Exits non-zero if any pairing fails its required threshold.
 */
import fs from "node:fs";

const css = fs.readFileSync("src/tantu/styles/tantu.css", "utf8");

// Comments in this stylesheet discuss the theme selectors by name, so a plain
// indexOf finds the prose before the rule. Strip comments first, then require
// the selector to sit at the start of a line and be followed by `{`.
const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");

/** Pull `--token: value;` declarations out of one selector block. */
function tokensIn(selector) {
  const re = new RegExp(`^\\s*${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{`, "m");
  const m = re.exec(bare);
  if (!m) return {};
  const open = bare.indexOf("{", m.index);
  const close = bare.indexOf("}", open);
  const out = {};
  for (const d of bare.slice(open + 1, close).matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    out[d[1]] = d[2].trim();
  }
  return out;
}

const root = tokensIn(":root");
const light = { ...root, ...tokensIn('[data-theme="light"]') };
const dark = { ...root, ...tokensIn('[data-theme="dark"]') };

for (const [n, t] of [["light", light], ["dark", dark]]) {
  if (!t["--tantu-ink-primary"]) {
    console.error(`could not parse the ${n} theme block — aborting rather than reporting nothing`);
    process.exit(2);
  }
}
if (light["--tantu-bg-substrate"] === dark["--tantu-bg-substrate"]) {
  console.error("light and dark parsed identically — parser is wrong, aborting");
  process.exit(2);
}

function resolve(theme, value, depth = 0) {
  if (depth > 8 || !value) return value;
  const v = value.trim();
  const m = v.match(/^var\((--[\w-]+)(?:\s*,\s*(.+))?\)$/);
  if (m) return resolve(theme, theme[m[1]] ?? m[2], depth + 1);
  return v;
}

function toRgb(css) {
  if (!css) return null;
  const s = css.trim();
  let m = s.match(/^#([0-9a-f]{3})$/i);
  if (m) return m[1].split("").map((c) => parseInt(c + c, 16));
  m = s.match(/^#([0-9a-f]{6})$/i);
  if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
  m = s.match(/^rgba?\(([^)]+)\)$/i);
  if (m) {
    const p = m[1].split(",").map((x) => parseFloat(x));
    return [p[0], p[1], p[2], p[3] === undefined ? 1 : p[3]];
  }
  return null;
}

/** Flatten a translucent colour onto its backdrop before measuring. */
function over(fg, bg) {
  if (fg.length < 4 || fg[3] === 1) return fg.slice(0, 3);
  const a = fg[3];
  return [0, 1, 2].map((i) => fg[i] * a + bg[i] * (1 - a));
}

function luminance([r, g, b]) {
  const f = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrast(fgCss, bgCss, theme) {
  const bg = toRgb(resolve(theme, bgCss));
  let fg = toRgb(resolve(theme, fgCss));
  if (!fg || !bg) return null;
  fg = over(fg, bg.slice(0, 3));
  const [a, b] = [luminance(fg), luminance(bg.slice(0, 3))].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

/**
 * Pairings taken from real component rules, not invented. `need` is the WCAG
 * threshold that applies to how the pair is actually used.
 */
const PAIRS = [
  // Body and prose
  ["--tantu-ink-primary", "--tantu-bg-substrate", 4.5, "body text on page ground"],
  ["--tantu-ink-primary", "--tantu-color-surface", 4.5, "body text on card"],
  ["--tantu-ink-primary", "--tantu-bg-elevated", 4.5, "body text on elevated"],
  ["--tantu-ink-secondary", "--tantu-bg-substrate", 4.5, "secondary text on ground"],
  ["--tantu-ink-secondary", "--tantu-color-surface", 4.5, "secondary text on card"],
  ["--tantu-ink-secondary", "--tantu-bg-elevated", 4.5, "captions/taglines on elevated"],
  // Headings and accents (large text -> 3.0)
  ["--tantu-accent-primary", "--tantu-color-surface", 3.0, "heading accent on card"],
  ["--tantu-accent-primary", "--tantu-bg-substrate", 3.0, "heading accent on ground"],
  ["--tantu-accent-highlight", "--tantu-color-surface", 3.0, "hover accent on card"],
  ["--tantu-accent-structural", "--tantu-bg-substrate", 3.0, "structural accent on ground"],
  // Inverted (text on solid accent fills)
  ["--tantu-ink-inverted", "--tantu-accent-primary", 4.5, "label on primary fill"],
  ["--tantu-ink-inverted", "--tantu-accent-structural", 4.5, "label on structural fill"],
  // State colours carried as *text*, which is where they are smallest.
  //
  // These were absent, and their absence is instructive: a rendered-contrast
  // sweep in a real browser found the caution tag at 3.07:1 in light and the
  // success tag at 1.99:1 in dark — the dark theme had never redefined either
  // token, so both rendered their light-theme value on a dark ground. A
  // pairing audit only ever covers the pairings someone thought to write
  // down, which is why scripts/verify_storybook.mjs now measures the rendered
  // result as well. Writing them down here too keeps the failure cheap to
  // find: this runs in a second, that one needs a browser.
  ["--tantu-state-success", "--tantu-bg-substrate", 4.5, "success text on ground"],
  ["--tantu-state-success", "--tantu-color-surface", 4.5, "success text on card"],
  ["--tantu-state-caution", "--tantu-bg-substrate", 4.5, "caution text on ground"],
  ["--tantu-state-caution", "--tantu-color-surface", 4.5, "caution text on card"],
  ["--tantu-ink-zari", "--tantu-bg-substrate", 4.5, "zari text on ground"],
  ["--tantu-ink-zari", "--tantu-color-surface", 4.5, "zari text on card"],
  // Solid tags: the label sits on the tone itself, so every tone is a
  // background here rather than a foreground. The light-theme tones are the
  // dark end of each hue and the dark-theme tones are the light end, which is
  // exactly why a fixed white label worked in one theme and failed in the
  // other.
  ["--tantu-ink-inverted", "--tantu-ink-secondary", 4.5, "solid neutral tag label"],
  ["--tantu-ink-inverted", "--tantu-accent-highlight", 4.5, "solid accent tag label"],
  ["--tantu-ink-inverted", "--tantu-state-success", 4.5, "solid success tag label"],
  ["--tantu-ink-inverted", "--tantu-state-caution", 4.5, "solid caution tag label"],
  ["--tantu-ink-inverted", "--tantu-ink-zari", 4.5, "solid zari tag label"],
  // Text sitting on a dyed surface. The Chamba rumal's reverse face fills
  // itself with the structural accent and put --tantu-ink-primary on top:
  // 1.19:1 in the light theme, near-black on near-black. Nothing caught it
  // because every sweep rendered that card at rest, showing only its
  // obverse — the pairing was never on screen. Both faces now declare a dye
  // and the ink that reads on it, and both are checked here.
  ["--tantu-ink-primary", "--tantu-color-surface", 4.5, "rumal obverse text on its dye"],
  ["--tantu-ink-inverted", "--tantu-accent-structural", 4.5, "rumal reverse text on its dye"],
  // The Darshan lens's own chrome — readout and keypad — is deliberately
  // theme-invariant: the glass is machined from one dark brass body whichever
  // theme the document under it is in. That makes these primitives rather
  // than semantic tokens, and it is exactly the shape of mistake that put a
  // fixed white label on a solid tag, so both pairs are measured here rather
  // than assumed to be fine because the ground is "obviously" dark.
  ["--tantu-zari-pure-gold", "--tantu-kala-iron", 4.5, "lens readout and keypad glyph"],
  ["--tantu-zari-tarnish", "--tantu-kala-iron", 4.5, "lens talim code and key boundary"],
  // Non-text: borders, rules, focus (1.4.11 -> 3.0)
  ["--tantu-border-embroidery", "--tantu-bg-substrate", 3.0, "card border vs ground"],
  ["--tantu-border-embroidery", "--tantu-color-surface", 3.0, "card border vs card"],
  ["--tantu-border-hairline", "--tantu-bg-substrate", 3.0, "card boundary vs ground"],
  ["--tantu-border-hairline", "--tantu-color-surface", 3.0, "card boundary vs card"],
  // The focus indicator is two-tone: zari gold with a contrast halo riding
  // just outside it. WCAG measures the indicator against adjacent colour, and
  // the halo is what carries that, so the halo is the pair to check. The gold
  // alone is 1.89:1 and would fail on its own.
  ["--tantu-focus-contrast", "--tantu-color-surface", 3.0, "focus halo vs card"],
  ["--tantu-focus-contrast", "--tantu-bg-substrate", 3.0, "focus halo vs ground"],
];

// --tantu-grid-thread is deliberately NOT checked: it is the loom's decorative
// 1px weave, which WCAG 1.4.11 exempts as pure decoration. It used to double
// as the card boundary, which is not exempt — that job moved to
// --tantu-border-hairline above.

let failures = 0;
let checked = 0;

for (const [name, theme] of [["LIGHT", light], ["DARK", dark]]) {
  console.log(`\n${name} THEME`);
  console.log("-".repeat(78));
  console.log(
    `${"pair".padEnd(40)} ${"ratio".padStart(6)} ${"need".padStart(5)}  verdict`,
  );
  for (const [fg, bg, need, label] of PAIRS) {
    const r = contrast(`var(${fg})`, `var(${bg})`, theme);
    checked += 1;
    if (r === null) {
      console.log(`${label.padEnd(40)} ${"n/a".padStart(6)} ${String(need).padStart(5)}  UNRESOLVED`);
      failures += 1;
      continue;
    }
    const ok = r >= need;
    if (!ok) failures += 1;
    const aaa = r >= 7 ? " AAA" : "";
    console.log(
      `${label.padEnd(40)} ${r.toFixed(2).padStart(6)} ${String(need).padStart(5)}  ${ok ? "pass" + aaa : "FAIL"}`,
    );
  }
}

console.log("\n" + "=".repeat(78));
console.log(`${checked} pairings checked, ${failures} failing`);
if (failures) process.exit(1);
