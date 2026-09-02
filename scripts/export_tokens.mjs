/**
 * Export the Tantu token set for design tools.
 *
 * `styles/tantu.css` stays the single source of truth. Maintaining a second,
 * hand-kept copy of the tokens for Figma is how a design system ends up with
 * a library that quietly disagrees with the code — so this reads the real
 * `:root`, `[data-theme="light"]` and `[data-theme="dark"]` blocks and derives
 * everything. CI runs it and fails if the committed output is stale.
 *
 * Two formats, because Figma has two import paths and teams use both:
 *
 *  - `tantu.tokens.json` — W3C Design Tokens Community Group draft format.
 *    This is what the newer Variables importers and most build tools
 *    (Style Dictionary 4, Terrazzo) consume.
 *  - `tokens-studio.json` — Tokens Studio for Figma, which is still the most
 *    common way a team actually gets tokens into a Figma library, and which
 *    wants its themes as separate top-level sets.
 *
 * Run: node scripts/export_tokens.mjs
 */
import fs from "node:fs";
import path from "node:path";

const CSS_PATH = "src/tantu/styles/tantu.css";
const OUT_DIR = "src/tantu/tokens";

const css = fs.readFileSync(CSS_PATH, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

/** Pull `--token: value;` pairs out of one top-level selector block. */
function declarationsIn(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`^\\s*${escaped}\\s*\\{`, "m").exec(css);
  if (!match) return {};
  const open = css.indexOf("{", match.index);
  const close = css.indexOf("}", open);
  const all = {};
  for (const d of css.slice(open + 1, close).matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    (all[d[1]] ??= []).push(d[2].trim());
  }
  return Object.fromEntries(Object.entries(all).map(([name, values]) => [name, pickStatic(values)]));
}

/**
 * Choose the declaration a design tool can actually represent.
 *
 * The stylesheet declares a token twice where a modern CSS function needs a
 * fallback — `--tantu-thread` is `6px` and then `round(calc(...), 1px)`, so
 * an engine without `round()` still gets a working lattice. In CSS the later
 * declaration wins, which is right for a browser and wrong here: Figma and
 * Tokens Studio store numbers, and importing the literal text
 * `round(calc(8px - 4px * var(--tantu-tension)), 1px)` gives a designer a
 * dangling value for every spacing token in the system.
 *
 * So walk newest-first and take the first declaration that is not built on a
 * function this exporter cannot reduce to a literal. `calc()` is not in that
 * list — the lattice is a length times a number and `resolve()` evaluates it.
 */
function pickStatic(values) {
  const unrepresentable = /\b(?:round|clamp|min|max)\(/;
  for (let i = values.length - 1; i >= 0; i -= 1) {
    if (!unrepresentable.test(values[i])) return values[i];
  }
  return values[values.length - 1];
}

const root = declarationsIn(":root");
const lightOverrides = declarationsIn('[data-theme="light"]');
const darkOverrides = declarationsIn('[data-theme="dark"]');

if (!Object.keys(root).length) {
  console.error(`could not parse :root out of ${CSS_PATH} — aborting rather than writing an empty library`);
  process.exit(2);
}
if (!Object.keys(darkOverrides).length) {
  console.error('could not parse [data-theme="dark"] — aborting');
  process.exit(2);
}

/**
 * Tokens kept only so existing consumers keep working, and which a design
 * library should never bind to. `--font-kalam` and friends name a *typeface*
 * where the system now names a *role*; exporting them would put the coupling
 * this refactor removed straight back into Figma, where it is far harder to
 * find and undo.
 */
const DEPRECATED = new Set(["--font-kalam", "--font-talim", "--font-kasuti", "--font-body"]);

function withoutDeprecated(tokens) {
  return Object.fromEntries(Object.entries(tokens).filter(([name]) => !DEPRECATED.has(name)));
}

const light = withoutDeprecated({ ...root, ...lightOverrides });
const dark = withoutDeprecated({ ...root, ...darkOverrides });

/**
 * Resolve `var(--x)` chains down to a literal. Design tools understand token
 * *aliases*, but only within one collection — a dark-theme alias pointing at
 * a value that only exists in the light set imports as a dangling reference.
 * Resolving is the boring, correct choice; the alias structure is preserved
 * separately in `$extensions.tantu.aliasOf` so a designer can still see which
 * semantic token was built on which dye primitive.
 */
function resolve(theme, value, depth = 0) {
  if (depth > 8 || !value) return value;
  // A CSS value may be wrapped across lines for readability (the body font
  // stack is); design tools want it on one.
  const flat = value.replace(/\s+/g, " ").trim();
  const m = flat.match(/^var\((--[\w-]+)(?:\s*,\s*(.+))?\)$/);
  if (m) return resolve(theme, theme[m[1]] ?? m[2], depth + 1);

  // A var() *inside* an expression — every knot is `calc(var(--tantu-thread)
  // * n)`. Substitute the reference, then reduce the arithmetic, so the
  // design library receives 24px rather than a formula it cannot evaluate.
  if (flat.startsWith("calc(") && flat.includes("var(")) {
    const substituted = flat.replace(
      /var\((--[\w-]+)(?:\s*,\s*([^)]+))?\)/g,
      (_, name, fallback) => resolve(theme, theme[name] ?? fallback, depth + 1),
    );
    return resolve(theme, substituted, depth + 1);
  }

  return reduceCalc(flat);
}

