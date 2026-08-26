/**
 * Writing direction — the warp can run either way.
 *
 * The stylesheet handles the inline axis with logical properties, which the
 * browser mirrors on its own. Script cannot lean on that: `transform`
 * functions are physical, and the WAI-ARIA Authoring Practices are explicit
 * that in a right-to-left context ArrowRight moves to the *previous* item in
 * a horizontal composite widget, not the next one. Both facts need the
 * resolved direction of the element in question, not a global flag — a page
 * can carry an RTL document with an LTR island in it (a code block, a
 * transliterated name), and the widget inside that island must follow its own
 * container.
 *
 * `getComputedStyle` is the only correct source: `dir` is inherited, can be
 * set on any ancestor, and can also come from `dir="auto"` resolving against
 * the actual text. Reading the attribute would miss all three.
 */
/**
 * +1 when the element's inline axis runs left-to-right, -1 when it runs
 * right-to-left. Multiply physical x-offsets by this.
 *
 * Falls back to +1 outside a browser (SSR) and for detached nodes, which is
 * the correct default: markup rendered on the server carries no layout, and
 * the value is only ever used to position something that has not been
 * measured yet.
 */
export function inlineFlip(el) {
    if (!el || typeof window === "undefined" || !window.getComputedStyle)
        return 1;
    try {
        return window.getComputedStyle(el).direction === "rtl" ? -1 : 1;
    }
    catch {
        return 1;
    }
}
/** True when the element's inline axis runs right-to-left. */
export function isRtl(el) {
    return inlineFlip(el) === -1;
}
/**
 * How far an inline-axis arrow key should move the cursor in a horizontal
 * composite widget, in *item* terms: +1 = towards the end of the collection,
 * -1 = towards its start, 0 = not an inline-axis arrow.
 *
 * WAI-ARIA Authoring Practices 1.2, "Keyboard Interaction ... in a
 * right-to-left language, the roles of the left and right arrow keys are
 * reversed." Block-axis arrows (Up/Down) are never reversed.
 */
export function inlineArrowStep(key, el) {
    if (key !== "ArrowRight" && key !== "ArrowLeft")
        return 0;
    const forward = key === "ArrowRight" ? 1 : -1;
    return (forward * inlineFlip(el));
}
/**
 * The element's inline-start padding in pixels — what `paddingLeft` used to
 * mean before the system had to work in both directions. Anything measuring
 * an offset from where text begins wants this, not the physical left edge.
 */
export function inlineStartPadding(style) {
    const logical = parseFloat(style.paddingInlineStart);
    if (Number.isFinite(logical))
        return logical;
    // jsdom and older engines do not resolve the logical longhand; fall back to
    // the physical side that corresponds to the resolved direction.
    const physical = style.direction === "rtl" ? style.paddingRight : style.paddingLeft;
    return parseFloat(physical) || 0;
}
