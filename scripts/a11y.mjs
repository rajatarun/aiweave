/**
 * One definition of the target-size criterion, for every sweep that claims it.
 *
 * WCAG 2.2 SC 2.5.8 Target Size (Minimum) asks for 24x24 CSS px, and axe does
 * not implement it — so three sweeps measured it by hand, and all three
 * measured it slightly wrong in the same way: they counted every `a[href]`,
 * including links inside a sentence.
 *
 * The criterion exempts those explicitly. From the Inline exception: "the
 * target is in a sentence, or its size is otherwise constrained by the
 * line-height of non-target text." A link in a paragraph is as tall as the
 * line it sits on, and padding it to 24px would break the paragraph — which is
 * exactly why the exception exists. Counting it produced a failure that was
 * correct arithmetic and the wrong answer.
 *
 * Kept here rather than copied a fourth time: three hand-written copies of one
 * rule is how they drift, and a criterion enforced three slightly different
 * ways is worse than one enforced once.
 */

/**
 * Undersized interactive targets on the current page.
 *
 * Runs inside the browser via `page.evaluate`, so it is written as a plain
 * function with no closure over anything in Node.
 */
export function collectUndersizedTargets(rootSelector) {
  const root = rootSelector ? document.querySelector(rootSelector) : document;
  if (!root) return [];
  const SELECTOR = 'button, a[href], input, select, [tabindex="0"]';

  /**
   * The Inline exception: the target sits in running text, so its height is
   * the line's, not a choice anyone made. Detected as an inline box whose
   * parent also holds real text of its own — a link alone in a flex row is
   * laid out deliberately and gets no exemption.
   */
  const isInlineInSentence = (el) => {
    const display = getComputedStyle(el).display;
    if (display !== "inline") return false;
    const parent = el.parentElement;
    if (!parent) return false;
    let neighbouringText = "";
    for (const node of parent.childNodes) {
      if (node !== el && node.nodeType === Node.TEXT_NODE) neighbouringText += node.textContent;
    }
    return neighbouringText.trim().length > 0;
  };

  /**
   * The stretched link: an `::after` pinned to all four edges of the nearest
   * positioned ancestor, which is how a card gets one tab stop whose accessible
   * name is the title while the whole card still accepts the press.
   *
   * SC 2.5.8 measures "the region of the display that will accept a pointer
   * action", and for these that region is the card — but the element's own
   * `getBoundingClientRect()` does not include a pseudo-element, so measuring
   * the anchor reports the width of its text and fails a target that is
   * actually 300px tall. Same shape of mistake as the Inline exception above:
   * correct arithmetic on the wrong box.
   *
   * Deliberately narrow — an absolutely positioned pseudo pinned on all four
   * sides, nothing looser. Take the stretch away and the anchor is measured on
   * its own again, so the check still bites.
   */
  const stretchedRegion = (el) => {
    for (const pseudo of ["::after", "::before"]) {
      const style = getComputedStyle(el, pseudo);
      if (!style || style.content === "none" || style.position !== "absolute") continue;
      const pinned = ["top", "right", "bottom", "left"].every((side) => style[side] === "0px");
      if (pinned && el.offsetParent) return el.offsetParent.getBoundingClientRect();
    }
    return null;
  };

  return Array.from(root.querySelectorAll(SELECTOR))
    // The visually hidden native control behind a custom one is not the target
    // a pointer is aimed at; the visible custom control is, and it is measured.
    .filter((el) => !el.classList.contains("tantu-visually-hidden"))
    .filter((el) => !isInlineInSentence(el))
    .map((el) => {
      const r = stretchedRegion(el) ?? el.getBoundingClientRect();
      return {
        w: Math.round(r.width),
        h: Math.round(r.height),
        what: `${el.tagName.toLowerCase()}.${(el.getAttribute("class") || "").split(" ")[0]}`,
      };
    })
    // Zero-sized means not rendered — a different defect, and not this one.
    .filter((t) => t.w > 0 && t.h > 0 && (t.w < 24 || t.h < 24));
}

/**
 * Run the collector in `page` and return what it found.
 *
 * `rootSelector` scopes it to a subtree — the story sweep measures inside
 * `#storybook-root` so Storybook's own chrome is not on trial.
 */
export async function undersizedTargets(page, rootSelector = null) {
  return page.evaluate(
    `(${collectUndersizedTargets.toString()})(${JSON.stringify(rootSelector)})`,
  );
}
