/**
 * The public surface and the sample cloth must agree.
 *
 * Without this, adding a component to index.ts silently exempts it from the
 * axe sweep, the SSR sweep and the RTL sweep — the checks would keep passing
 * while covering less. The failure message names the component, so the fix is
 * obvious: add a specimen to tests/fixtures.tsx.
 */
import { describe, expect, it } from "vitest";
import { isValidElement } from "react";
import * as Tantu from "../src/tantu";
import { SPECIMENS } from "./fixtures";

/** A React component export, as opposed to a hook, type or plain function. */
function isComponentExport(name: string, value: unknown): boolean {
  if (name.startsWith("use")) return false;
  if (typeof value === "function") return /^[A-Z]/.test(name);
  // forwardRef and memo produce objects, not functions.
  return (
    typeof value === "object" &&
    value !== null &&
    "$$typeof" in (value as Record<string, unknown>) &&
    /^[A-Z]/.test(name)
  );
}

const EXPORTED_COMPONENTS = Object.entries(Tantu)
  .filter(([name, value]) => isComponentExport(name, value))
  .map(([name]) => name)
  .sort();

const COVERED = SPECIMENS.map((s) => s.name).sort();

describe("component coverage", () => {
  it("exports at least the forty components the system claims", () => {
    expect(EXPORTED_COMPONENTS.length).toBeGreaterThanOrEqual(40);
  });

  it("has a specimen for every exported component", () => {
    const uncovered = EXPORTED_COMPONENTS.filter((n) => !COVERED.includes(n));
    expect(
      uncovered,
      `these components escape every sweep — add a specimen to tests/fixtures.tsx: ${uncovered.join(", ")}`,
    ).toEqual([]);
  });

  it("has no specimen for something that is not exported", () => {
    const orphaned = COVERED.filter((n) => !EXPORTED_COMPONENTS.includes(n));
    expect(orphaned, `specimens with no matching export: ${orphaned.join(", ")}`).toEqual([]);
  });

  it("names each specimen exactly once", () => {
    expect(new Set(COVERED).size).toBe(COVERED.length);
  });

  it("gives every specimen a real element", () => {
    for (const s of SPECIMENS) {
      expect(isValidElement(s.element), `${s.name} has no element`).toBe(true);
    }
  });
});
