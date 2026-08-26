import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../src/tantu/**/*.mdx", "../src/tantu/**/*.stories.@(ts|tsx)"],
  addons: [
    // Runs axe on every story as you view it, so an accessibility regression
    // shows up while the component is being built rather than in CI later.
    "@storybook/addon-a11y",
    "@storybook/addon-docs",
  ],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  // The published Storybook is served from a subdirectory on most static
  // hosts; leaving this unset breaks every asset path there.
  ...(process.env.STORYBOOK_BASE_PATH ? { viteFinal: async (c) => ({ ...c, base: process.env.STORYBOOK_BASE_PATH }) } : {}),
};

export default config;
