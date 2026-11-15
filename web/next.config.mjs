import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // the repo root, so web/ can import ../shared (fixtures used by both the client and the server);
  // Turbopack refuses files outside its root, and by default the root is web/
  turbopack: {
    root: fileURLToPath(new URL("..", import.meta.url)),
    // @strudel/web is one prebuilt bundle with its own audio engine inside. @strudel/soundfonts imports
    // @strudel/webaudio by name, which would load a second, separate engine where its sounds register
    // unheard, so that name points at the bundle. @strudel/core is left alone: @strudel/mini needs the
    // real package, and the soundfont code only uses plain helpers from it.
    resolveAlias: {
      "@strudel/webaudio": "@strudel/web",
    },
  },
};
export default nextConfig;
