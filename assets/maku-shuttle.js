/**
 * TANTU KINETIC ENGINE — T3: WEAVER'S SHUTTLE (MAKU)
 *
 * Vanilla-DOM port of src/tantu/hooks/useMakuShuttle.ts, for pages that ship
 * no React runtime — the same reason src/tantu/lib/capillary-bleed.ts exists
 * alongside useCapillaryBleed. Self-contained (no imports: tsc runs with
 * --noResolve, same as capillary-bleed.ts) and audio-free — the hook's
 * getLoomAudio() sampler is a React-only concern this port doesn't carry,
 * so a static site gets the gold thread without unsolicited sound. The
 * coordinate readout is optional (pass null for coordEl).
 *
 * A focused element never teleports: a gold zari thread draws from the
 * previously focused node to the new one, then fades. Two hops inside
 * `tensionWindow` ms count as one taut, continuous throw across every node
 * the shuttle passed. Arrow keys throw the shuttle spatially (up/down stays
 * on the column, left/right stays on the row) instead of following DOM order.
 */
const INTERACTIVE_SELECTOR = [
    "a[href]",
    "button",
    "input",
    "select",
    "textarea",
    "summary",
    '[tabindex]:not([tabindex="-1"])',
].join(",");
const SVG_NS = "http://www.w3.org/2000/svg";
const TEXT_ENTRY = new Set(["text", "search", "url", "tel", "email", "password", "number", "date"]);
function isTextEntry(el) {
    if (!el)
        return false;
    if (el.tagName === "TEXTAREA")
        return true;
    if (el.tagName === "INPUT") {
        const type = el.type;
        return TEXT_ENTRY.has(type);
    }
    return el.isContentEditable === true;
}
/**
 * Roles and controls whose own keyboard contract owns the arrow keys.
 *
 * The shuttle's spatial routing is a convenience layered on top of the page;
 * it must never take arrow keys away from a widget whose ARIA pattern
 * requires them. Without this the shuttle broke Tantu's own TantuTabs
 * (ArrowLeft/ArrowRight select a tab, per WAI-ARIA Authoring Practices),
 * along with native radio groups, listboxes, menus, trees and grids —
 * because it listened in the capture phase and called preventDefault before
 * any component handler could run.
 */
