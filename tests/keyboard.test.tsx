/**
 * The composite-widget keyboard contract.
 *
 * These are regression tests for two defects the adoption audit found, and
 * they are written to fail if either comes back:
 *
 *  - the Maku shuttle bound keydown in the CAPTURE phase and called
 *    preventDefault(), so it ran ahead of every component handler on the page
 *    and Tantu's own tablist never saw ArrowRight;
 *  - the tablist moved selection without moving focus, stranding the keyboard
 *    on an element that had just become tabindex="-1".
 */
import { describe, expect, it } from "vitest";
import type { ComponentProps } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { TantuTabs } from "../src/tantu/components/TantuTabs";
import { TantuNaksha } from "../src/tantu/components/TantuNaksha";
import { createMakuShuttle, type MakuShuttleHandle } from "../src/tantu/lib/maku-shuttle";

/** The shuttle draws its weft onto a page-level SVG overlay. */
function mountShuttle(): MakuShuttleHandle {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  document.body.appendChild(svg);
  return createMakuShuttle(svg, null);
}

const ITEMS = [
  { id: "warp", label: "Warp", content: <p>warp threads</p> },
  { id: "weft", label: "Weft", content: <p>weft threads</p> },
  { id: "selvedge", label: "Selvedge", content: <p>selvedge</p> },
];

function tablist() {
  return screen.getByRole("tablist");
}

function selected() {
  return screen.getByRole("tab", { selected: true });
}

describe("TantuTabs — WAI-ARIA tablist pattern", () => {
  it("moves selection forward with ArrowRight in LTR", () => {
    render(<TantuTabs items={ITEMS} />);
    expect(selected()).toHaveTextContent("Warp");
    fireEvent.keyDown(tablist(), { key: "ArrowRight" });
    expect(selected()).toHaveTextContent("Weft");
  });

  it("wraps around at both ends", () => {
    render(<TantuTabs items={ITEMS} />);
    fireEvent.keyDown(tablist(), { key: "ArrowLeft" });
    expect(selected()).toHaveTextContent("Selvedge");
    fireEvent.keyDown(tablist(), { key: "ArrowRight" });
    expect(selected()).toHaveTextContent("Warp");
  });

  it("reverses the arrow roles under dir=rtl", () => {
    // "In a right-to-left language, the roles of the left and right arrow
    // keys are reversed." — WAI-ARIA Authoring Practices 1.2, tabs pattern.
    const { container } = render(
      <div dir="rtl">
        <TantuTabs items={ITEMS} />
      </div>,
    );
    expect(container.firstElementChild).toHaveAttribute("dir", "rtl");

    fireEvent.keyDown(tablist(), { key: "ArrowRight" });
    expect(selected()).toHaveTextContent("Selvedge");

    fireEvent.keyDown(tablist(), { key: "ArrowLeft" });
    expect(selected()).toHaveTextContent("Warp");
  });

  it("jumps to the first and last tab with Home and End", () => {
    render(<TantuTabs items={ITEMS} />);
    fireEvent.keyDown(tablist(), { key: "End" });
    expect(selected()).toHaveTextContent("Selvedge");
    fireEvent.keyDown(tablist(), { key: "Home" });
    expect(selected()).toHaveTextContent("Warp");
  });

  it("carries focus with selection, so the roving tabindex stays coherent", () => {
    render(<TantuTabs items={ITEMS} />);
    screen.getByRole("tab", { name: "Warp" }).focus();

    fireEvent.keyDown(tablist(), { key: "ArrowRight" });

    const active = document.activeElement as HTMLElement;
    expect(active).toHaveTextContent("Weft");
    // The newly selected tab is the widget's single tab stop; the one focus
    // just left must not be.
    expect(active).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("tab", { name: "Warp" })).toHaveAttribute("tabindex", "-1");
  });

  it("skips disabled tabs when walking", () => {
    const items = [
      ITEMS[0],
      { ...ITEMS[1], disabled: true },
      ITEMS[2],
    ];
    render(<TantuTabs items={items} />);
    fireEvent.keyDown(tablist(), { key: "ArrowRight" });
    expect(selected()).toHaveTextContent("Selvedge");
  });

  it("wires each tab to its panel", () => {
    render(<TantuTabs items={ITEMS} />);
    const tab = selected();
    const panel = screen.getByRole("tabpanel");
    expect(tab).toHaveAttribute("aria-controls", panel.id);
    expect(panel).toHaveAttribute("aria-labelledby", tab.id);
  });
});

