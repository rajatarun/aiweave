/**
 * The Darshan lens's alternative to the hand.
 *
 * WCAG 2.5.7 (Dragging Movements) and 2.5.1 (Pointer Gestures) both ask the
 * same question of this component: is there a way to reach every position and
 * every magnification with a single pointer that traces no path? Until the
 * keypad existed the answer was no, and 2.5.7 was the one *Does Not Support*
 * in the conformance report.
 *
 * These tests hold the answer. They deliberately press buttons and send key
 * events rather than synthesising pointer moves: a test that dragged would be
 * testing the thing that already worked.
 *
 * jsdom reports every box as 0×0, and the lens clamps the cloth to the
 * aperture, so an unsized lens is pinned at the origin and every pan is a
 * no-op that passes vacuously. `sizeLens` gives the frame and the cloth real
 * geometry, and `moves the cloth` below would fail without it — that is the
 * negative control for this whole file.
 */
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { TantuDarshanLens } from "../src/tantu/components/TantuDarshanLens";

/**
 * The lens only engages below its breakpoint, and the shared setup answers
 * every media query with `false`. Answer the width query truthfully for a
 * phone and leave the preference queries alone.
 */
beforeAll(() => {
  window.matchMedia = ((query: string) => ({
    matches: /max-width/.test(query),
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  })) as never;
});

afterEach(() => {
  document.documentElement.removeAttribute("dir");
  cleanup();
});

const APERTURE = { width: 360, height: 640 };
const CLOTH = { width: 1296, height: 1080 };

function fix(el: Element | null, sizes: Record<string, number>) {
  if (!el) throw new Error("the lens did not render its frame");
  for (const [prop, value] of Object.entries(sizes)) {
    Object.defineProperty(el, prop, { value, configurable: true });
  }
}

/** Give the lens the layout jsdom refuses to compute. */
function sizeLens(container: HTMLElement) {
  const frame = container.querySelector(".tantu-darshan-aperture");
  const cloth = container.querySelector<HTMLElement>(".tantu-darshan-cloth");
  fix(frame, { clientWidth: APERTURE.width, clientHeight: APERTURE.height });
  fix(cloth, {
    offsetWidth: CLOTH.width,
    offsetHeight: CLOTH.height,
    clientWidth: CLOTH.width,
    clientHeight: CLOTH.height,
  });
  return cloth as HTMLElement;
}