/**
 * Reduce the one arithmetic shape the lattice uses: a length scaled by a
 * number, in either order. Anything else is returned untouched — this is a
 * deliberately small evaluator rather than a CSS engine, and a shape it does
 * not recognise should reach the warning below rather than be guessed at.
 */
function reduceCalc(value) {
  const lengthFirst = value.match(/^calc\(\s*([\d.]+)(px|rem|em)\s*\*\s*([\d.]+)\s*\)$/);
  if (lengthFirst) {
    return `${+(parseFloat(lengthFirst[1]) * parseFloat(lengthFirst[3])).toFixed(4)}${lengthFirst[2]}`;
  }
  const numberFirst = value.match(/^calc\(\s*([\d.]+)\s*\*\s*([\d.]+)(px|rem|em)\s*\)$/);
  if (numberFirst) {
    return `${+(parseFloat(numberFirst[1]) * parseFloat(numberFirst[2])).toFixed(4)}${numberFirst[3]}`;
  }
  return value;
}

function aliasOf(value) {
  const m = value.trim().match(/^var\((--[\w-]+)/);
  return m ? m[1] : undefined;
}

const isColor = (v) => /^#[0-9a-f]{3,8}$/i.test(v) || /^(rgba?|hsla?|color-mix)\(/i.test(v);
const isDimension = (v) => /^-?\d*\.?\d+(px|rem|em|%)$/.test(v);
const isDuration = (v) => /^\d*\.?\d+m?s$/.test(v);
const isCubicBezier = (v) => /^cubic-bezier\(/.test(v);
const isFontFamily = (v) => /,/.test(v) && /(serif|sans-serif|monospace|system-ui|cursive|fantasy)\s*$/.test(v);

function typeOf(value) {
  if (isColor(value)) return "color";
  if (isDuration(value)) return "duration";
  if (isCubicBezier(value)) return "cubicBezier";
  if (isFontFamily(value)) return "fontFamily";
  if (isDimension(value)) return "dimension";
  if (/^\d*\.?\d+$/.test(value)) return "number";
  return "string";
}

/**
 * Group tokens into a tree by their name segments, so the library arrives in
 * Figma as folders rather than 90 flat variables. `--tantu-bg-substrate`
 * becomes `tantu / bg / substrate`.
 */
function nest(target, name, node) {
  const segments = name.replace(/^--/, "").split("-");
  let cursor = target;
  for (const segment of segments.slice(0, -1)) {
    cursor[segment] ??= {};
    // A name can be both a leaf and a folder (`--font-talim` under a `font`
    // group that is itself not a token); only descend into plain objects.
    if (cursor[segment].$value !== undefined) return false;
    cursor = cursor[segment];
  }
  cursor[segments[segments.length - 1]] = node;
  return true;
}

/** W3C Design Tokens Community Group draft format. */
function dtcg(theme, themeName) {
  const tree = {};
  const skipped = [];
  for (const [name, raw] of Object.entries(theme)) {
    const value = resolve(theme, raw);
    if (value === undefined) continue;
    const node = { $value: value, $type: typeOf(value) };
    const alias = aliasOf(raw);
    if (alias) node.$extensions = { tantu: { aliasOf: alias } };
    if (!nest(tree, name, node)) skipped.push(name);
  }
  if (skipped.length) {
    console.warn(`  note: ${skipped.length} token(s) collided with a group name and were flattened: ${skipped.join(", ")}`);
    for (const name of skipped) {
      const value = resolve(theme, theme[name]);
      tree[name.replace(/^--/, "")] = { $value: value, $type: typeOf(value) };
    }
  }
  return {
    $description:
      `Tantu design tokens — ${themeName} theme. Generated from ${CSS_PATH}; ` +
      `do not edit by hand, run \`npm run tokens\`.`,
    ...tree,
  };
}

/** Tokens Studio for Figma. Flat names, `value`/`type`, one set per theme. */
const STUDIO_TYPE = {
  color: "color",
  dimension: "sizing",
  duration: "other",
  cubicBezier: "other",
  fontFamily: "fontFamilies",
  number: "other",
  string: "other",
};

function tokensStudio(theme) {
  const out = {};
  for (const [name, raw] of Object.entries(theme)) {
    const value = resolve(theme, raw);
    if (value === undefined) continue;
    out[name.replace(/^--/, "").replace(/-/g, ".")] = {
      value,
      type: STUDIO_TYPE[typeOf(value)] ?? "other",
    };
  }
  return out;
}

fs.mkdirSync(OUT_DIR, { recursive: true });

/**
 * Nothing unevaluated may reach a design tool.
 *
 * The CI gate on these files only asserts that the committed output matches
 * what this script produces — it cannot tell a usable library from a broken
 * one, so a change to the stylesheet that introduced a value this exporter
 * could not reduce would regenerate cleanly, pass the staleness check, and
 * hand designers a dangling reference. That happened the moment the lattice
 * became `calc(var(--tantu-thread) * n)`: every spacing token in the system
 * exported as literal formula text and the gate said nothing.
 */
function assertResolved(theme, label) {
  const unresolved = Object.entries(theme)
    .map(([name, raw]) => [name, resolve(theme, raw)])
    .filter(([, value]) => typeof value === "string" && /\b(?:calc|var|round|clamp)\(/.test(value));
  if (unresolved.length) {
    console.error(
      `${label}: ${unresolved.length} token(s) did not reduce to a literal, which a design tool ` +
        `cannot import. Extend resolve()/reduceCalc() rather than shipping these:`,
    );
    for (const [name, value] of unresolved) console.error(`  ${name}: ${value}`);
    process.exit(1);
  }
}
assertResolved(light, "light");
assertResolved(dark, "dark");

const dtcgOut = {
  light: dtcg(light, "light"),
  dark: dtcg(dark, "dark"),
};

const studioOut = {
  "tantu/light": tokensStudio(light),
  "tantu/dark": tokensStudio(dark),
  $themes: [
    {
      id: "light",
      name: "Light",
      selectedTokenSets: { "tantu/light": "enabled" },
    },
    {
      id: "dark",
      name: "Dark",
      selectedTokenSets: { "tantu/dark": "enabled" },
    },
  ],
  $metadata: { tokenSetOrder: ["tantu/light", "tantu/dark"] },
};

const files = [
  ["tantu.tokens.json", dtcgOut],
  ["tokens-studio.json", studioOut],
];

for (const [name, data] of files) {
  fs.writeFileSync(path.join(OUT_DIR, name), JSON.stringify(data, null, 2) + "\n");
  console.log(`wrote ${path.join(OUT_DIR, name)}`);
}

console.log(
  `\n${Object.keys(light).length} tokens per theme, ` +
    `${Object.keys(darkOverrides).length} of which the dark theme redefines.`,
);
