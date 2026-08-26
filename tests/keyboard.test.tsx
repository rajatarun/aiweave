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
import { fireEvent, render, screen } from "@testing-library/react";
import { TantuTabs } from "../src/tantu/components/TantuTabs";
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
