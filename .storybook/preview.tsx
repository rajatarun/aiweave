import type { Decorator, Preview } from "@storybook/react-vite";
import "../src/tantu/styles/tantu.css";
import "./fonts.css";

/**
 * Theme and writing direction are toolbar globals rather than per-story args,
 * because every story has to be checkable in all four combinations — that is
 * the same matrix the test suite sweeps, and a reviewer should be able to
 * reproduce a failing case by clicking rather than by editing a file.
 */
const withTheme: Decorator = (Story, context) => {
  const { theme, direction } = context.globals;
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  root.setAttribute("dir", direction);
  return (
    <div dir={direction} style={{ padding: "1.5rem", background: "var(--tantu-bg-substrate)" }}>
      <Story />
    </div>
  );
};

const preview: Preview = {
  decorators: [withTheme],

  globalTypes: {
    theme: {
      description: "Tantu theme",
      defaultValue: "light",
      toolbar: {
        icon: "circlehollow",
        items: [
          { value: "light", title: "Light" },
          { value: "dark", title: "Dark" },
        ],
        dynamicTitle: true,
      },
    },
    direction: {
      description: "Writing direction",
      defaultValue: "ltr",
      toolbar: {
        icon: "transfer",
        items: [
          { value: "ltr", title: "LTR" },
          { value: "rtl", title: "RTL" },
        ],
        dynamicTitle: true,
      },
    },
  },

  parameters: {
    controls: { expanded: true, matchers: { color: /(color|dye)$/i } },
    a11y: {
      // Match the rule set the vitest sweep uses, so the two agree. The
      // page-level rules judge the harness, not the component, and colour
      // contrast is audited against the resolved tokens in
      // scripts/audit_a11y.mjs where the real values are available.
      config: {
        rules: [
          { id: "region", enabled: false },
          { id: "landmark-one-main", enabled: false },
          { id: "page-has-heading-one", enabled: false },
          { id: "bypass", enabled: false },
        ],
      },
      test: "error",
    },
    options: {
      storySort: {
        order: [
          "Introduction",
          "Foundations",
          "Layout",
          "Controls",
          "Navigation",
          "Overlays",
          "Feedback",
          "Data",
          "Chronology",
          "Dye",
          "Atmosphere",
        ],
      },
    },
  },
};

export default preview;
