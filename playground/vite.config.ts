import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

/**
 * The playground consumes Tantu the way an application would — through the
 * package name, not a relative path into the repo. The alias below is what a
 * consumer's `node_modules` provides; pointing it at the source keeps the
 * playground honest about the published entry point (`.` and `./styles.css`)
 * while still hot-reloading when a component changes.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    // The playground is a nested npm project, so `react` resolves from its own
    // node_modules for app code and from the repo root for the aliased Tantu
    // source — two copies, two dispatchers, and every hook throws
    // "Cannot read properties of null (reading 'useRef')". Deduping is what a
    // consumer's bundler does for them via the peer dependency; here it has to
    // be said out loud because the alias sidesteps package resolution.
    dedupe: ["react", "react-dom"],
    alias: {
      "@weaveaijs/tantu/styles.css": path.resolve(__dirname, "../src/tantu/styles/tantu.css"),
      "@weaveaijs/tantu/fonts.css": path.resolve(__dirname, "../src/tantu/styles/fonts.css"),
      "@weaveaijs/tantu": path.resolve(__dirname, "../src/tantu/index.ts"),
    },
  },
  // The typefaces are build output living at the repo root. Serving that
  // directory as the playground's public dir means there is no second copy to
  // fall out of date — and if `npm run build:fonts` has not been run, the
  // @font-face rules simply fail and every stack falls back to IBM Plex,
  // which is exactly what a consumer who has not wired the fonts would see.
  publicDir: path.resolve(__dirname, "../fonts"),
  server: { port: 5173 },
});