/** The lens's live position, read back off the transform it actually wrote. */
function positionOf(cloth: HTMLElement) {
  const t = cloth.style.transform;
  const translate = /translate3d\((-?[\d.]+)px,\s*(-?[\d.]+)px/.exec(t);
  const scale = /scale\(([\d.]+)\)/.exec(t);
  if (!translate || !scale) throw new Error(`unreadable transform: ${t}`);
  return {
    x: Number(translate[1]),
    y: Number(translate[2]),
    zoom: Number(scale[1]),
  };
}

function mount(dir: "ltr" | "rtl" = "ltr") {
  document.documentElement.setAttribute("dir", dir);
  const view = render(
    <TantuDarshanLens weaveWidth={CLOTH.width} weaveHeight={CLOTH.height} silent>
      <p data-darshan-node="prose">A tapestry read through the lens.</p>
    </TantuDarshanLens>,
  );
  return { ...view, cloth: sizeLens(view.container) };
}

describe("Darshan lens — the non-path alternative", () => {
  it("engages below the breakpoint and offers a control for every gesture", () => {
    mount();
    for (const label of [
      "Pan up",
      "Pan down",
      "Pan left",
      "Pan right",
      "Zoom in",
      "Zoom out",
      "Fit the whole cloth",
    ]) {
      expect(screen.getByRole("button", { name: label })).toBeTruthy();
    }
  });

  it("moves the cloth on a single press, with no drag", async () => {
    const user = userEvent.setup();
    const { cloth } = mount();
    expect(positionOf(cloth).x).toBe(0);

    await user.click(screen.getByRole("button", { name: "Pan right" }));

    // Panning the lens right reveals what lies to the right, which pulls the
    // cloth the other way.
    expect(positionOf(cloth).x).toBeLessThan(0);
  });

  it("reaches every axis and comes back to where it started", async () => {
    const user = userEvent.setup();
    const { cloth } = mount();

    await user.click(screen.getByRole("button", { name: "Pan right" }));
    await user.click(screen.getByRole("button", { name: "Pan down" }));
    const away = positionOf(cloth);
    expect(away.x).toBeLessThan(0);
    expect(away.y).toBeLessThan(0);

    await user.click(screen.getByRole("button", { name: "Pan left" }));
    await user.click(screen.getByRole("button", { name: "Pan up" }));
    const back = positionOf(cloth);
    expect(back.x).toBeCloseTo(0, 5);
    expect(back.y).toBeCloseTo(0, 5);
  });

  it("will not pull the cloth off the aperture", async () => {
    const user = userEvent.setup();
    const { cloth } = mount();

    // The cloth is already at its leading edge; pressing towards it is a
    // no-op rather than an escape.
    await user.click(screen.getByRole("button", { name: "Pan left" }));
    expect(positionOf(cloth).x).toBe(0);

    // And the far edge holds too: the cloth is 1296 wide behind a 360
    // aperture, so the lens cannot travel past -936.
    for (let press = 0; press < 40; press += 1) {
      await user.click(screen.getByRole("button", { name: "Pan right" }));
    }
    expect(positionOf(cloth).x).toBe(APERTURE.width - CLOTH.width);
  });

  it("magnifies and un-magnifies without a pinch", async () => {
    const user = userEvent.setup();
    const { cloth } = mount();
    expect(positionOf(cloth).zoom).toBe(1);

    await user.click(screen.getByRole("button", { name: "Zoom in" }));
    const magnified = positionOf(cloth).zoom;
    expect(magnified).toBeGreaterThan(1);

    await user.click(screen.getByRole("button", { name: "Zoom out" }));
    expect(positionOf(cloth).zoom).toBeLessThan(magnified);
  });

  it("clamps magnification to the same range a pinch reaches", async () => {
    const user = userEvent.setup();
    const { cloth } = mount();

    for (let press = 0; press < 12; press += 1) {
      await user.click(screen.getByRole("button", { name: "Zoom in" }));
    }
    expect(positionOf(cloth).zoom).toBe(4);

    for (let press = 0; press < 20; press += 1) {
      await user.click(screen.getByRole("button", { name: "Zoom out" }));
    }
    expect(positionOf(cloth).zoom).toBe(1);
  });

  it("fits the whole cloth back under the glass", async () => {
    const user = userEvent.setup();
    const { cloth } = mount();

    await user.click(screen.getByRole("button", { name: "Zoom in" }));
    await user.click(screen.getByRole("button", { name: "Pan right" }));
    expect(positionOf(cloth)).not.toEqual({ x: 0, y: 0, zoom: 1 });

    await user.click(screen.getByRole("button", { name: "Fit the whole cloth" }));
    expect(positionOf(cloth)).toEqual({ x: 0, y: 0, zoom: 1 });
  });

  it("pans from the keyboard once a key has focus", async () => {
    const user = userEvent.setup();
    const { cloth } = mount();

    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Zoom out" }));

    await user.keyboard("{ArrowRight}");
    expect(positionOf(cloth).x).toBeLessThan(0);

    await user.keyboard("{ArrowDown}");
    expect(positionOf(cloth).y).toBeLessThan(0);

    await user.keyboard("{Home}");
    expect(positionOf(cloth)).toEqual({ x: 0, y: 0, zoom: 1 });
  });

  it("keeps the arrows physical under RTL", async () => {
    const user = userEvent.setup();
    const { cloth } = mount("rtl");

    await user.tab();
    await user.keyboard("{ArrowRight}");

    // Every other arrow-key handler in Tantu reverses here. This one must
    // not: the lens is a viewport over a plane, and ArrowRight means "show
    // me what is further right" whichever way the text runs. Reversing it
    // would send the lens off the leading edge, where the clamp pins it at 0.
    expect(positionOf(cloth).x).toBeLessThan(0);
  });

  it("names the controls from the labels prop", () => {
    document.documentElement.setAttribute("dir", "rtl");
    render(
      <TantuDarshanLens silent labels={{ right: "التالي", group: "العدسة" }}>
        <p>نسيج</p>
      </TantuDarshanLens>,
    );
    expect(screen.getByRole("button", { name: "التالي" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "العدسة" })).toBeTruthy();
    // Unnamed labels keep their default rather than going blank.
    expect(screen.getByRole("button", { name: "Pan left" })).toBeTruthy();
  });

  it("has no accessibility violations while engaged", async () => {
    const { container } = mount();
    const results = await axe.run(container, {
      rules: Object.fromEntries(
        ["region", "landmark-one-main", "page-has-heading-one", "color-contrast"].map((id) => [
          id,
          { enabled: false },
        ]),
      ),
      resultTypes: ["violations"],
    });
    expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.html.slice(0, 120)}`)).toEqual([]);
  });
});