const ARROW_OWNING_ROLES = new Set([
    "application", "combobox", "grid", "gridcell", "columnheader", "listbox",
    "menu", "menubar", "menuitem", "menuitemcheckbox", "menuitemradio",
    "option", "radio", "radiogroup", "row", "rowheader", "scrollbar",
    "searchbox", "slider", "spinbutton", "tab", "tablist", "textbox",
    "toolbar", "tree", "treegrid", "treeitem",
]);
/** True when `el`, or anything it sits inside, needs the arrow keys itself. */
function ownsArrowKeys(el) {
    for (let n = el; n; n = n.parentElement) {
        const role = n.getAttribute?.("role");
        if (role && ARROW_OWNING_ROLES.has(role))
            return true;
        if (n.tagName === "SELECT" || n.tagName === "TEXTAREA")
            return true;
        if (n.tagName === "INPUT") {
            const type = n.type;
            if (type === "radio" || type === "range" || TEXT_ENTRY.has(type))
                return true;
        }
        if (n.isContentEditable)
            return true;
    }
    return false;
}
function isReachable(el) {
    const node = el;
    if (node.hasAttribute("disabled"))
        return false;
    if (node.getAttribute("aria-hidden") === "true")
        return false;
    const rect = node.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0)
        return false;
    return true;
}
/** Snap a coordinate to the nearest structural thread (1px grid gap) of the loom. */
function snapToThread(value, lines) {
    if (lines.length === 0)
        return value;
    let best = lines[0];
    let bestDelta = Math.abs(value - best);
    for (const line of lines) {
        const delta = Math.abs(value - line);
        if (delta < bestDelta) {
            best = line;
            bestDelta = delta;
        }
    }
    return bestDelta < 48 ? best : value;
}
function readLoom() {
    const content = document.querySelector(".tantu-loom-content");
    if (!content)
        return null;
    const rect = content.getBoundingClientRect();
    const style = getComputedStyle(content);
    const tracks = style.gridTemplateColumns
        .split(" ")
        .map((v) => parseFloat(v))
        .filter((v) => !Number.isNaN(v));
    const gap = parseFloat(style.columnGap) || 1;
    const padTop = parseFloat(style.paddingTop) || 0;
    // `grid-template-columns` reports its tracks in logical order, but grid
    // lays the first track at the inline start — the right-hand edge under
    // `direction: rtl`. Walking from the physical left would then place every
    // thread on the wrong side of the cloth, so the walk follows the inline
    // axis and only the recorded positions are physical.
    const rtl = style.direction === "rtl";
    const padStart = parseFloat(rtl ? style.paddingRight : style.paddingLeft) || 0;
    const step = rtl ? -1 : 1;
    const origin = rtl ? rect.right - padStart : rect.left + padStart;
    const gaps = [];
    let cursor = origin;
    for (const track of tracks) {
        cursor += step * track;
        gaps.push(cursor + (step * gap) / 2);
        cursor += step * gap;
    }
    return {
        left: origin,
        top: rect.top + padTop,
        columnWidth: tracks[0] ?? 1,
        rowHeight: 48,
        gaps,
    };
}
/** Kasuti machine coordinates, e.g. [W:04-H:02]. */
function coordinateFor(el, loom) {
    const rect = el.getBoundingClientRect();
    if (!loom)
        return `[X:${Math.round(rect.left)}-Y:${Math.round(rect.top + window.scrollY)}]`;
    const w = Math.max(1, Math.round((rect.left - loom.left) / (loom.columnWidth + 1)) + 1);
    const h = Math.max(1, Math.floor((rect.top - loom.top) / loom.rowHeight) + 1);
    const pad = (n) => String(n).padStart(2, "0");
    return `[W:${pad(w)}-H:${pad(h)}]`;
}
export function createMakuShuttle(svg, 
/**
 * The Kasuti grid-coordinate readout. Pass null to run the shuttle
 * without it — the gold weft thread and spatial routing still work,
 * there is just no "[W:xx-H:xx]" chip following the focused node.
 */
coordEl, options = {}) {
    const { throwDuration = 180, trailDuration = 520, tensionWindow = 260, spatialRouting = true } = options;
    let lastPoint = null;
    let lastTime = 0;
    let tautPoints = [];
    let focused = null;
    function drawThread(points, taut) {
        if (points.length < 2)
            return;
        const d = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
        const path = document.createElementNS(SVG_NS, "path");
        path.setAttribute("d", d);
        path.setAttribute("class", taut ? "tantu-maku-thread tantu-maku-thread-taut" : "tantu-maku-thread");
        svg.appendChild(path);
        const length = path.getTotalLength();
        path.style.strokeDasharray = `${length}`;
        path.style.strokeDashoffset = `${length}`;
        const anim = path.animate([
            { strokeDashoffset: length, opacity: 1 },
            { strokeDashoffset: 0, opacity: 1, offset: 0.35 },
            { strokeDashoffset: 0, opacity: 0 },
        ], { duration: throwDuration + trailDuration, easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "forwards" });
        anim.onfinish = () => path.remove();
        anim.oncancel = () => path.remove();
    }
    function handleFocusIn(event) {
        const target = event.target;
        if (!target || !target.matches?.(INTERACTIVE_SELECTOR))
            return;
        if (focused) {
            focused.classList.remove("tantu-maku-focus");
            focused.removeAttribute("data-maku-coord");
        }
        focused = target;
        target.classList.add("tantu-maku-focus");
        const loom = readLoom();
        const coordinate = coordinateFor(target, loom);
        target.setAttribute("data-maku-coord", coordinate);
        const rect = target.getBoundingClientRect();
        const landing = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        if (coordEl) {
            coordEl.textContent = coordinate;
            coordEl.style.transform = `translate(${rect.right - 2}px, ${rect.bottom + 2}px) translateX(-100%)`;
            coordEl.setAttribute("data-state", "revealed");
        }
        const now = performance.now();
        const origin = lastPoint;
        if (origin) {
            const taut = now - lastTime < tensionWindow;
            const corner = { x: snapToThread(landing.x, loom?.gaps ?? []), y: origin.y };
            if (taut) {
                tautPoints.push(landing);
                drawThread([tautPoints[0], ...tautPoints], true);
            }
            else {
                tautPoints = [origin, landing];
                drawThread([origin, corner, landing], false);
            }
        }
        else {
            tautPoints = [landing];
        }
        lastPoint = landing;
        lastTime = now;
    }
    function handleFocusOut() {
        window.setTimeout(() => {
            if (document.activeElement === document.body) {
                focused?.classList.remove("tantu-maku-focus");
                focused?.removeAttribute("data-maku-coord");
                focused = null;
                if (coordEl)
                    coordEl.setAttribute("data-state", "hidden");
            }
        }, 0);
    }
    function handleKeyDown(event) {
        if (!spatialRouting)
            return;
        const key = event.key;
        if (key !== "ArrowUp" && key !== "ArrowDown" && key !== "ArrowLeft" && key !== "ArrowRight")
            return;
        if (event.metaKey || event.ctrlKey || event.altKey)
            return;
        // A component that handled this key already wins — the shuttle now runs
        // in the bubble phase specifically so component handlers get first refusal.
        if (event.defaultPrevented)
            return;
        const current = document.activeElement;
        if (!current || !current.matches?.(INTERACTIVE_SELECTOR))
            return;
        if (ownsArrowKeys(current))
            return;
        const origin = current.getBoundingClientRect();
        const vertical = key === "ArrowUp" || key === "ArrowDown";
        const sign = key === "ArrowDown" || key === "ArrowRight" ? 1 : -1;
        let bestEl = null;
        let bestDistance = Infinity;
        document.querySelectorAll(INTERACTIVE_SELECTOR).forEach((node) => {
            if (node === current || !isReachable(node))
                return;
            const rect = node.getBoundingClientRect();
            if (vertical) {
                const overlap = Math.min(origin.right, rect.right) - Math.max(origin.left, rect.left);
                if (overlap <= 0)
                    return;
                const delta = (rect.top + rect.height / 2 - (origin.top + origin.height / 2)) * sign;
                if (delta <= 1)
                    return;
                const distance = delta - overlap * 0.05;
                if (distance < bestDistance) {
                    bestDistance = distance;
                    bestEl = node;
                }
            }
            else {
                const overlap = Math.min(origin.bottom, rect.bottom) - Math.max(origin.top, rect.top);
                if (overlap <= 0)
                    return;
                const delta = (rect.left + rect.width / 2 - (origin.left + origin.width / 2)) * sign;
                if (delta <= 1)
                    return;
                const distance = delta - overlap * 0.05;
                if (distance < bestDistance) {
                    bestDistance = distance;
                    bestEl = node;
                }
            }
        });
        if (bestEl) {
            event.preventDefault();
            bestEl.focus();
        }
    }
    function handleReflow() {
        if (!focused)
            return;
        const rect = focused.getBoundingClientRect();
        if (coordEl) {
            coordEl.style.transform = `translate(${rect.right - 2}px, ${rect.bottom + 2}px) translateX(-100%)`;
        }
    }
    document.addEventListener("focusin", handleFocusIn, true);
    document.addEventListener("focusout", handleFocusOut, true);
    // Bubble, not capture: capture fired before every component handler, so the
    // shuttle silently overrode any widget that owns the arrow keys.
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleReflow, true);
    window.addEventListener("resize", handleReflow);
    return {
        dispose() {
            document.removeEventListener("focusin", handleFocusIn, true);
            document.removeEventListener("focusout", handleFocusOut, true);
            document.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("scroll", handleReflow, true);
            window.removeEventListener("resize", handleReflow);
            focused?.classList.remove("tantu-maku-focus");
        },
    };
}
