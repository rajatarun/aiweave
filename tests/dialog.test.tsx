/**
 * The modal contract.
 *
 * `aria-modal="true"` is a promise that nothing outside the panel is
 * reachable. The browser does not enforce it — the author has to — and Tantu
 * was not: Tab walked straight out of the dialog into the page behind the
 * scrim, where a keyboard user could operate controls they could not see.
 * Nor did focus come back on close.
 */
import { describe, expect, it } from "vitest";
import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { TantuDialog } from "../src/tantu/components/TantuDialog";

function Harness({ persistent = false }: { persistent?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Open the panel
      </button>
      <button type="button">Behind the scrim</button>
      <TantuDialog
        open={open}
        persistent={persistent}
        title="Cut the cloth"
        onClose={() => setOpen(false)}
        footer={
          <>
            <button type="button">Cancel</button>
            <button type="button">Cut</button>
          </>
        }
      >
        <p>This cannot be undone.</p>
      </TantuDialog>
    </div>
  );
}

describe("TantuDialog", () => {
  it("takes its accessible name from its heading", () => {
    render(
      <TantuDialog open title="Cut the cloth" onClose={() => {}}>
        <p>body</p>
      </TantuDialog>,
    );
    expect(screen.getByRole("dialog", { name: "Cut the cloth" })).toBeInTheDocument();
  });

  it("moves focus into the panel when it opens", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Open the panel" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it("wraps Tab from the last stop back to the first", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Open the panel" }));

    const cut = screen.getByRole("button", { name: "Cut" });
    cut.focus();
    fireEvent.keyDown(document, { key: "Tab" });

    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cancel" }));
  });

  it("wraps Shift+Tab from the first stop back to the last", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Open the panel" }));

    const cancel = screen.getByRole("button", { name: "Cancel" });
    cancel.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });

    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cut" }));
  });

  it("never lets focus reach a control behind the scrim", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Open the panel" }));
    const dialog = screen.getByRole("dialog");
    const behind = screen.getByRole("button", { name: "Behind the scrim" });

    for (let i = 0; i < 8; i++) {
      fireEvent.keyDown(document, { key: "Tab" });
      expect(document.activeElement).not.toBe(behind);
      expect(
        dialog.contains(document.activeElement),
        "focus escaped the panel while aria-modal was true",
      ).toBe(true);
    }
  });

  it("hands focus back to whatever opened it", () => {
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Open the panel" });
    opener.focus();
    fireEvent.click(opener);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(opener);
  });

  it("ignores Escape when persistent", () => {
    render(<Harness persistent />);
    fireEvent.click(screen.getByRole("button", { name: "Open the panel" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
