/**
 * A shop page is where this system stops being a demonstration and starts
 * costing someone money, so the commerce components are tested for what they
 * *do*, not for what they render.
 *
 * Every check here corresponds to a way the obvious implementation is wrong
 * in a manner that still renders correctly, still passes axe, and still looks
 * right in a screenshot — which is the exact class of defect this repository
 * has been bitten by before:
 *
 * - a struck price that reads to a listener as two unrelated numbers;
 * - a sold-out size drawn as `disabled`, which removes it from the tab order
 *   so the shopper who wanted that size never learns it exists;
 * - a card wrapped in one big `<a>`, giving one link whose accessible name is
 *   the entire card read as a single run-on string;
 * - a "+" button that submits the surrounding form because `type` defaults to
 *   `submit`.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { TantuPrice } from "../src/tantu/components/TantuPrice";
import { TantuQuantity } from "../src/tantu/components/TantuQuantity";
import { TantuSwatchSet } from "../src/tantu/components/TantuSwatchSet";
import { TantuGallery } from "../src/tantu/components/TantuGallery";
import { TantuProductCard } from "../src/tantu/components/TantuProductCard";
import { TantuImage } from "../src/tantu/components/TantuImage";

describe("TantuPrice", () => {
  it("says the reduction as one sentence and hides the visual pair", () => {
    const { container } = render(
      <TantuPrice amount={51.9} compareAt={85} currency="GBP" locale="en-GB" />,
    );

    // What a listener gets: one sentence naming both sums and their relation.
    expect(container.textContent).toContain("Reduced from £85.00 to £51.90");

    // What they must NOT get: the two bare numbers a second time.
    const spoken = container.querySelectorAll(":scope *:not([aria-hidden='true'])");
    const visible = Array.from(spoken).filter((node) => node.closest("[aria-hidden='true']") === null);
    const strays = visible.filter((node) => node.className === "tantu-price-was");
    expect(strays).toHaveLength(0);

    expect(container.querySelector(".tantu-price-was")).toHaveAttribute("aria-hidden", "true");
  });

  it("refuses to draw a reduction that did not reduce anything", () => {
    // A compareAt at or below the price is a merchandising bug upstream.
    // Drawing it as a saving would be a lie in the shop's favour.
    const { container } = render(<TantuPrice amount={85} compareAt={85} currency="GBP" locale="en-GB" />);
    expect(container.querySelector(".tantu-price-was")).toBeNull();
    expect(container.textContent).not.toContain("Reduced");
  });

  it("formats by currency rather than gluing a symbol to two decimals", () => {
    const { container } = render(<TantuPrice amount={4200} currency="JPY" locale="ja-JP" />);
    // Yen has no minor unit. A hand-rolled toFixed(2) would say 4200.00.
    expect(container.textContent).not.toContain(".00");
  });

  it("still renders a usable number when the currency code is wrong", () => {
    const { container } = render(<TantuPrice amount={12} currency="NOTACURRENCY" />);
    expect(container.textContent).toContain("12.00");
  });
});

describe("TantuQuantity", () => {
  it("does not submit the surrounding form", () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <TantuQuantity label="Quantity" defaultValue={1} max={5} />
      </form>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Increase quantity" }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("spends the increase button at the stock ceiling", () => {
    render(<TantuQuantity label="Quantity" defaultValue={1} max={2} />);
    const up = screen.getByRole("button", { name: "Increase quantity" });

    fireEvent.click(up);
    expect(screen.getByRole("spinbutton")).toHaveValue(2);
    expect(up).toBeDisabled();
  });

  it("clamps a typed value on blur, not under the cursor", () => {
    render(<TantuQuantity label="Quantity" defaultValue={1} max={9} />);
    const field = screen.getByRole("spinbutton");

    // Someone typing "12" against a max of 9 passes through 1 on the way.
    // Clamping per keystroke would strand them at 1.
    fireEvent.change(field, { target: { value: "12" } });
    expect(field).toHaveValue(12);

    // `focusOut`, not `blur`: React 17 moved `onBlur` onto the bubbling
    // `focusout` event and listens for it at the root, so a dispatched `blur`
    // — which does not bubble — never reaches the handler. In a browser the
    // two always arrive together, so this is a test-harness detail rather
    // than anything the component does differently.
    fireEvent.focusOut(field);
    expect(field).toHaveValue(9);
  });
});

describe("TantuSwatchSet", () => {
  const DYES = [
    { id: "indigo", label: "Indigo", swatch: "#1d3a5c" },
    { id: "madder", label: "Madder", swatch: "#8c2f22" },
    { id: "iron", label: "Iron black", swatch: "#26282e", available: false },
  ];

  it("keeps a sold-out option reachable and says that it is sold out", () => {
    render(<TantuSwatchSet label="Dye" options={DYES} value="indigo" />);
    const iron = screen.getByRole("radio", { name: /Iron black/ });

    // The whole point: `disabled` would take this out of the tab order, and
    // the shopper who wanted iron black would never find out it exists.
    expect(iron).not.toBeDisabled();
    expect(iron).toHaveAttribute("aria-disabled", "true");
    expect(iron.textContent).toContain("unavailable");
  });

  it("refuses the selection of a sold-out option", () => {
    const onChange = vi.fn();
    render(<TantuSwatchSet label="Dye" options={DYES} value="indigo" onChange={onChange} />);

    fireEvent.click(screen.getByRole("radio", { name: /Iron black/ }));
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("radio", { name: "Madder" }));
    expect(onChange).toHaveBeenCalledWith("madder", expect.objectContaining({ id: "madder" }));
  });

  it("is one tab stop, not one per dye", () => {
    render(<TantuSwatchSet label="Dye" options={DYES} value="madder" />);
    const stops = screen
      .getAllByRole("radio")
      .filter((node) => node.getAttribute("tabindex") === "0");
    expect(stops).toHaveLength(1);
    expect(stops[0]).toHaveAccessibleName("Madder");
  });

  it("moves along the row on an inline arrow", () => {
    const onChange = vi.fn();
    render(<TantuSwatchSet label="Dye" options={DYES} value="indigo" onChange={onChange} />);

    fireEvent.keyDown(screen.getByRole("radio", { name: "Indigo" }), { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith("madder", expect.objectContaining({ id: "madder" }));
  });
});

describe("TantuGallery", () => {
  const FRAMES = [
    { id: "square", src: "/a.jpg", alt: "The cloth square on." },
    { id: "edge", src: "/b.jpg", alt: "The selvedge, where the weft turns." },
  ];

  it("names the thumbnails by position, not by repeating each photograph", () => {
    render(<TantuGallery frames={FRAMES} />);
    // The frame's own alt already carries the picture. Repeating it on the
    // rail announces every photograph twice.
    expect(screen.getByRole("tab", { name: "View photograph 2 of 2" })).toBeInTheDocument();
  });

  it("changes the plate when a thumbnail is chosen", () => {
    render(<TantuGallery frames={FRAMES} />);
    expect(screen.getByAltText("The cloth square on.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "View photograph 2 of 2" }));
    expect(screen.getByAltText("The selvedge, where the weft turns.")).toBeInTheDocument();
  });
});

describe("TantuProductCard", () => {
  it("is one link per card, named for the piece", () => {
    const { container } = render(
      <TantuProductCard
        title="Madder stole"
        href="/madder"
        src="/madder.jpg"
        alt="Madder-dyed stole folded to show the selvedge."
        note="Kachchh · plain weave"
        price={{ amount: 51.9, compareAt: 85, currency: "GBP", locale: "en-GB" }}
      />,
    );

    const links = within(container).getAllByRole("link");
    expect(links).toHaveLength(1);
    // Not "Madder stole Kachchh plain weave £51.90 was £85.00".
    expect(links[0]).toHaveAccessibleName("Madder stole");
  });

  it("keeps the price readable in place rather than folding it into the link", () => {
    const { container } = render(
      <TantuProductCard
        title="Madder stole"
        href="/madder"
        src="/madder.jpg"
        alt="Madder-dyed stole."
        price={{ amount: 51.9, compareAt: 85, currency: "GBP", locale: "en-GB" }}
      />,
    );
    expect(container.textContent).toContain("Reduced from £85.00 to £51.90");
  });
});

describe("TantuImage", () => {
  it("holds its proportion before the file lands", () => {
    const { container } = render(<TantuImage src="/a.jpg" alt="Indigo cotton." ratio="4 / 5" />);
    const frame = container.querySelector(".tantu-image") as HTMLElement;
    expect(frame.style.aspectRatio).toBe("4 / 5");
  });

  it("keeps the frame and names what is missing when the file fails", () => {
    render(<TantuImage src="/gone.jpg" alt="Indigo cotton." ratio="4 / 5" />);
    fireEvent.error(screen.getByAltText("Indigo cotton."));

    // A broken-image stub tells the shopper nothing about the merchandise.
    expect(screen.getByText("Indigo cotton.")).toBeInTheDocument();
  });

  it("stays quiet when the image was declared ornamental", () => {
    const { container } = render(<TantuImage src="/gone.jpg" alt="" ratio="1 / 1" />);
    fireEvent.error(container.querySelector("img") as HTMLImageElement);
    expect(container.querySelector(".tantu-image-missing")?.textContent).toBe("");
  });

  it("loads lazily unless the frame is already on screen", () => {
    const { container, rerender } = render(<TantuImage src="/a.jpg" alt="Indigo." />);
    expect(container.querySelector("img")).toHaveAttribute("loading", "lazy");

    rerender(<TantuImage src="/a.jpg" alt="Indigo." eager />);
    expect(container.querySelector("img")).toHaveAttribute("loading", "eager");
  });
});
