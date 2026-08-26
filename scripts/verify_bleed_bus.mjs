/**
 * Arbitration matrix for the bleed bus (src/tantu/lib/bleed-bus.ts).
 *
 * The bus exists so that composing bleed-enabled components does not multiply
 * dye fronts. That property is only worth claiming if the combinations are
 * actually exercised, so this walks the matrix: for each nesting, every
 * registered responder asks the bus whether it should emit, and exactly one
 * must be allowed to.
 *
 * Runs against the compiled assets/bleed-bus.js — the same file the page
 * loads — under a minimal DOM stub, so no browser or test framework is
 * needed. Run: node scripts/verify_bleed_bus.mjs
 */
import { strict as assert } from "node:assert";

// --- Minimal DOM: enough for parentElement walking and closest(). ----------
class El {
  constructor(tag, cls = "") {
    this.nodeType = 1;
    this.tagName = tag.toUpperCase();
    this.className = cls;
    this.parentElement = null;
    this.children = [];
  }
  append(child) {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }
  matches(sel) {
    // Only the selector forms this suite uses: ".cls" and "tag".
    if (sel.startsWith(".")) return this.className.split(/\s+/).includes(sel.slice(1));
    return this.tagName === sel.toUpperCase();
  }
  closest(sel) {
    for (let n = this; n; n = n.parentElement) if (n.matches(sel)) return n;
    return null;
  }
}

globalThis.window = { matchMedia: () => ({ matches: false }) };

const bus = await import("../assets/bleed-bus.js");
const { shouldBleed, registerBleedNode, registerBleedSelector, holdAmbientBleed, resetBleedBus } = bus;

let passed = 0;
const failures = [];
function check(name, fn) {
  try {
    resetBleedBus();
    fn();
    passed += 1;
    console.log(`  PASS  ${name}`);
  } catch (err) {
    failures.push(name);
    console.log(`  FAIL  ${name}\n        ${err.message}`);
  }
}

/** Each responder gets its own event object, as separate listeners would. */
function askAll(target, layers) {
  return layers.map((layer) => shouldBleed({ target }, layer, target));
}

console.log("\nBLEED BUS — arbitration matrix\n" + "=".repeat(52));

check("bare gesture: substrate answers", () => {
  const page = new El("div");
  const plain = page.append(new El("p"));
  assert.equal(shouldBleed({ target: plain }, "substrate", plain), true);
});

check("control inside surface inside substrate: only the control", () => {
  const page = new El("div");
  const surface = page.append(new El("div", "tantu-bleed-host"));
  const button = surface.append(new El("button", "tantu-btn"));
  const label = button.append(new El("span"));
  registerBleedNode(surface, "surface");
  registerBleedNode(button, "control");
  // A press lands on the button's inner label, as it does in practice.
  const [sub, surf, ctrl] = askAll(label, ["substrate", "surface", "control"]);
  assert.equal(sub, false, "substrate should stand down");
  assert.equal(surf, false, "surface should stand down");
  assert.equal(ctrl, true, "control should answer");
});

check("surface inside substrate, press on bare surface: only the surface", () => {
  const page = new El("div");
  const surface = page.append(new El("div", "tantu-bleed-host"));
  const text = surface.append(new El("p"));
  registerBleedNode(surface, "surface");
  const [sub, surf] = askAll(text, ["substrate", "surface"]);
  assert.equal(sub, false);
  assert.equal(surf, true);
});

check("narrative outranks everything on its own gesture", () => {
  const page = new El("div");
  const surface = page.append(new El("div", "tantu-bleed-host"));
  const flip = surface.append(new El("button", "tantu-rumal-flip"));
  registerBleedNode(surface, "surface");
  registerBleedSelector(".tantu-rumal-flip", "narrative");
  const [sub, surf, narr] = askAll(flip, ["substrate", "surface", "narrative"]);
  assert.equal(sub, false);
  assert.equal(surf, false);
  assert.equal(narr, true);
});

check("registration beats listener order (substrate asks first)", () => {
  // The real hazard: substrate listens on pointerdown, a card flip starts on
  // click, so the substrate can ask before the narrative responder exists as
  // a listener. Ownership is by registration, so order cannot matter.
  const page = new El("div");
  const flip = page.append(new El("button", "tantu-rumal-flip"));
  registerBleedSelector(".tantu-rumal-flip", "narrative");
  assert.equal(shouldBleed({ target: flip }, "substrate", flip), false);
});

check("ambient held during a narrative fill; narrative itself unaffected", () => {
  const page = new El("div");
  const elsewhere = page.append(new El("p"));
  const release = holdAmbientBleed();
  assert.equal(shouldBleed({ target: elsewhere }, "substrate", elsewhere), false, "substrate muted");
  assert.equal(shouldBleed({ target: elsewhere }, "surface", elsewhere), false, "surface muted");
  assert.equal(shouldBleed({ target: elsewhere }, "control", elsewhere), true, "control still answers");
  release();
  assert.equal(shouldBleed({ target: elsewhere }, "substrate", elsewhere), true, "restored after release");
});

check("overlapping holds cannot release each other early", () => {
  const page = new El("div");
  const t = page.append(new El("p"));
  const a = holdAmbientBleed();
  const b = holdAmbientBleed();
  a();
  assert.equal(shouldBleed({ target: t }, "substrate", t), false, "still held by b");
  b();
  assert.equal(shouldBleed({ target: t }, "substrate", t), true, "released once both are done");
});

check("release is idempotent", () => {
  const page = new El("div");
  const t = page.append(new El("p"));
  const a = holdAmbientBleed();
  const b = holdAmbientBleed();
  a();
  a();
  a();
  assert.equal(shouldBleed({ target: t }, "substrate", t), false, "b's hold must survive a's double-release");
  b();
  assert.equal(shouldBleed({ target: t }, "substrate", t), true);
});

check("one gesture is answered once, even by the same layer twice", () => {
  const page = new El("div");
  const t = page.append(new El("p"));
  const gesture = { target: t };
  assert.equal(shouldBleed(gesture, "substrate", t), true);
  assert.equal(shouldBleed(gesture, "substrate", t), false, "second ask on the same event must be refused");
});

check("unregister restores the previous owner", () => {
  const page = new El("div");
  const surface = page.append(new El("div"));
  const button = surface.append(new El("button"));
  registerBleedNode(surface, "surface");
  const off = registerBleedNode(button, "control");
  assert.equal(shouldBleed({ target: button }, "surface", button), false, "control owns it");
  off();
  assert.equal(shouldBleed({ target: button }, "surface", button), true, "surface owns it again");
});

check("reduced motion suppresses every layer", () => {
  globalThis.window.matchMedia = () => ({ matches: true });
  const page = new El("div");
  const t = page.append(new El("p"));
  for (const layer of ["substrate", "surface", "control", "narrative"]) {
    assert.equal(shouldBleed({ target: t }, layer, t), false, `${layer} must stay dry`);
  }
  globalThis.window.matchMedia = () => ({ matches: false });
});

check("deepest registration wins among nested same-rank owners", () => {
  const page = new El("div");
  const outer = page.append(new El("div"));
  const inner = outer.append(new El("div"));
  const leaf = inner.append(new El("span"));
  registerBleedNode(outer, "surface");
  registerBleedNode(inner, "control");
  assert.equal(shouldBleed({ target: leaf }, "surface", leaf), false, "inner control outranks outer surface");
  assert.equal(shouldBleed({ target: leaf }, "control", leaf), true);
});

console.log("=".repeat(52));
console.log(`${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("FAILED: " + failures.join("; "));
  process.exit(1);
}
