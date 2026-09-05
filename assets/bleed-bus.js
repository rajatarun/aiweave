/**
 * TANTU BLEED BUS — coordination layer for dye-emitting components.
 *
 * The problem this exists to solve
 * -------------------------------
 * Tantu has several independent things that wick dye, and every one of them
 * answers the *same* pointer gesture on its own:
 *
 *   - the loom substrate (TantuBleedCanvas / useCapillaryBleed({global:true}))
 *     listens on `window`, so it fires for any press anywhere;
 *   - CapillaryBleedSurface bleeds from its own pointerdown;
 *   - TantuButton bleeds from its own pointerdown (on by default);
 *   - ChambaRumalCard answers a flip with a dye front of its own.
 *
 * Composed, those multiply: a bleeding button inside a bleeding surface on
 * the substrate is three dye fronts for one press, none of them aware of the
 * others. The largest, longest one wins the eye — which is backwards, since
 * the innermost is the one that actually answers what was pressed. Muting one
 * pairing by hand does not scale: N sources means N^2 pairings to think about.
 *
 * The model
 * ---------
 * Dye responders declare a LAYER. A gesture is answered by exactly one
 * responder — the most specific layer that owns the thing being touched —
 * and every other responder stands down for that gesture:
 *
 *   substrate  the ambient loom ground; answers only gestures nothing else owns
 *   surface    a region that dyes its own area (CapillaryBleedSurface)
 *   control    an interactive control that dyes on press (TantuButton)
 *   narrative  a component whose dye *is* the response to the action, and
 *              which owns the moment while it runs (ChambaRumalCard's flip)
 *
 * Ownership is resolved by registration, not by listener order. A responder
 * registers the node (or selector) it speaks for; `shouldBleed` walks up from
 * the event target to find the innermost registered owner. That matters
 * because the participants do not all listen to the same event: the substrate
 * reacts to `pointerdown` while a card flip starts on `click`, so an
 * ordering- or claim-only scheme would let the substrate fire before the card
 * had a chance to say the gesture was its. Registration is independent of
 * which event a responder happens to use.
 *
 * `holdAmbient()` covers the other half: while a narrative bleed is still
 * spreading, ambient sources stay quiet, so a pointer trail during a card
 * fill cannot bloom over it.
 *
 * Deliberately not here: no droplet budget or rate limiter. Emission is
 * already bounded per surface (trailInterval throttling, and the shader's
 * TANTU_MAX_BLEEDS ring buffer), and one shared WebGL context renders them
 * all — see capillary-bleed.ts. Adding another cap without a measured
 * problem would be machinery for its own sake.
 *
 * Self-contained by design: no imports, so it compiles under the same
 * `tsc --noResolve` pass as capillary-bleed.ts and maku-shuttle.ts and can be
 * loaded directly by a page that ships no bundler. Policy only — it never
 * touches the shader. capillary-bleed.ts stays pure mechanism.
 */
export const FIBRES = {
    /** The historic values. Every consumer that has ever rendered used these. */
    cotton: { anisotropy: 0.18, t0: 0.04 },
    /** Bast fibre: long, straight, strongly axial, and quick to take up. */
    linen: { anisotropy: 0.26, t0: 0.03 },
    /** A continuous filament — the most directional and the fastest onset. */
    silk: { anisotropy: 0.3, t0: 0.02 },
    /** Crimped and scaled: resists, holds, and starts slowly. */
    wool: { anisotropy: 0.07, t0: 0.09 },
    /**
     * Not woven. Matted fibre has no warp and no weft, so there is no axis to
     * conduct along and the front stays round. This row is the reason the axis
     * is real rather than cosmetic: it is the one value that visibly changes
     * the shape of the dye front rather than its degree.
     */
    felt: { anisotropy: 0, t0: 0.06 },
};
export const DEFAULT_FIBRE = "cotton";
/* ------------------------------------------------------------------ */
/* THE WICK LAW — how far the wet front has travelled, 0..1.           */
/* ------------------------------------------------------------------ */
/**
 * Cotton's crossover, kept as a named export because it is the default the
 * whole system was built against and consumers import it. Reads from the
 * fibre table rather than repeating the literal, so there is still exactly
 * one place the number lives.
 */
