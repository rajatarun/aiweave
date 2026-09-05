/**
 * A gauge has to read the tension it is actually at.
 *
 * TantuSlider drew its fill from `value ?? defaultValue ?? min` — the value at
 * first paint. With a `value` prop that is correct and updates on every
 * render; without one it is frozen, so an uncontrolled slider moved its thumb
 * (the native input owns that, and needs no help) while the gold fill behind
 * it stayed at the starting position for the life of the page.
 *
 * Every consumer in this repository drives the slider controlled, which is
 * exactly why nothing caught it: the component rendered, passed axe, and
 * screenshotted correctly in the one mode anybody exercised. Same shape as
 * the six dead controls the consequence audits were built to find — a control
 * that looks right and does not do the thing.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { TantuSlider } from "../src/tantu/components/TantuSlider";

const fill = () => document.querySelector(".tantu-slider-fill") as HTMLElement;

describe("TantuSlider", () => {
  it("moves the fill when an uncontrolled slider is dragged", () => {
    render(<TantuSlider label="Warp tension" defaultValue={20} min={0} max={100} />);
    expect(fill().style.width).toBe("20%");

    fireEvent.change(screen.getByRole("slider"), { target: { value: "75" } });

    expect(screen.getByRole("slider")).toHaveValue("75");
    // The assertion the old implementation failed: the thumb moved and the
    // fill did not.
    expect(fill().style.width).toBe("75%");
  });

  it("still follows the prop when driven from outside", () => {
    const { rerender } = render(<TantuSlider label="Warp tension" value={10} min={0} max={100} />);
    expect(fill().style.width).toBe("10%");

    rerender(<TantuSlider label="Warp tension" value={90} min={0} max={100} />);
    expect(fill().style.width).toBe("90%");
  });

  it("does not let an uncontrolled drag overwrite a controlled value", () => {
    const onChange = vi.fn();
    render(<TantuSlider label="Warp tension" value={30} min={0} max={100} onChange={onChange} />);

    fireEvent.change(screen.getByRole("slider"), { target: { value: "80" } });

    // The owner decides. The gauge reports the drag and keeps drawing 30
    // until the owner says otherwise.
    expect(onChange).toHaveBeenCalledWith(80);
    expect(fill().style.width).toBe("30%");
  });

  it("scales the fill to the range rather than assuming 0-100", () => {
    render(<TantuSlider label="Picks per inch" defaultValue={40} min={20} max={60} />);
    // 40 sits halfway between 20 and 60.
    expect(fill().style.width).toBe("50%");
  });

  it("draws an empty gauge rather than NaN when the range has no width", () => {
    render(<TantuSlider label="Fixed" defaultValue={5} min={5} max={5} />);
    expect(fill().style.width).toBe("0%");
  });

  it("starts at the floor when no default is given", () => {
    render(<TantuSlider label="Warp tension" min={20} max={60} />);
    expect(fill().style.width).toBe("0%");
    expect(screen.getByRole("slider")).toHaveValue("20");
  });
});