describe("Maku shuttle — arrow keys belong to the component first", () => {
  it("leaves the arrow keys alone inside an ARIA composite widget", () => {
    render(<TantuTabs items={ITEMS} />);
    const shuttle = mountShuttle();

    try {
      screen.getByRole("tab", { name: "Warp" }).focus();
      // Dispatched on the focused tab and allowed to bubble to document,
      // exactly as a real key press does.
      fireEvent.keyDown(document.activeElement!, { key: "ArrowRight", bubbles: true });

      // The shuttle must not have consumed it: the tablist moved.
      expect(selected()).toHaveTextContent("Weft");
    } finally {
      shuttle.dispose();
    }
  });

  it("leaves the arrow keys alone inside native form controls", () => {
    const shuttle = mountShuttle();
    try {
      for (const html of [
        '<input type="range" />',
        "<textarea></textarea>",
        '<input type="radio" name="g" />',
        '<select><option>a</option></select>',
        '<div contenteditable="true"></div>',
      ]) {
        const host = document.createElement("div");
        host.innerHTML = html;
        document.body.appendChild(host);
        const control = host.firstElementChild as HTMLElement;
        control.focus();

        const event = new KeyboardEvent("keydown", {
          key: "ArrowRight",
          bubbles: true,
          cancelable: true,
        });
        control.dispatchEvent(event);

        expect(event.defaultPrevented, `${html} had its arrow key stolen`).toBe(false);
        host.remove();
      }
    } finally {
      shuttle.dispose();
    }
  });

  it("stands down once another handler has already claimed the key", () => {
    const shuttle = mountShuttle();
    try {
      const button = document.createElement("button");
      document.body.appendChild(button);
      button.addEventListener("keydown", (e) => e.preventDefault());
      button.focus();

      const event = new KeyboardEvent("keydown", {
        key: "ArrowDown",
        bubbles: true,
        cancelable: true,
      });
      // Should not throw, and should not attempt to move focus after the
      // event has been claimed.
      expect(() => button.dispatchEvent(event)).not.toThrow();
      expect(document.activeElement).toBe(button);
      button.remove();
    } finally {
      shuttle.dispose();
    }
  });
});

/**
 * The 2D extension of that contract.
 *
 * TantuNaksha takes the palette's one-row roving tabindex to a chart of up to
 * ~100 squares. Everything below is a rule that would be invisible until a
 * keyboard user hit it: a row step that lands on the end of a shorter row, a
 * band boundary that is crossed rather than stopped at, and locked squares
 * that stay reachable instead of being skipped — which is what keeps the
 * chart's whole point available without a mouse.
 */