export const WICK_T0 = FIBRES[DEFAULT_FIBRE].t0;
/**
 * Cotton's anisotropy. Same reasoning as WICK_T0 — one source, and the
 * shader now takes it as a uniform rather than compiling a copy in.
 */
export const WICK_ANISOTROPY = FIBRES[DEFAULT_FIBRE].anisotropy;
/**
 * Resolve a fibre to its spec, falling back to the default.
 *
 * Accepts a name or a spec, so a caller that read its numbers off the
 * cascade can pass them straight through without inventing a fibre name for
 * them.
 */
export function fibreSpec(fibre) {
    // Discriminated on `string` rather than `object`, and cast rather than
    // narrowed: this file is compiled twice — once by the app's strict config
    // and once standalone by `build:client-assets` for the no-bundler page —
    // and control-flow narrowing does not survive both. The second pass is
    // what caught it.
    if (fibre && typeof fibre !== "string")
        return fibre;
    const named = fibre;
    return (named && FIBRES[named]) || FIBRES[DEFAULT_FIBRE];
}
/**
 * Read the cloth off the live cascade.
 *
 * The dyes already work this way — resolveDye() reads the pigment from the
 * element being stained, so re-dyeing a subtree in CSS moves the bleed with
 * it. The fibre is the same kind of property and gets the same treatment:
 * set --weave-anisotropy on a region and the DOM wick fronts inside it
 * change shape, without that region needing to know a fibre's name.
 *
 * Falls back to cotton per-value, so a page that declares neither, or only
 * one, still renders exactly as it always did.
 */
export function fibreFrom(scope) {
    const base = FIBRES[DEFAULT_FIBRE];
    if (typeof window === "undefined")
        return base;
    const style = getComputedStyle(scope ?? document.documentElement);
    const read = (prop, fallback) => {
        const value = parseFloat(style.getPropertyValue(prop));
        return Number.isFinite(value) ? value : fallback;
    };
    return {
        anisotropy: read("--weave-anisotropy", base.anisotropy),
        t0: read("--weave-wick-t0", base.t0),
    };
}
/**
 * Lucas–Washburn wicking, normalised so wickProgress(1) === 1.
 *
 * Dye advancing through a porous medium follows L ∝ sqrt(t) — the classic
 * result for capillary flow in fabric. This system previously grew the front
 * as 1 - e^(-kt), which is a *saturation* curve: correct for how wet a given
 * point becomes as dye accumulates there, but not for where the front has
 * reached. Applied to a radius it dies far too early — measured against its
 * own peak speed, an exponential front is 92% stopped at t=0.75 and 95% at
 * t=0.90, so the last half of the animation is a stall. Washburn holds ~22%
 * of peak speed all the way to the end, which is the gradual, still-moving
 * slowdown real cloth shows.
 */
export function wickProgress(t, t0 = WICK_T0) {
    if (!(t > 0))
        return 0;
    if (t >= 1)
        return 1;
    const s0 = Math.sqrt(t0);
    return (Math.sqrt(t + t0) - s0) / (Math.sqrt(1 + t0) - s0);
}
/**
 * Radii for an anisotropic wet front at progress `p` (0..1), given the
 * radius that would just cover the cloth along the weft axis. Returns px.
 *
 * `fibre` decides how far the front runs along the thread axes; omitted, it
 * is cotton, which is what every caller got before the axis existed.
 */
export function wickRadii(coverRy, p, fibre) {
    const ry = coverRy * p;
    return { rx: ry * (1 + fibreSpec(fibre).anisotropy * p), ry };
}
/**
 * The weft-axis radius at which the front, stretched by the fibre's
 * anisotropy, just reaches every corner of a w x h box from (cx, cy).
 */
