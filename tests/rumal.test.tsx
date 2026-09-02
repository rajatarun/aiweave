/**
 * A two-sided cloth has to be able to turn over.
 *
 * ChambaRumalCard took an `isFlipped` prop and nothing else: no trigger, no
 * state, no handler. The whole premise of the component — a Dorukha card whose
 * reverse wicks through as dye — was unreachable from React, and the flip
 * existed only as a hand-written script on one static page. Every consumer
 * that rendered the card and wrote "press the card" underneath it was making a
 * promise the component could not keep, and nothing in the repository noticed,
 * because a card that never turns still renders, still passes axe, and still
 * looks right in a screenshot.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ChambaRumalCard } from "../src/tantu/components/ChambaRumalCard";

const FACES = {
  obverse: <p>The face the room sees.</p>,
  reverse: <p>The same stitch, read in mirror.</p>,
};

const card = () => document.querySelector(".tantu-card-rumal") as HTMLElement;
const showing = () => card().getAttribute("data-state");

describe("ChambaRumalCard", () => {
  it("turns over when the trigger is pressed", () => {
    render(<ChambaRumalCard {...FACES} />);
    expect(showing()).toBe("obverse");

    fireEvent.click(screen.getByRole("button", { name: "Turn the cloth" }));

    expect(showing()).toBe("reverse");
  });

  it("turns back", () => {
    render(<ChambaRumalCard {...FACES} />);
    fireEvent.click(screen.getByRole("button", { name: "Turn the cloth" }));
    fireEvent.click(screen.getByRole("button", { name: "Turn back" }));
    expect(showing()).toBe("obverse");
  });

  it("starts on the face the caller asked for", () => {
    render(<ChambaRumalCard {...FACES} defaultFlipped />);
    expect(showing()).toBe("reverse");
  });

  it("hides the face that is not showing from assistive technology", () => {
    render(<ChambaRumalCard {...FACES} />);
    const obverse = document.querySelector(".tantu-rumal-obverse");
    const reverse = document.querySelector(".tantu-rumal-reverse");
    expect(obverse?.getAttribute("aria-hidden")).toBe("false");
    expect(reverse?.getAttribute("aria-hidden")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Turn the cloth" }));

    expect(obverse?.getAttribute("aria-hidden")).toBe("true");
    expect(reverse?.getAttribute("aria-hidden")).toBe("false");
  });

  it("keeps the hidden face's trigger out of the tab order", () => {
    render(<ChambaRumalCard {...FACES} />);
    // Queried through the DOM, not by role: the hidden face is aria-hidden, so
    // its trigger is correctly absent from the accessibility tree — which is
    // itself the other half of this guarantee.
    const triggers = document.querySelectorAll(".tantu-rumal-flip");
    expect(triggers).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Turn back" })).toBeNull();
    expect(triggers[0]).not.toHaveAttribute("tabindex", "-1");
    expect(triggers[1]).toHaveAttribute("tabindex", "-1");
  });

  it("carries focus onto the face now showing", () => {
    // The face being left is aria-hidden, and the trigger just pressed is
    // inside it — leaving focus there strands a keyboard reader inside a
    // subtree screen readers have been told to ignore.
    render(<ChambaRumalCard {...FACES} />);
    const front = screen.getByRole("button", { name: "Turn the cloth" });
    front.focus();
    fireEvent.click(front);

    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Turn back" }));
  });

  it("reports the face the reader asked for", () => {
    const onFlipChange = vi.fn();
    render(<ChambaRumalCard {...FACES} onFlipChange={onFlipChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Turn the cloth" }));
    expect(onFlipChange).toHaveBeenCalledWith(true);
  });

  it("lets a controlled card be driven from outside", () => {
    const onFlipChange = vi.fn();
    const { rerender } = render(
      <ChambaRumalCard {...FACES} isFlipped={false} onFlipChange={onFlipChange} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Turn the cloth" }));

    // Controlled: the card does not move itself, it asks.
    expect(showing()).toBe("obverse");
    expect(onFlipChange).toHaveBeenCalledWith(true);

    rerender(<ChambaRumalCard {...FACES} isFlipped onFlipChange={onFlipChange} />);
    expect(showing()).toBe("reverse");
  });

  it("renders no trigger when controlled with nothing to call", () => {
    // The defect this component started with, in miniature: a control that
    // cannot change anything is worse than no control, so it is not drawn.
    render(<ChambaRumalCard {...FACES} isFlipped />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(showing()).toBe("reverse");
  });

  it("can be asked for no trigger at all", () => {
    render(<ChambaRumalCard {...FACES} trigger={false} />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("takes custom labels", () => {
    render(<ChambaRumalCard {...FACES} flipLabel="Today" backLabel="Yesterday" />);
    expect(screen.getByRole("button", { name: "Today" })).toBeInTheDocument();
  });

  it("mounts its own fray filter rather than depending on the page for one", () => {
    render(<ChambaRumalCard {...FACES} />);
    const filter = card().querySelector("filter");
    expect(filter?.id).toMatch(/^tantu-rumal-bleed-/);
    expect(filter?.querySelector("feDisplacementMap")).toBeTruthy();
  });

  it("gives two cards on one page distinct filters", () => {
    // A shared id would mean one card's fray taper drove the other's.
    render(
      <>
        <ChambaRumalCard {...FACES} />
        <ChambaRumalCard {...FACES} />
      </>,
    );
    const ids = Array.from(document.querySelectorAll("filter")).map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
