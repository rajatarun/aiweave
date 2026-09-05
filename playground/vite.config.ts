import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

/**
 * The playground consumes Tantu the way an application would — through the
 * package name, not a relative path into the repo.
 *
 * Two modes, because the playground has two jobs that pull in opposite
 * directions.
 *
 *   default            Alias the package name at ../src/tantu. The playground
 *                      exercises the WORKING TREE, which is what four audit
 *                      scripts depend on: verify_core, verify_tension,
 *                      verify_playground_beams and qa_playground all measure
 *                      playground/dist. Point those at the published package
 *                      and they would happily certify npm's copy while a
 *                      regression sat uncaught in src/ — verify_core exists
 *                      precisely to catch that, so it must never be measuring
 *                      a release instead of the branch.
 *
 *   TANTU_FROM_NPM=1   Drop the alias and resolve @weaveaijs/tantu from
 *                      node_modules like any other dependency. This is the
 *                      mode that proves the published package really does
 *                      build a working application, and the one a person gets
 *                      if they copy this directory somewhere else.
 *
 * `npm run build:npm` is the second mode. Both are expected to work; only the
 * first is what `npm run verify` measures.
 */
const fromNpm = process.env.TANTU_FROM_NPM === "1";

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
    alias: fromNpm
      ? {}
      : {
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