export function wickCoverRadius(w, h, cx, cy, fibre) {
    const k = 1 + fibreSpec(fibre).anisotropy;
    let max = 0;
    for (const [x, y] of [[0, 0], [w, 0], [0, h], [w, h]]) {
        const dx = (x - cx) / k;
        const dy = y - cy;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > max)
            max = d;
    }
    return max;
}
const LAYER_RANK = {
    substrate: 0,
    surface: 1,
    control: 2,
    narrative: 3,
};
/** Nodes that speak for themselves, innermost wins. */
const nodeOwners = new Map();
/** Selector-registered owners, for static markup and repeated instances. */
const selectorOwners = [];
/** One answer per gesture. Keyed by the event object itself. */
const claimed = new WeakSet();
let ambientHolds = 0;
/**
 * Declare that `node` answers gestures inside it at `layer`.
 * Returns an unregister function; call it on unmount.
 */
export function registerBleedNode(node, layer) {
    if (!node)
        return () => { };
    nodeOwners.set(node, layer);
    return () => {
        nodeOwners.delete(node);
    };
}
/**
 * Same, but for anything matching a CSS selector. Useful for static pages and
 * for components rendered many times where registering each instance would be
 * noise. Returns an unregister function.
 */
export function registerBleedSelector(selector, layer) {
    const entry = { selector, layer };
    selectorOwners.push(entry);
    return () => {
        const i = selectorOwners.indexOf(entry);
        if (i >= 0)
            selectorOwners.splice(i, 1);
    };
}
/**
 * The innermost registered layer that owns `target`, or null if nothing does.
 * Walks ancestors so a press on a button's inner <span> still resolves to the
 * button, and takes the deepest match when several ancestors are registered.
 */
export function resolveGestureOwner(target) {
    let el = target && target.nodeType === 1 ? target : null;
    if (!el && target && target.parentElement)
        el = target.parentElement;
    if (!el)
        return null;
    let depth = 0;
    let best = null;
    let bestDepth = Infinity;
    for (let node = el; node; node = node.parentElement, depth += 1) {
        const direct = nodeOwners.get(node);
        if (direct && depth < bestDepth) {
            best = direct;
            bestDepth = depth;
        }
    }
    for (const { selector, layer } of selectorOwners) {
        let match = null;
        try {
            match = el.closest(selector);
        }
        catch {
            match = null;
        }
        if (!match)
            continue;
        let d = 0;
        for (let node = el; node && node !== match; node = node.parentElement)
            d += 1;
        if (d < bestDepth) {
            best = layer;
            bestDepth = d;
        }
    }
    return best;
}
/** Central motion policy, so every responder honours it identically. */
export function bleedMotionAllowed() {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function")
        return true;
    try {
        return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }
    catch {
        return true;
    }
}
/**
 * The single question every dye responder asks before emitting.
 *
 * Answers false when motion is suppressed, when an ambient responder is asking
 * during a narrative hold, when a more specific responder owns the gesture, or
 * when this gesture has already been answered.
 */
export function shouldBleed(gesture, layer, target) {
    if (!bleedMotionAllowed())
        return false;
    // Ambient layers keep out of the way while a narrative bleed is running.
    if (LAYER_RANK[layer] <= LAYER_RANK.surface && ambientHolds > 0)
        return false;
    const evt = gesture;
    const owner = resolveGestureOwner(target !== undefined ? target : (evt?.target ?? null));
    if (owner !== null && LAYER_RANK[owner] > LAYER_RANK[layer])
        return false;
    if (gesture) {
        if (claimed.has(gesture))
            return false;
        claimed.add(gesture);
    }
    return true;
}
/**
 * Mark a narrative bleed as in flight. Ambient responders stay quiet until the
 * returned release is called. A counter, not a flag, so overlapping narrative
 * bleeds cannot clear each other early; the returned release is idempotent.
 */
export function holdAmbientBleed() {
    ambientHolds += 1;
    let released = false;
    return () => {
        if (released)
            return;
        released = true;
        ambientHolds = Math.max(0, ambientHolds - 1);
    };
}
export function isAmbientHeld() {
    return ambientHolds > 0;
}
/** Test seam: clear all registrations and holds. */
export function resetBleedBus() {
    nodeOwners.clear();
    selectorOwners.length = 0;
    ambientHolds = 0;
}
