/**
 * WCAG 1.4.13 — Content on Hover or Focus.
 *
 * Three requirements, and the component met one of them before this. The
 * criterion exists because a tooltip can cover the very content a magnifier
 * user is reading, with no way past it: no Escape, and no way to move the
 * pointer onto it to scroll it out of the way.
 */
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { TantuTooltip } from "../src/tantu/components/TantuTooltip";

function mount() {
  return render(
    <TantuTooltip label="Picks per inch">
      <button type="button">PPI</button>
    </TantuTooltip>,
  );
}

describe("TantuTooltip", () => {
  it("appears on hover and on focus", () => {
    mount();
    const trigger = screen.getByRole("button", { name: "PPI" });

    fireEvent.mouseEnter(trigger.parentElement!);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Picks per inch");
    fireEvent.mouseLeave(trigger.parentElement!);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    fireEvent.focus(trigger.parentElement!);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
  });

  it("describes its trigger only while shown", () => {
    mount();
    const host = screen.getByRole("button", { name: "PPI" }).parentElement!;
    expect(host).not.toHaveAttribute("aria-describedby");

    fireEvent.mouseEnter(host);
    const tooltip = screen.getByRole("tooltip");
    expect(host).toHaveAttribute("aria-describedby", tooltip.id);
  });

  it("is dismissible with Escape without moving pointer or focus", () => {
    mount();
    const host = screen.getByRole("button", { name: "PPI" }).parentElement!;

    fireEvent.mouseEnter(host);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    // The pointer never moved, so the description must go too — leaving a
    // dangling aria-describedby would point at an element that no longer
    // exists.
    expect(host).not.toHaveAttribute("aria-describedby");
  });

  it("stays dismissed until the trigger is actually left", () => {
    mount();
    const host = screen.getByRole("button", { name: "PPI" }).parentElement!;

    fireEvent.mouseEnter(host);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    // A second mouseenter without an intervening leave must not resurrect it,
    // or Escape would be undone by the next stray pointer event.
    fireEvent.mouseEnter(host);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("re-arms once the pointer leaves and returns", () => {
    mount();
    const host = screen.getByRole("button", { name: "PPI" }).parentElement!;

    fireEvent.mouseEnter(host);
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.mouseLeave(host);
    fireEvent.mouseEnter(host);

    expect(screen.getByRole("tooltip")).toBeInTheDocument();
  });

  it("is not on a timer — nothing hides it but leaving or dismissing", () => {
    mount();
    const host = screen.getByRole("button", { name: "PPI" }).parentElement!;
    fireEvent.mouseEnter(host);
    // The criterion's "persistent" requirement. A tooltip that vanishes on its
    // own is the failure mode this rules out.
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
  });
});
