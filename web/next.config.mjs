import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // the repo root, so web/ can import ../shared (fixtures used by both the client and the server);
  // Turbopack refuses files outside its root, and by default the root is web/
  turbopack: {
    root: fileURLToPath(new URL("..", import.meta.url)),
    // @strudel/web is one prebuilt bundle with its own copy of core + webaudio inside. @strudel/soundfonts
    // imports those packages by name, which would load a second, separate audio engine where its sounds
    // register unheard. Pointing both names at the bundle makes everyone share the one engine.
    resolveAlias: {
      "@strudel/core": "@strudel/web",
      "@strudel/webaudio": "@strudel/web",
    },
  },
};
export default nextConfig;
