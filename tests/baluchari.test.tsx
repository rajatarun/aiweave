/**
 * The reveal is decoration; the sentence is the content. A consumer that
 * needs the text — a test, a screen reader, a host rendering this with
 * motion off — must never be made to wait on an animation to get it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { BaluchariReveal } from "../src/tantu/components/BaluchariReveal";

function mockMotion(reduced: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: reduced && query.includes("prefers-reduced-motion"),
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  })) as never;
}

describe("BaluchariReveal", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockMotion(false);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the words it was given, immediately, regardless of animation state", () => {
    render(<BaluchariReveal>a thread of cold, clean air</BaluchariReveal>);
    // The visible line is aria-hidden while it draws, but the text node
    // itself is in the DOM from the first render — never gated behind JS.
    expect(document.querySelector(".tantu-baluchari-line")?.textContent).toBe(
      "a thread of cold, clean air",
    );
  });

  it("does not mark itself done, or call onRevealed, before the sweep finishes", () => {
    const onRevealed = vi.fn();
    render(
      <BaluchariReveal durationMs={1000} delayMs={0} onRevealed={onRevealed}>
        settling in
      </BaluchariReveal>,
    );
    expect(document.querySelector(".tantu-baluchari-done")).toBeNull();
    expect(onRevealed).not.toHaveBeenCalled();

    act(() => { vi.advanceTimersByTime(999); });
    expect(onRevealed).not.toHaveBeenCalled();

    act(() => { vi.advanceTimersByTime(2); });
    expect(document.querySelector(".tantu-baluchari-done")).not.toBeNull();
    expect(onRevealed).toHaveBeenCalledTimes(1);
  });

  it("calls onRevealed exactly once even if it re-renders after settling", () => {
    const onRevealed = vi.fn();
    const { rerender } = render(
      <BaluchariReveal durationMs={100} delayMs={0} onRevealed={onRevealed}>
        one
      </BaluchariReveal>,
    );
    act(() => { vi.advanceTimersByTime(101); });
    expect(onRevealed).toHaveBeenCalledTimes(1);

    rerender(
      <BaluchariReveal durationMs={100} delayMs={0} onRevealed={onRevealed}>
        one
      </BaluchariReveal>,
    );
    act(() => { vi.advanceTimersByTime(200); });
    expect(onRevealed).toHaveBeenCalledTimes(1);
  });

  it("skips the sweep entirely under reduced motion — settled on the first render", () => {
    mockMotion(true);
    const onRevealed = vi.fn();
    render(
      <BaluchariReveal onRevealed={onRevealed}>a place you find by trusting what you hear</BaluchariReveal>,
    );
    expect(document.querySelector(".tantu-baluchari-done")).not.toBeNull();
    expect(onRevealed).toHaveBeenCalledTimes(1);
  });

  it("announces the finished line to assistive technology, and only once finished", () => {
    render(
      <BaluchariReveal durationMs={100} delayMs={0}>
        breathe, and listen
      </BaluchariReveal>,
    );
    const status = screen.getByRole("status");
    expect(status.textContent).toBe("");

    act(() => { vi.advanceTimersByTime(101); });
    expect(status.textContent).toBe("breathe, and listen");
  });

  it("omits the assistive-tech announcement when the host is already announcing it", () => {
    render(
      <BaluchariReveal announce={false} durationMs={0} delayMs={0}>
        one line
      </BaluchariReveal>,
    );
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("hides the drawn line from assistive technology — it is decoration, not the announcement", () => {
    render(<BaluchariReveal>hidden from a screen reader</BaluchariReveal>);
    expect(document.querySelector(".tantu-baluchari-line")?.getAttribute("aria-hidden")).toBe(
      "true",
    );
  });
});