describe("TantuNaksha — roving tabindex across rows", () => {
  const BANDS = [
    {
      id: "first",
      label: "First band",
      // 4 columns: squares 1-4 on row 0, 5-6 on row 1 (a short row).
      nodes: [1, 2, 3, 4, 5, 6].map((n) => ({
        id: `a${n}`,
        label: `Square ${n}`,
        state: (n < 3 ? "completed" : n === 3 ? "active" : "locked") as
          | "completed"
          | "active"
          | "locked",
      })),
    },
    {
      id: "second",
      label: "Second band",
      // squares 7-10 on row 2, 11-12 on row 3.
      nodes: [7, 8, 9, 10, 11, 12].map((n) => ({
        id: `b${n}`,
        label: `Square ${n}`,
        state: "locked" as const,
      })),
    },
  ];

  function chart(props: Partial<ComponentProps<typeof TantuNaksha>> = {}) {
    return render(<TantuNaksha bands={BANDS} columns={4} label="Sampler chart" {...props} />);
  }

  /** The square that currently holds focus, by its number. */
  function focusedSquare(): string {
    return (document.activeElement as HTMLElement | null)?.getAttribute("aria-label") ?? "none";
  }

  function square(n: number) {
    return screen.getByRole("button", { name: new RegExp(`^Square ${n},`) });
  }

  it("starts the cursor on the active square and makes it the only tab stop", () => {
    chart();
    expect(square(3)).toHaveAttribute("tabindex", "0");
    const stops = screen
      .getAllByRole("button")
      .filter((b) => b.getAttribute("tabindex") === "0");
    expect(stops).toHaveLength(1);
  });

  it("walks the flattened order with Left/Right, crossing rows and bands", () => {
    chart();
    square(6).focus();
    fireEvent.keyDown(square(6), { key: "ArrowRight" });
    // Row 1 ends at square 6 and band two begins at square 7.
    expect(focusedSquare()).toMatch(/^Square 7,/);
  });

  it("clamps at the two ends rather than wrapping", () => {
    chart();
    square(1).focus();
    fireEvent.keyDown(square(1), { key: "ArrowLeft" });
    expect(focusedSquare()).toMatch(/^Square 1,/);
    square(12).focus();
    fireEvent.keyDown(square(12), { key: "ArrowRight" });
    expect(focusedSquare()).toMatch(/^Square 12,/);
  });

  it("reverses the inline arrows under dir=rtl", () => {
    const { container } = render(
      <div dir="rtl">
        <TantuNaksha bands={BANDS} columns={4} label="Sampler chart" />
      </div>,
    );
    expect(container.firstElementChild).toHaveAttribute("dir", "rtl");
    square(3).focus();
    fireEvent.keyDown(square(3), { key: "ArrowRight" });
    expect(focusedSquare()).toMatch(/^Square 2,/);
  });

  it("moves a row at a time with Up/Down, holding the column", () => {
    chart();
    square(2).focus();
    fireEvent.keyDown(square(2), { key: "ArrowDown" });
    expect(focusedSquare()).toMatch(/^Square 6,/); // row 1, column 1
    fireEvent.keyDown(square(6), { key: "ArrowUp" });
    expect(focusedSquare()).toMatch(/^Square 2,/);
  });

  it("lands on the last square of a shorter row instead of nowhere", () => {
    chart();
    square(4).focus(); // row 0, column 3
    fireEvent.keyDown(square(4), { key: "ArrowDown" });
    // Row 1 holds only squares 5 and 6.
    expect(focusedSquare()).toMatch(/^Square 6,/);
  });

  it("crosses the fringe between bands on a row step", () => {
    chart();
    square(5).focus(); // row 1, first band
    fireEvent.keyDown(square(5), { key: "ArrowDown" });
    expect(focusedSquare()).toMatch(/^Square 7,/); // row 2, second band
  });

  it("stays put at the top and bottom rows", () => {
    chart();
    square(1).focus();
    fireEvent.keyDown(square(1), { key: "ArrowUp" });
    expect(focusedSquare()).toMatch(/^Square 1,/);
    square(11).focus();
    fireEvent.keyDown(square(11), { key: "ArrowDown" });
    expect(focusedSquare()).toMatch(/^Square 11,/);
  });

  it("takes Home and End to the ends of the row", () => {
    chart();
    square(9).focus(); // row 2: squares 7-10
    fireEvent.keyDown(square(9), { key: "End" });
    expect(focusedSquare()).toMatch(/^Square 10,/);
    fireEvent.keyDown(square(10), { key: "Home" });
    expect(focusedSquare()).toMatch(/^Square 7,/);
  });

  it("takes Ctrl+Home and Ctrl+End to the ends of the chart", () => {
    chart();
    square(9).focus();
    fireEvent.keyDown(square(9), { key: "Home", ctrlKey: true });
    expect(focusedSquare()).toMatch(/^Square 1,/);
    fireEvent.keyDown(square(1), { key: "End", ctrlKey: true });
    expect(focusedSquare()).toMatch(/^Square 12,/);
  });

  it("keeps locked squares reachable, disabled and silent", () => {
    const chosen: string[] = [];
    chart({ onSelect: (node) => chosen.push(node.id) });
    expect(square(12)).toHaveAttribute("aria-disabled", "true");
    square(12).focus();
    expect(focusedSquare()).toMatch(/^Square 12,/);
    fireEvent.click(square(12));
    expect(chosen).toEqual([]);
    fireEvent.click(square(1));
    expect(chosen).toEqual(["a1"]);
  });

  it("names each square with its state, and marks the active one current", () => {
    chart();
    expect(square(1)).toHaveAccessibleName("Square 1, completed");
    expect(square(3)).toHaveAccessibleName("Square 3, in progress");
    expect(square(4)).toHaveAccessibleName("Square 4, locked");
    expect(square(3)).toHaveAttribute("aria-current", "step");
  });
});
